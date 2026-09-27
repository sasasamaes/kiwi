// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * THROWAWAY: rasteriza el SVG del kiwi a todos los tamaños de marca.
 * Correr: node scripts/tmp-generate-icons.mjs   (se borra al terminar)
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const svg = readFileSync(new URL('../packages/ui/assets/kiwi-icon.svg', import.meta.url));

// Favicon .ico: sharp no emite ICO; un ICO puede contener PNG crudo (32/48/64).
// El SVG es 512×512 intrínseco: density = 72 × (target/512) renderiza al target.
const D = (size) => 72 * (size / 512);

async function makeIco(sizes) {
  const pngs = await Promise.all(
    sizes.map((s) => sharp(svg, { density: D(s) }).resize(s, s).png().toBuffer()),
  );
  // Header ICO: reserved=0, type=1 (icono), count. Luego entradas de 16 bytes.
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = [];
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const e = Buffer.alloc(16);
    e.writeUInt8(s >= 256 ? 0 : s, 0);
    e.writeUInt8(s >= 256 ? 0 : s, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs]);
}

// PNG redondo con fondo transparente fuera del círculo.
async function png(size, rounded = true) {
  let pipe = sharp(svg, { density: D(size) }).resize(size, size);
  if (rounded) {
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${
        size / 2
      }" r="${size / 2}" fill="#fff"/></svg>`,
    );
    pipe = pipe.composite([{ input: mask, blend: 'dest-in' }]);
  }
  return pipe.png().toBuffer();
}

const ROOT = process.cwd();

// 1) favicon.ico (32/48/64) + icon.png 512 + apple-icon 180 para las 3 apps
const ico = await makeIco([32, 48, 64]);
const icon512 = await png(512);
const apple180 = await png(180);
for (const app of ['client', 'driver', 'web']) {
  writeFileSync(`${ROOT}/apps/${app}/public/favicon.ico`, ico);
  writeFileSync(`${ROOT}/apps/${app}/app/icon.png`, icon512);
  writeFileSync(`${ROOT}/apps/${app}/app/apple-icon.png`, apple180);
}

// 2) Set PWA del driver (manifest apunta a /icons/icon-*.png)
mkdirSync(`${ROOT}/apps/driver/public/icons`, { recursive: true });
for (const s of [72, 96, 128, 144, 152, 192, 384, 512]) {
  writeFileSync(`${ROOT}/apps/driver/public/icons/icon-${s}x${s}.png`, await png(s));
}
// Maskable: el contenido vive en el 80% central (safe zone)
for (const s of [192, 512]) {
  const inner = await sharp(await png(Math.round(s * 0.8))).toBuffer();
  writeFileSync(
    `${ROOT}/apps/driver/public/icons/icon-maskable-${s}x${s}.png`,
    await sharp({
      create: {
        width: s,
        height: s,
        channels: 4,
        background: '#22c55e',
      },
    })
      .composite([{ input: inner }])
      .png()
      .toBuffer(),
  );
}

console.log('icons generated OK');
