// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useRef, useState } from 'react';
import { kiwiIcon } from './markers';

export interface ZoneLike {
  id: string;
  label: string;
  price: number;
  latitude?: number | null;
  longitude?: number | null;
  geometry?: { type: 'Polygon' | 'MultiPolygon'; coordinates: any } | null;
  active?: boolean;
}

export interface MerchantLike {
  id: string;
  businessName: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DriverLike {
  id: string;
  name: string;
  vehicle?: string | null;
  status?: string | null;
  lat: number;
  lng: number;
  updatedAt?: string | Date | null;
}

/** Color por tramo de precio (verde barato → rojo caro). */
function tierColor(price: number): string {
  if (price <= 1000) return '#15803d';
  if (price <= 2000) return '#22c55e';
  if (price <= 4000) return '#f59e0b';
  return '#dc2626';
}

/** Minutos desde un timestamp (para "hace X min" del repartidor). */
function ageMin(updatedAt?: string | Date | null): number | null {
  if (!updatedAt) return null;
  const t = new Date(updatedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

/**
 * Mapa general: zonas (₡ + polígono), negocios y repartidores en vivo, todo
 * con la marca Kiwi. Encuadra lo cargado (Nicoya hoy, otra ciudad mañana);
 * sin datos arranca en Nicoya.
 */
export function ZonesOverviewMap({
  zones,
  merchants = [],
  drivers = [],
  height = 440,
}: {
  zones: ZoneLike[];
  merchants?: MerchantLike[];
  drivers?: DriverLike[];
  height?: number;
}) {
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

  // (Re)dibuja cuando cambian las capas o el mapa está listo.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (layerRef.current) layerRef.current.remove();
    const layer = L.layerGroup().addTo(map);
    const points: number[][] = [];
    // Para encuadrar solo cuentan puntos dentro de Costa Rica: un dato malo
    // (ej. 0,0) no debe volver a mandar la vista al Atlántico.
    const sane = (lat: number, lng: number) =>
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= 7 &&
      lat <= 12 &&
      lng >= -88 &&
      lng <= -82;

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
          (rings[0] ?? []).forEach((p: number[]) => {
            if (sane(p[0], p[1])) points.push(p);
          });
        }
      }

      // Punto de referencia: kiwi + pastilla de precio.
      if (Number.isFinite(z.latitude as number) && Number.isFinite(z.longitude as number)) {
        const lat = Number(z.latitude);
        const lng = Number(z.longitude);
        L.marker([lat, lng], { icon: kiwiIcon(L, { size: 30 }) })
          .bindPopup(`<b>${z.label}</b><br>Envío ${price}`)
          .bindTooltip(`${z.label} · ${price}`)
          .addTo(layer);
        if (sane(lat, lng)) points.push([lat, lng]);
      }
    }

    // Negocios con la marca Kiwi.
    for (const m of merchants) {
      const lat = Number(m.latitude);
      const lng = Number(m.longitude);
      if (!sane(lat, lng)) continue;
      L.marker([lat, lng], { icon: kiwiIcon(L, { size: 28 }) })
        .bindPopup(`<b>${m.businessName}</b>${m.address ? `<br>${m.address}` : ''}`)
        .bindTooltip(m.businessName)
        .addTo(layer);
      points.push([lat, lng]);
    }

    // Repartidores en vivo: kiwi con pulso; apagado si el ping es viejo.
    for (const d of drivers) {
      if (!sane(d.lat, d.lng)) continue;
      const age = ageMin(d.updatedAt);
      const stale = age == null || age > 5;
      const ageTxt = age == null ? 'sin hora' : age < 1 ? 'ahora mismo' : `hace ${age} min`;
      L.marker([d.lat, d.lng], { icon: kiwiIcon(L, { size: 34, pulse: !stale, dimmed: stale }) })
        .bindPopup(`<b>${d.name}</b>${d.vehicle ? ` · ${d.vehicle}` : ''}<br>GPS: ${ageTxt}`)
        .bindTooltip(`${d.name} · ${ageTxt}`)
        .addTo(layer);
      points.push([d.lat, d.lng]);
    }

    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 13 });
    layerRef.current = layer;
  }, [zones, merchants, drivers, ready]);

  return (
    <div className="relative">
      <div
        ref={ref}
        style={{ height }}
        className="relative z-0 isolate w-full overflow-hidden rounded-2xl"
      />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow">
        <span className="flex items-center gap-1">
          <img src="/kiwi.svg" alt="" className="h-4 w-4 rounded-full" /> Zonas ₡
        </span>
        <span className="flex items-center gap-1">
          <img src="/kiwi.svg" alt="" className="h-4 w-4 rounded-full" /> Negocios
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />{' '}
          Repartidores
          {drivers.length > 0 && ` (${drivers.length})`}
        </span>
      </div>
    </div>
  );
}
