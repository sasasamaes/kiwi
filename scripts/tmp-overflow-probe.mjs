#!/usr/bin/env node
/**
 * THROWAWAY probe — deleted after the task.
 * Boots API + the three built apps, visits representative pages at 360px and
 * 390px (mobile emulation), and reports horizontal overflow + offenders.
 * Stress: injects an unbreakable 60-char string into text nodes to find
 * pages that don't survive long content.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = '/Users/josecampos/Documents/CerebroFran/delivery-app';
const MID = process.env.PROBE_MERCHANT_ID; // merchant local (seed)
const PW = '/usr/local/lib/node_modules/omniroute/node_modules/playwright';
const CHROME =
  '/Users/josecampos/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const PASSWORD = '123456';

async function waitFor(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}

async function main() {
  setTimeout(() => {
    console.log('⏱ WATCHDOG');
    process.exit(3);
  }, 420_000);

  const procs = [
    spawn('node', ['dist/main.js'], { cwd: `${ROOT}/api`, env: { ...process.env, PORT: '4000' }, stdio: 'ignore' }),
    spawn('npx', ['next', 'start', '-p', '3002'], { cwd: `${ROOT}/apps/client`, stdio: 'ignore' }),
    spawn('npx', ['next', 'start', '-p', '3001'], { cwd: `${ROOT}/apps/driver`, stdio: 'ignore' }),
    spawn('npx', ['next', 'start', '-p', '3000'], { cwd: `${ROOT}/apps/web`, stdio: 'ignore' }),
  ];
  try {
    if (!(await waitFor('http://localhost:4000/api/health'))) return console.log('✗ API');
    for (const p of [3002, 3001, 3000]) {
      if (!(await waitFor(`http://localhost:${p}/`))) return console.log(`✗ app :${p}`);
    }
    console.log('servers up\n');

    // tokens por rol
    const tokens = {};
    for (const [role, email] of [
      ['merchant', 'luis@kiwi.app'],
      ['driver', 'juan@kiwi.app'],
    ]) {
      const r = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: PASSWORD }),
      });
      const d = await r.json().catch(() => ({}));
      tokens[role] = d.access_token || d.token || d.accessToken || null;
      if (!tokens[role]) console.log(`⚠ no token para ${role}:`, JSON.stringify(d).slice(0, 120));
    }

    const targets = [
      { app: 'client', port: 3002, pages: [
        { path: '/', auth: null },
        { path: `/menu/${MID}`, auth: null, stress: true },
        { path: '/login', auth: null },
      ]},
      { app: 'driver', port: 3001, pages: [
        { path: '/', auth: 'driver' },
        { path: '/earnings', auth: 'driver' },
        { path: '/login', auth: null },
      ]},
      { app: 'web', port: 3000, pages: [
        { path: '/login', auth: null },
        { path: '/dashboard', auth: 'merchant' },
        { path: '/menu', auth: 'merchant', stress: true },
        { path: '/orders', auth: 'merchant' },
      ]},
    ];

    const { chromium } = await import(`${PW}/index.mjs`);
    const browser = await chromium.launch({ executablePath: CHROME, headless: true });

    for (const width of [360, 390]) {
      console.log(`\n======== WIDTH ${width}px ========`);
      const ctx = await browser.newContext({
        viewport: { width, height: 780 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });
      for (const t of targets) {
        for (const pg of t.pages) {
          const page = await ctx.newPage();
          if (pg.auth && tokens[pg.auth]) {
            await page.addInitScript(
              ([tok]) => localStorage.setItem('kiwi_token', tok),
              [tokens[pg.auth]],
            );
          }
          const url = `http://localhost:${t.port}${pg.path}`;
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await sleep(2600); // animaciones + fetches

          const m = await page.evaluate(() => {
            const vw = window.innerWidth;
            const docW = Math.max(
              document.documentElement.scrollWidth,
              document.body?.scrollWidth || 0,
            );
            const offenders = [];
            document.querySelectorAll('body *').forEach((el) => {
              const r = el.getBoundingClientRect();
              const cs = getComputedStyle(el);
              if (
                r.width > 4 &&
                r.height > 4 &&
                cs.visibility !== 'hidden' &&
                cs.opacity !== '0' &&
                (r.right > vw + 1 || r.left < -1)
              ) {
                offenders.push(
                  `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}→r${Math.round(r.right)}`,
                );
              }
            });
            return { vw, docW, over: docW - vw, offenders: [...new Set(offenders)].slice(0, 6) };
          });

          const flag = m.over > 1 ? `✗ OVERFLOW +${m.over}px` : '✓';
          console.log(`${flag} ${t.app}${pg.path}  (doc ${m.docW} vs vw ${m.vw})${m.offenders.length ? '  ⟵ ' + m.offenders.join(', ') : ''}`);

          // estrés: texto irrompible en el primer heading/precio visible
          if (pg.stress) {
            await page.evaluate(() => {
              const el = [...document.querySelectorAll('h3, p')].find((e) => e.offsetParent);
              if (el) el.textContent = 'A'.repeat(60);
            });
            await sleep(400);
            const m2 = await page.evaluate(() => {
              const vw = window.innerWidth;
              const docW = Math.max(
                document.documentElement.scrollWidth,
                document.body?.scrollWidth || 0,
              );
              return { over: docW - vw };
            });
            console.log(
              `${m2.over > 1 ? '✗ STRESS OVERFLOW +' + m2.over + 'px' : '✓ stress ok'} ${t.app}${pg.path} (texto irrompible)`,
            );
          }
          await page.close();
        }
      }
      await ctx.close();
    }
    await browser.close();
  } finally {
    procs.forEach((p) => p.kill('SIGKILL'));
    await sleep(300);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('probe crashed:', e.message);
  process.exit(2);
});
