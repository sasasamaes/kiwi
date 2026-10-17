// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
// Iconos del mapa con la marca Kiwi: el kiwi del logo como marcador.

/** Marcador kiwi. `pulse` = anillo verde vivo (repartidores en ruta). */
export function kiwiIcon(L: any, opts?: { size?: number; pulse?: boolean; dimmed?: boolean }) {
  const size = opts?.size ?? 34;
  const ring = opts?.pulse
    ? `<span style="position:absolute;inset:-6px;border-radius:999px;border:3px solid #22c55e;opacity:.8;animation:kiwi-ping 1.6s ease-out infinite;"></span><style>@keyframes kiwi-ping{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.25);opacity:0}}</style>`
    : '';
  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;${opts?.dimmed ? 'opacity:.45;filter:grayscale(.6);' : ''}">${ring}<img src="/kiwi.svg" alt="Kiwi" style="width:100%;height:100%;display:block;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);background:#fff;"/></div>`,
    className: 'kiwi-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
