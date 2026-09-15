#!/usr/bin/env node
/** THROWAWAY — pantalla densas: touch targets <40px, fuentes <12px, overflow interno. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = '/Users/josecampos/Documents/CerebroFran/delivery-app';
const MID = process.env.PROBE_MERCHANT_ID;
const PW = '/usr/local/lib/node_modules/omniroute/node_modules/playwright';
const CHROME =
  '/Users/josecampos/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const PASSWORD = '123456';

async function waitFor(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await sleep(500);
  }
  return false;
}

async function main() {
  setTimeout(() => { console.log('⏱ WATCHDOG'); process.exit(3); }, 420_000);
  const procs = [
    spawn('node', ['dist/main.js'], { cwd: `${ROOT}/api`, env: { ...process.env, PORT: '4000' }, stdio: 'ignore' }),
    spawn('npx', ['next', 'start', '-p', '3002'], { cwd: `${ROOT}/apps/client`, stdio: 'ignore' }),
    spawn('npx', ['next', 'start', '-p', '3001'], { cwd: `${ROOT}/apps/driver`, stdio: 'ignore' }),
    spawn('npx', ['next', 'start', '-p', '3000'], { cwd: `${ROOT}/apps/web`, stdio: 'ignore' }),
  ];
  try {
    if (!(await waitFor('http://localhost:4000/api/health'))) return console.log('✗ API');
    for (const p of [3002, 3001, 3000]) if (!(await waitFor(`http://localhost:${p}/`))) return console.log(`✗ :${p}`);

    const tokens = {};
    for (const [role, email] of [['merchant', 'luis@kiwi.app'], ['driver', 'juan@kiwi.app']]) {
      const r = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: PASSWORD }),
      });
      const d = await r.json().catch(() => ({}));
      tokens[role] = d.access_token || d.token || d.accessToken;
    }

    const targets = [
      { app: 'client', port: 3002, pages: [
        { path: `/menu/${MID}`, auth: null, open: 'cart' },
        { path: '/orders', auth: null },
      ]},
      { app: 'driver', port: 3001, pages: [
        { path: '/active', auth: 'driver' },
        { path: '/profile', auth: 'driver' },
      ]},
      { app: 'web', port: 3000, pages: [
        { path: '/drivers', auth: 'merchant' },
        { path: '/orders/new', auth: 'merchant' },
        { path: '/notifications', auth: 'merchant' },
      ]},
    ];

    const { chromium } = await import(`${PW}/index.mjs`);
    const browser = await chromium.launch({ executablePath: CHROME, headless: true });

    for (const width of [360, 390]) {
      console.log(`\n======== ${width}px ========`);
      const ctx = await browser.newContext({ viewport: { width, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      for (const t of targets) {
        for (const pg of t.pages) {
          const page = await ctx.newPage();
          if (pg.auth && tokens[pg.auth]) await page.addInitScript(([tok]) => localStorage.setItem('kiwi_token', tok), [tokens[pg.auth]]);
          await page.goto(`http://localhost:${t.port}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await sleep(2600);

          if (pg.open === 'cart') {
            // abrir carrito: agregar 1 item y abrir el sheet
            const plus = page.locator('button:has-text("+")').first();
            if (await plus.isVisible().catch(() => false)) {
              await plus.tap().catch(() => {});
              await sleep(600);
              await page.locator('div.bg-kiwi-gradient').first().click({ force: true }).catch(() => {});
              await sleep(700);
            }
          }

          const m = await page.evaluate(() => {
            const vw = window.innerWidth;
            const docW = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
            // touch targets visibles <40px
            const smallTargets = [];
            document.querySelectorAll('button, a, input, select, [role="button"]').forEach((el) => {
              const r = el.getBoundingClientRect();
              if (r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden') {
                if ((r.width < 38 || r.height < 38) && r.width < vw) {
                  smallTargets.push(`${el.tagName.toLowerCase()}(${Math.round(r.width)}×${Math.round(r.height)})`);
                }
              }
            });
            // fuentes visibles <12px
            const tinyFonts = [];
            document.querySelectorAll('p, span, h1, h2, h3, h4, label, button').forEach((el) => {
              const r = el.getBoundingClientRect();
              if (r.width > 20 && el.textContent?.trim() && el.children.length === 0) {
                const fs = parseFloat(getComputedStyle(el).fontSize);
                if (fs < 11.5) tinyFonts.push(`${Math.round(fs)}px:"${el.textContent.trim().slice(0, 16)}"`);
              }
            });
            // overflow interno con scroll
            const innerScroll = [];
            document.querySelectorAll('div').forEach((el) => {
              if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 100) {
                const cs = getComputedStyle(el);
                if (cs.overflowX === 'visible' || cs.overflowX === '') {
                  innerScroll.push(el.className ? String(el.className).split(' ').slice(0, 3).join('.') : el.tagName);
                }
              }
            });
            return {
              over: docW - vw,
              smallTargets: [...new Set(smallTargets)].slice(0, 5),
              tinyFonts: [...new Set(tinyFonts)].slice(0, 5),
              innerScroll: [...new Set(innerScroll)].slice(0, 4),
            };
          });
          const bits = [];
          if (m.over > 1) bits.push(`OVERFLOW+${m.over}px`);
          if (m.smallTargets.length) bits.push(`targets<38px: ${m.smallTargets.join(' ')}`);
          if (m.tinyFonts.length) bits.push(`fonts<12px: ${m.tinyFonts.join(' ')}`);
          if (m.innerScroll.length) bits.push(`innerScroll: ${m.innerScroll.join(' ')}`);
          console.log(`${bits.length ? '⚠' : '✓'} ${t.app}${pg.path}${bits.length ? '\n    ' + bits.join('\n    ') : ''}`);
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

main().catch((e) => { console.error('probe crashed:', e.message); process.exit(2); });
