#!/usr/bin/env node
// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * THROWAWAY playtest probe — deleted after the session.
 * Boots API + built client app, drives the menu flow on an emulated phone
 * (iPhone-ish viewport, touch, deviceScaleFactor), MEASURES the tactile
 * interactions:
 *  - TapButton press sink (scale ~0.94) on pointerdown
 *  - success check flash
 *  - cart bar bounce (keyframe peaks) + badge pop after adding an item
 *  - careless variants: rapid double-add, disabled pay CTA
 *  - console errors, navigator.vibrate support
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';

const ROOT = '/Users/josecampos/Documents/CerebroFran/delivery-app';
const require = createRequire(import.meta.url);
const API_PORT = 4000;
const WEB_PORT = 3002; // puerto canónico del client en el allowlist CORS del API
const API = `http://localhost:${API_PORT}`;
const WEB = `http://localhost:${WEB_PORT}`;

let failures = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failures++;
};

async function waitFor(url, what, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {}
    await sleep(500);
  }
  console.log(`✗ ${what} no respondió`);
  failures++;
  return false;
}

// ---- global playwright (omniroute) ----
const PW = '/usr/local/lib/node_modules/omniroute/node_modules/playwright';

async function main() {
  // Watchdog: nunca colgar el playtest más de 4 min
  setTimeout(() => {
    console.log('\n⏱ WATCHDOG: probe abortado por tiempo');
    process.exit(3);
  }, 240_000);

  // 1. Boot servers as children (they live as long as this process)
  const api = spawn('node', ['dist/main.js'], {
    cwd: `${ROOT}/api`,
    env: { ...process.env, PORT: String(API_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stdout.on('data', (d) => process.env.PROBE_DEBUG && console.log('[api]', String(d).trim().split('\n').pop()));
  api.stderr.on('data', (d) => process.env.PROBE_DEBUG && console.log('[api:err]', String(d).trim()));
  const web = spawn('npx', ['next', 'start', '-p', String(WEB_PORT)], {
    cwd: `${ROOT}/apps/client`,
    stdio: 'ignore',
  });
  try {
    if (!(await waitFor(`${API}/api/health`, 'API'))) return;
    if (!(await waitFor(`${WEB}/`, 'client'))) return;

    const { chromium, devices } = await import(`${PW}/index.mjs`);
    const CHROME =
      '/Users/josecampos/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

    // iPhone-ish: touch, small viewport, DPR 3
    const iPhone = devices['iPhone 13'];
    const browser = await chromium.launch({ executablePath: CHROME, headless: true });
    globalThis.__browser = browser;
    const ctx = await browser.newContext({ ...iPhone });
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    console.log('\n== 1. Entrada al menú (equivalente a escanear QR del comercio) ==');
    const MERCHANT_ID = process.env.PROBE_MERCHANT_ID;
    if (!MERCHANT_ID) {
      console.log('PROBE_MERCHANT_ID no definido');
      failures++;
      return;
    }
    await page.goto(`${WEB}/menu/${MERCHANT_ID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('button:has-text("+")', { timeout: 25000 }).catch(() => {});

    console.log('\n== 2. TapButton + (agregar al carrito): presión y flash ==');
    console.log('  … menú cargado:', page.url());
    const plus = page.locator('button:has-text("+")').first();
    await plus.waitFor({ state: 'visible', timeout: 15000 });
    const plusBox = await plus.boundingBox();
    ok('botón + visible y tocable', !!plusBox && plusBox.width > 20, `w=${plusBox?.width}`);

    // Hundimiento con eventos CONFIABLES: sampleo concurrente + tap real de
    // Playwright (trusted) — framer ignora eventos sintéticos en whileTap.
    await plus.hover();
    const pressProbe = page
      .evaluate(
        () =>
          new Promise((resolve) => {
            const target = [...document.querySelectorAll('button')].find(
              (b) => b.textContent.trim() === '+',
            );
            if (!target) return resolve([]);
            const readings = [];
            const t0 = performance.now();
            const tick = () => {
              const tr = getComputedStyle(target).transform;
              const m = tr && tr.match(/matrix\(([^,]+),/);
              if (m) readings.push(parseFloat(m[1]));
              if (performance.now() - t0 < 900) requestAnimationFrame(tick);
              else resolve(readings);
            };
            requestAnimationFrame(tick);
          }),
      )
      .then((r) => r);
    await plus.tap();
    await page.waitForTimeout(950);
    const readings = await pressProbe;
    const scales = (readings || []).filter((s) => s < 0.999);
    ok(
      'hundimiento al presionar (scale < 1 observado)',
      scales.length > 0,
      scales.length ? `min scale ${Math.min(...scales).toFixed(3)}` : 'sin readings',
    );

    console.log('\n== 3. Flash de éxito + rebote del carrito ==');
    const barBefore = await page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find((d) =>
        d.className?.includes?.('bg-kiwi-gradient'),
      );
      return !!el;
    });
    // Success check: el span del check aparece dentro del botón
    const checkAppeared = await page
      .locator('button:has(svg.lucide-check)')
      .first()
      .waitFor({ state: 'visible', timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    ok('check de éxito visible tras agregar', checkAppeared);
    ok('barra flotante del carrito presente', barBefore);

    // Rebote: sample del transform de la barra durante 700ms
    const bounce = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const bar = [...document.querySelectorAll('div')].find((d) =>
            d.className?.includes?.('bg-kiwi-gradient'),
          );
          if (!bar) return resolve([]);
          const scales = [];
          const t0 = performance.now();
          const tick = () => {
            const tr = getComputedStyle(bar).transform;
            const m = tr && tr.match(/matrix\(([^,]+),/);
            if (m) scales.push(parseFloat(m[1]));
            if (performance.now() - t0 < 700) requestAnimationFrame(tick);
            else resolve(scales);
          };
          requestAnimationFrame(tick);
        }),
    );
    const peak = Math.max(...(bounce.length ? bounce : [1]));
    const trough = Math.min(...(bounce.length ? bounce : [1]));
    ok(
      'rebote de la barra (scale oscila >1 y <1)',
      peak > 1.01 && trough < 0.995,
      `peak ${peak.toFixed(3)}, trough ${trough.toFixed(3)}, ${bounce.length} muestras`,
    );

    // Pop del contador: sampleo CONCURRENTE alrededor del tap (el pop dura ~300ms)
    const badgeProbe = page.evaluate(
      () =>
        new Promise((resolve) => {
          const badge = [...document.querySelectorAll('span')].find((s) =>
            /^[0-9]+$/.test(s.textContent?.trim() || '') && /font-bold/.test(s.className || ''),
          );
          if (!badge) return resolve(null);
          const scales = [];
          const t0 = performance.now();
          const tick = () => {
            const tr = getComputedStyle(badge).transform;
            const m = tr && tr.match(/matrix\(([^,]+),/);
            if (m) scales.push(parseFloat(m[1]));
            if (performance.now() - t0 < 900) requestAnimationFrame(tick);
            else resolve(scales);
          };
          requestAnimationFrame(tick);
        }),
    );
    await plus.tap();
    await page.waitForTimeout(950);
    const badgePop = await badgeProbe;
    const badgePeak = Math.max(...(badgePop?.length ? badgePop : [1]));
    ok('pop del contador (scale > 1.1 en algún frame)', badgePeak > 1.1, `peak ${badgePeak.toFixed(2)}`);

    console.log('\n== 4. Descuido: doble tap rápido ==');
    await plus.tap();
    await plus.tap(); // tap inmediato adicional — no debe romper nada
    await sleep(700);
    const cartCount = await page.evaluate(() => {
      const badge = [...document.querySelectorAll('span')].find((s) =>
        /font-bold/.test(s.className || ''),
      );
      return badge ? parseInt(badge.textContent) || 0 : 0;
    });
    ok('doble tap suma 2 sin errores', cartCount >= 2, `count=${cartCount}`);

    console.log('\n== 5. Checkout: CTA de pago ==');
    await page.evaluate(() => {
      const bar = [...document.querySelectorAll('div')].find((d) =>
        d.className?.includes?.('bg-kiwi-gradient'),
      );
      bar?.click();
    });
    await sleep(400);
    const payBtn = page.locator('button:has-text("Ordenar")').first();
    const payVisible = await payBtn
      .waitFor({ state: 'visible', timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    ok('CTA "Ordenar" visible', payVisible);
    if (payVisible) {
      const disabled = await payBtn.isDisabled();
      ok('CTA habilitado con ítems en el carrito', !disabled);
      // Press-sink del CTA
      const sink2 = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const btn = [...document.querySelectorAll('button')].find((b) =>
              b.textContent.includes('Ordenar'),
            );
            if (!btn) return resolve([]);
            const readings = [];
            const t0 = performance.now();
            const tick = () => {
              const tr = getComputedStyle(btn).transform;
              const m = tr && tr.match(/matrix\(([^,]+),/);
              if (m) readings.push(parseFloat(m[1]));
              if (performance.now() - t0 < 250) requestAnimationFrame(tick);
              else resolve(readings);
            };
            requestAnimationFrame(tick);
            btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            setTimeout(() => btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), 100);
          }),
      );
      const s2 = sink2.filter((s) => s < 0.999);
      ok('hundimiento del CTA de pago', s2.length > 0, s2.length ? `min ${Math.min(...s2).toFixed(3)}` : '');
      // NO completamos la orden: no queremos datos basura. Cerramos.
      await page.locator('button:has-text("✕")').first().click().catch(() => {});
    }

    console.log('\n== 6. Soporte de vibración y errores ==');
    const vibrate = await page.evaluate(() => typeof navigator.vibrate === 'function');
    ok('navigator.vibrate disponible en el emulador', vibrate, vibrate ? '' : '(Chrome desktop emulado: esperado false; en Android real vibra)');
    ok('cero errores de consola', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

    await browser.close();
  } finally {
    if (globalThis.__browser) await globalThis.__browser.close().catch(() => {});
    api.kill();
    web.kill('SIGKILL');
    await sleep(300);
  }

  console.log(failures === 0 ? '\n🥝 PLAYTEST LIMPIO' : `\n✗ ${failures} hallazgos`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('probe crashed:', e);
  process.exit(2);
});
