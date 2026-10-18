// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
// Iconos del mapa: kiwi para negocios/zonas, moto para repartidores.

const PING_CSS = `<style>@keyframes kiwi-ping{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.25);opacity:0}}</style>`;

/** Marcador kiwi (negocios y puntos de zona). `pulse` = anillo verde vivo. */
export function kiwiIcon(L: any, opts?: { size?: number; pulse?: boolean; dimmed?: boolean }) {
  const size = opts?.size ?? 34;
  const ring = opts?.pulse
    ? `<span style="position:absolute;inset:-6px;border-radius:999px;border:3px solid #22c55e;opacity:.8;animation:kiwi-ping 1.6s ease-out infinite;"></span>${PING_CSS}`
    : '';
  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;${opts?.dimmed ? 'opacity:.45;filter:grayscale(.6);' : ''}">${ring}<img src="/kiwi.svg" alt="Kiwi" style="width:100%;height:100%;display:block;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);background:#fff;"/></div>`,
    className: 'kiwi-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const MOTO_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1" fill="#fff"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;

/** Marcador moto (repartidores): círculo verde con bici blanca. */
export function motoIcon(L: any, opts?: { size?: number; pulse?: boolean; dimmed?: boolean }) {
  const size = opts?.size ?? 36;
  const ring = opts?.pulse
    ? `<span style="position:absolute;inset:-6px;border-radius:999px;border:3px solid #22c55e;opacity:.8;animation:kiwi-ping 1.6s ease-out infinite;"></span>${PING_CSS}`
    : '';
  const icon = Math.round(size * 0.58);
  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;${opts?.dimmed ? 'opacity:.45;filter:grayscale(.6);' : ''}">${ring}<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);background:#16a34a;"><span style="display:inline-flex;width:${icon}px;height:${icon}px;">${MOTO_SVG}</span></span></div>`,
    className: 'moto-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
