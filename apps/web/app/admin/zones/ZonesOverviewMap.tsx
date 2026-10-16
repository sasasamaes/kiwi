// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useRef, useState } from 'react';

export interface ZoneLike {
  id: string;
  label: string;
  price: number;
  latitude?: number | null;
  longitude?: number | null;
  geometry?: { type: 'Polygon' | 'MultiPolygon'; coordinates: any } | null;
  active?: boolean;
}

/** Color por tramo de precio (verde barato → rojo caro). */
function tierColor(price: number): string {
  if (price <= 1000) return '#15803d';
  if (price <= 2000) return '#22c55e';
  if (price <= 4000) return '#f59e0b';
  return '#dc2626';
}

/**
 * Mapa general: TODAS las zonas con su precio (punto de referencia con ₡) y,
 * si tienen, su polígono coloreado por tramo de precio. Para ver el panorama,
 * no para editar.
 */
export function ZonesOverviewMap({ zones, height = 440 }: { zones: ZoneLike[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Init (client-only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod: any = await import('leaflet');
      const L = mod.default ?? mod;
      if (cancelled || !ref.current || mapRef.current) return;
      const map = L.map(ref.current).setView([10.1467, -85.452], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      LRef.current = L;
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // (Re)dibuja cuando cambian las zonas o el mapa está listo.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (layerRef.current) layerRef.current.remove();
    const layer = L.layerGroup().addTo(map);
    const points: number[][] = [];

    for (const z of zones) {
      const color = tierColor(Number(z.price));
      const price = `₡${Number(z.price).toLocaleString()}`;

      // Polígono (si tiene) coloreado por precio.
      const g = z.geometry;
      if (g) {
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
        for (const poly of polys) {
          const rings = (poly as number[][][]).map((ring) => ring.map(([lng, lat]) => [lat, lng]));
          L.polygon(rings, { color, weight: 2, fillOpacity: 0.2 })
            .bindPopup(`<b>${z.label}</b><br>Envío ${price}`)
            .addTo(layer);
          (rings[0] ?? []).forEach((p: number[]) => points.push(p));
        }
      }

      // Punto de referencia con el precio.
      if (Number.isFinite(z.latitude as number) && Number.isFinite(z.longitude as number)) {
        const icon = L.divIcon({
          html: `<div style="background:${color};color:#fff;font-size:11px;font-weight:800;padding:3px 7px;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);white-space:nowrap;">${price}</div>`,
          className: 'zone-price-marker',
          iconSize: undefined,
        });
        L.marker([Number(z.latitude), Number(z.longitude)], { icon })
          .bindPopup(`<b>${z.label}</b><br>Envío ${price}`)
          .addTo(layer);
        points.push([Number(z.latitude), Number(z.longitude)]);
      }
    }

    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 13 });
    layerRef.current = layer;
  }, [zones, ready]);

  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-2xl" />;
}
