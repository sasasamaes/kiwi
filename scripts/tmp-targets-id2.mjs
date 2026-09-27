#!/usr/bin/env node
// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/** THROWAWAY — identifica con clases los targets pequeños restantes. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = '/Users/josecampos/Documents/CerebroFran/delivery-app';
const MID = process.env.PROBE_MERCHANT_ID;
const PW = '/usr/local/lib/node_modules/omniroute/node_modules/playwright';
const CHROME =
  '/Users/josecampos/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const PASSWORD = '123456';
async function waitFor(url, tries = 90) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return true; } catch {} await sleep(500); } return false;
}
const procs = [
  spawn('node', ['dist/main.js'], { cwd: `${ROOT}/api`, env: { ...process.env, PORT: '4000' }, stdio: 'ignore' }),
  spawn('npx', ['next', 'start', '-p', '3002'], { cwd: `${ROOT}/apps/client`, stdio: 'ignore' }),
  spawn('npx', ['next', 'start', '-p', '3000'], { cwd: `${ROOT}/apps/web`, stdio: 'ignore' }),
];
try {
  await waitFor('http://localhost:4000/api/health');
  for (const p of [3002, 3000]) await waitFor(`http://localhost:${p}/`);
  const tokens = {};
  for (const [role, email] of [['merchant', 'luis@kiwi.app']]) {
    const r = await fetch('http://localhost:4000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
    const d = await r.json().catch(() => ({}));
    tokens[role] = d.access_token || d.token || d.accessToken;
  }
  const { chromium } = await import(`${PW}/index.mjs`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  const pages = [
    { url: `http://localhost:3002/menu/${MID}`, tok: null },
    { url: `http://localhost:3000/drivers`, tok: tokens.merchant },
    { url: `http://localhost:3000/notifications`, tok: tokens.merchant, extraSleep: 3000 },
  ];
  for (const t of pages) {
    const page = await ctx.newPage();
    if (t.tok) await page.addInitScript(([k]) => localStorage.setItem('kiwi_token', k), [t.tok]);
    await page.goto(t.url, { waitUntil: 'domcontentloaded' });
    await sleep(2500 + (t.extraSleep || 0));
    const list = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button, a, input').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 4 && r.height > 4 && r.height < 38 && r.width < window.innerWidth) {
          out.push({
            tag: el.tagName.toLowerCase(),
            size: `${Math.round(r.width)}x${Math.round(r.height)}`,
            text: (el.textContent || el.placeholder || '').trim().slice(0, 24),
            cls: String(el.className).split(' ').filter((c) => /h-|py-|text-|min-h|w-/.test(c)).slice(0, 6).join(' '),
          });
        }
      });
      return out.slice(0, 12);
    });
    console.log('\n==', t.url.replace('http://localhost:', ''), '==');
    list.forEach((e) => console.log(` ${e.size.padEnd(10)} <${e.tag}> "${e.text}" [${e.cls}]`));
    await page.close();
  }
  await browser.close();
} finally {
  procs.forEach((p) => p.kill('SIGKILL'));
  await sleep(300);
}
process.exit(0);
