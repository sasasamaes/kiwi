#!/usr/bin/env node
/** THROWAWAY: diagnóstico del menú en el emulador. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = '/Users/josecampos/Documents/CerebroFran/delivery-app';
const MID = process.env.PROBE_MERCHANT_ID;
const PW = '/usr/local/lib/node_modules/omniroute/node_modules/playwright';
const CHROME =
  '/Users/josecampos/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const api = spawn('node', ['dist/main.js'], { cwd: `${ROOT}/api`, env: { ...process.env, PORT: '4000' }, stdio: 'ignore' });
const web = spawn('npx', ['next', 'start', '-p', '3321'], { cwd: `${ROOT}/apps/client`, stdio: 'ignore' });

const waitFor = async (url) => { for (let i = 0; i < 90; i++) { try { const r = await fetch(url); if (r.ok) return; } catch {} await sleep(500); } };

try {
  await waitFor('http://localhost:4000/api/health');
  await waitFor('http://localhost:3321/');
  const { chromium, devices } = await import(`${PW}/index.mjs`);
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(`${m.type()}: ${m.text().slice(0, 160)}`));
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message.slice(0, 200)}`));
  const reqs = [];
  page.on('requestfailed', (r) => reqs.push(`FAIL ${r.method()} ${r.url().slice(0, 100)} ${r.failure()?.errorText}`));

  await page.goto(`http://localhost:3321/menu/${MID}`, { waitUntil: 'domcontentloaded' });
  await sleep(6000);
  console.log('URL final:', page.url());
  const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('--- body ---\n' + text);
  console.log('--- buttons ---', await page.locator('button').count());
  console.log('--- errores consola ---'); errs.slice(0, 8).forEach((e) => console.log(' ', e));
  console.log('--- requests fallidas ---'); reqs.slice(0, 6).forEach((e) => console.log(' ', e));
  await browser.close();
} finally {
  api.kill(); web.kill('SIGKILL'); await sleep(300);
}
process.exit(0);
