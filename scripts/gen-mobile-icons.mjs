// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Genera los íconos/splash de marca para las apps móviles a partir de
 * packages/ui/assets/kiwi-icon.svg (misma obra que el favicon web).
 * Correr: node scripts/gen-mobile-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const svg = readFileSync(`${ROOT}packages/ui/assets/kiwi-icon.svg`);
const BG = { r: 0x0b, g: 0x13, b: 0x26, alpha: 1 }; // Midnight Canvas (#0b1326)
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const render = (size) => sharp(svg, { density: 72 }).resize(size, size).png().toBuffer();

const solid = (size, background) =>
  sharp({ create: { width: size, height: size, channels: 4, background } }).png().toBuffer();

async function onBackground(size, innerRatio, background) {
  const inner = Math.round(size * innerRatio);
  const kiwi = await render(inner);
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: kiwi, gravity: 'center' }])
    .png()
    .toBuffer();
}

/** Silueta de un solo color (blanco) sobre transparente, para el monochrome de Android. */
async function monochrome(size, innerRatio) {
  const inner = Math.round(size * innerRatio);
  const { data, info } = await sharp(await render(inner))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a > 24) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = a;
    }
  }
  const mono = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: TRANSPARENT } })
    .composite([{ input: mono, gravity: 'center' }])
    .png()
    .toBuffer();
}

const APPS = ['driver-mobile', 'client-mobile', 'merchant-mobile'];

for (const app of APPS) {
  const dir = `${ROOT}apps/${app}/assets`;
  // App icon (full-bleed dark square, kiwi centered with breathing room).
  writeFileSync(`${dir}/icon.png`, await onBackground(1024, 0.68, BG));
  // Android adaptive: foreground (transparent, safe zone) + solid background.
  writeFileSync(`${dir}/android-icon-foreground.png`, await onBackground(1024, 0.6, TRANSPARENT));
  writeFileSync(`${dir}/android-icon-background.png`, await solid(1024, BG));
  writeFileSync(`${dir}/android-icon-monochrome.png`, await monochrome(1024, 0.6));
  // Splash + favicon.
  writeFileSync(`${dir}/splash-icon.png`, await onBackground(1024, 0.55, TRANSPARENT));
  writeFileSync(`${dir}/favicon.png`, await onBackground(48, 0.86, TRANSPARENT));
  console.log(`✓ ${app} assets generados`);
}
