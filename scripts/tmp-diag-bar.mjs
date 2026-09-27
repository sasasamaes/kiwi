#!/usr/bin/env node
// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/** THROWAWAY: ¿la barra fija del carrito escapa del viewport (ancestro con transform)? */
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
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  await page.goto(`http://localhost:3002/menu/${MID}`, { waitUntil: 'domcontentloaded' });
  const plus = page.locator('button:has-text("+")').first();
  await plus.waitFor({ state: 'visible', timeout: 20000 });
  await plus.tap();
  await sleep(700);

  const info = await page.evaluate(() => {
    const bar = document.querySelector('div.bg-kiwi-gradient');
    if (!bar) return { found: false };
    const r = bar.getBoundingClientRect();
    const vh = window.innerHeight, vw = window.innerWidth;
    // ¿algún ancestro con transform != none?
    const offenders = [];
    let el = bar.parentElement;
    while (el && el !== document.body) {
      const t = getComputedStyle(el).transform;
      if (t && t !== 'none') offenders.push({ cls: (el.className || '').slice(0, 80), transform: t.slice(0, 60) });
      el = el.parentElement;
    }
    return { found: true, rect: { top: r.top, bottom: r.bottom, left: r.left, height: r.height }, viewport: { vh, vw }, offenders };
  });
  console.log(JSON.stringify(info, null, 2));
  const inView = info.found && info.rect.top >= 0 && info.rect.bottom <= info.viewport.vh;
  console.log(inView ? '✓ barra dentro del viewport' : '✗ BARRA FUERA DEL VIEWPORT (bug real)');
  await browser.close();
} finally {
  api.kill(); web.kill('SIGKILL'); await sleep(300);
}
process.exit(0);
