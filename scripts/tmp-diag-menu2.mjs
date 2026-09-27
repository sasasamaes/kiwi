#!/usr/bin/env node
// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/** THROWAWAY: press-sink con mouse nativo + modal de checkout. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = '/Users/josecampos/Documents/CerebroFran/delivery-app';
const MID = process.env.PROBE_MERCHANT_ID;
const PW = '/usr/local/lib/node_modules/omniroute/node_modules/playwright';
const CHROME =
  '/Users/josecampos/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const api = spawn('node', ['dist/main.js'], { cwd: `${ROOT}/api`, env: { ...process.env, PORT: '4000' }, stdio: 'ignore' });
const web = spawn('npx', ['next', 'start', '-p', '3002'], { cwd: `${ROOT}/apps/client`, stdio: 'ignore' });
const waitFor = async (url) => { for (let i = 0; i < 90; i++) { try { const r = await fetch(url); if (r.ok) return; } catch {} await sleep(500); } };

try {
  await waitFor('http://localhost:4000/api/health');
  await waitFor('http://localhost:3002/');
  const { chromium, devices } = await import(`${PW}/index.mjs`);
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3002/menu/${MID}`, { waitUntil: 'domcontentloaded' });
  const plus = page.locator('button', { hasText: '+' }).first();
  await plus.waitFor({ state: 'visible', timeout: 20000 });

  // --- press-sink con mouse NATIVO (trusted events) ---
  await plus.scrollIntoViewIfNeeded();
  const box = await plus.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const sampler = page.evaluate(
    () =>
      new Promise((resolve) => {
        const target = [...document.querySelectorAll('button')].find(
          (b) => b.className.includes('rounded-full') && b.className.includes('bg-kiwi-500'),
        );
        if (!target) return resolve({ found: false, scales: [] });
        const scales = [];
        const t0 = performance.now();
        const tick = () => {
          const tr = getComputedStyle(target).transform;
          const m = tr && tr.match(/matrix\(([^,]+),/);
          if (m) scales.push(parseFloat(m[1]));
          if (performance.now() - t0 < 1200) requestAnimationFrame(tick);
          else resolve({ found: true, scales });
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await sleep(150);
  await page.mouse.up();
  const sink = await sampler;
  const min = Math.min(...(sink.scales.length ? sink.scales : [1]));
  console.log(`press-sink: found=${sink.found}, minScale=${min.toFixed(3)}, muestras=${sink.scales.length}`);
  console.log(`  → ${min < 0.96 ? '✓ hundimiento real (~0.94)' : '✗ sin hundimiento'}`);

  // flash inmediato tras el tap nativo
  const flash = await page
    .locator('button:has(svg.lucide-check)')
    .first()
    .waitFor({ state: 'visible', timeout: 1200 })
    .then(() => true)
    .catch(() => false);
  console.log(`success flash: ${flash ? '✓' : '✗'}`);

  // --- checkout modal ---
  await sleep(400);
  // force: el bar tiene whileHover scale — Playwright lo ve "inestable"
  await page.locator('div.bg-kiwi-gradient').first().click({ force: true, timeout: 5000 });
  await sleep(600);
  const modalText = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('--- tras click en barra ---');
  console.log(modalText.slice(0, 500));
  const ordenar = page.locator('button:has-text("Ordenar")');
  console.log('botones Ordenar:', await ordenar.count());
  if ((await ordenar.count()) > 0) {
    console.log('disabled?', await ordenar.first().isDisabled());
    const ob = await ordenar.first().boundingBox();
    console.log('bbox:', JSON.stringify(ob));
    // press-sink del CTA
    if (ob) {
      const s2 = page.evaluate(
        () =>
          new Promise((resolve) => {
            const t = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Ordenar'));
            const scales = [];
            const t0 = performance.now();
            const tick = () => {
              const tr = getComputedStyle(t).transform;
              const m = tr && tr.match(/matrix\(([^,]+),/);
              if (m) scales.push(parseFloat(m[1]));
              if (performance.now() - t0 < 600) requestAnimationFrame(tick);
              else resolve(scales);
            };
            requestAnimationFrame(tick);
          }),
      );
      await page.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2);
      await page.mouse.down();
      await sleep(130);
      await page.mouse.up();
      const r2 = await s2;
      const m2 = Math.min(...(r2.length ? r2 : [1]));
      console.log(`CTA press-sink: minScale=${m2.toFixed(3)} → ${m2 < 0.96 ? '✓' : '✗'}`);
    }
  }
  await page.screenshot({ path: '/tmp/kiwi-checkout.png', fullPage: false });
  console.log('screenshot: /tmp/kiwi-checkout.png');
  await browser.close();
} finally {
  api.kill(); web.kill('SIGKILL'); await sleep(300);
}
process.exit(0);
