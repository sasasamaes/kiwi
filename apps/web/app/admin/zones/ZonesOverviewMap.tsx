// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useRef, useState } from 'react';
import { kiwiIcon } from './markers';
import { addStreetsAndSatellite } from '@kiwi/ui';

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
  description?: string | null;
  logoUrl?: string | null;
  category?: string | null;
  isHomeCook?: boolean | null;
  isOpen?: boolean | null;
  rating?: number | null;
  totalRatings?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

const CATEGORY_ES: Record<string, string> = {
  restaurante: 'Restaurante',
  soda: 'Soda',
  cafeteria: 'Cafetería',
  panaderia: 'Panadería',
  verduleria: 'Verdulería',
  carniceria: 'Carnicería',
  marisqueria: 'Marisquería',
  heladeria: 'Heladería',
  bar: 'Bar',
  supermercado: 'Supermercado',
  farmacia: 'Farmacia',
  otro: 'Otro',
};

export interface DriverLike {
  id: string;
  name: string;
  photoUrl?: string | null;
  vehicle?: string | null;
  vehiclePlate?: string | null;
  rating?: number | null;
  totalTrips?: number | null;
  status?: string | null;
  lat: number;
  lng: number;
  updatedAt?: string | Date | null;
}

/** Etiquetas en español para el popup (el API manda el enum crudo). */
const VEHICLE_ES: Record<string, string> = {
  motorcycle: 'Moto',
  motorized_bike: 'Bici moto',
  bicycle: 'Bici',
  car: 'Carro',
  walking: 'A pie',
};

const STATUS_ES: Record<string, string> = {
  available: 'Disponible',
  busy: 'Ocupado',
  offline: 'Offline',
};

/** Escape mínimo: el nombre/placa van dentro de HTML del popup. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BIKE_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';

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
  const staticLayerRef = useRef<any>(null);
  const driversLayerRef = useRef<any>(null);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Vista persistente: el mapa se queda donde el admin lo dejó (zoom/pan),
  // incluso entre recargas. Sin vista guardada se encuadra a los datos una vez.
  const VIEW_KEY = 'kiwi-zones-view';
  const readSavedView = (): { lat: number; lng: number; zoom: number } | null => {
    try {
      const raw = window.localStorage.getItem(VIEW_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (!Number.isFinite(v?.lat) || !Number.isFinite(v?.lng) || !Number.isFinite(v?.zoom)) {
        return null;
      }
      return { lat: v.lat, lng: v.lng, zoom: Math.min(Math.max(v.zoom, 3), 18) };
    } catch {
      return null;
    }
  };

  // Init (client-only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod: any = await import('leaflet');
      const L = mod.default ?? mod;
      if (cancelled || !ref.current || mapRef.current) return;
      const saved = readSavedView();
      const map = L.map(ref.current).setView(
        saved ? [saved.lat, saved.lng] : [10.1467, -85.452],
        saved ? saved.zoom : 12,
      );
      if (saved) fittedRef.current = true;
      addStreetsAndSatellite(map, L);
      map.on('moveend zoomend', () => {
        try {
          const c = map.getCenter();
          window.localStorage.setItem(
            VIEW_KEY,
            JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }),
          );
        } catch {
          // sin storage: la vista igual se mantiene en la sesión
        }
      });
      LRef.current = L;
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Capa ESTÁTICA (zonas + negocios): solo se redibuja si cambian los datos.
  // El encuadre inicial se hace UNA vez: el polling de repartidores ya no
  // mueve ni resetea la vista mientras se mira el mapa.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (staticLayerRef.current) staticLayerRef.current.remove();
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

    // Negocios con la marca Kiwi (ficha: tipo, estado, rating).
    for (const m of merchants) {
      const lat = Number(m.latitude);
      const lng = Number(m.longitude);
      if (!sane(lat, lng)) continue;
      const kindTxt = m.isHomeCook
        ? 'Comida casera'
        : (m.category && CATEGORY_ES[m.category]) || m.category || 'Comercio';
      const openTxt = m.isOpen == null ? null : m.isOpen ? 'Abierto ahora' : 'Cerrado ahora';
      const openColor = m.isOpen ? '#15803d' : '#71717a';
      const logo = m.logoUrl
        ? `<img src="${esc(m.logoUrl)}" alt="" style="width:36px;height:36px;border-radius:10px;object-fit:cover;flex:none;background:#fbf8f2">`
        : `<img src="/kiwi.svg" alt="Kiwi" style="width:36px;height:36px;border-radius:10px;flex:none;background:#fbf8f2">`;
      const ratingTxt =
        m.rating != null && Number.isFinite(Number(m.rating))
          ? `★ ${Number(m.rating).toFixed(1)}${m.totalRatings != null ? ` (${Number(m.totalRatings)})` : ''}`
          : null;
      const desc =
        m.description && String(m.description).trim()
          ? esc(String(m.description).trim().slice(0, 110)) +
            (String(m.description).trim().length > 110 ? '…' : '')
          : null;
      L.marker([lat, lng], { icon: kiwiIcon(L, { size: 28 }) })
        .bindPopup(
          `<div style="display:flex;gap:8px;align-items:center;min-width:210px;max-width:260px">` +
            logo +
            `<div style="min-width:0"><b style="font-size:13px">${esc(m.businessName)}</b>` +
            `<div style="margin-top:2px"><span style="display:inline-block;font-size:10px;font-weight:700;background:#eef7fb;color:#195a77;border-radius:9999px;padding:1px 8px">${esc(kindTxt)}</span>` +
            (openTxt
              ? ` <span style="font-size:11px;font-weight:600;color:${openColor}">● ${esc(openTxt)}</span>`
              : '') +
            `</div></div></div>` +
            (m.address
              ? `<div style="margin-top:6px;font-size:12px;color:#3f3f46">${esc(m.address)}</div>`
              : '') +
            (desc ? `<div style="margin-top:4px;font-size:11px;color:#71717a">${desc}</div>` : '') +
            (ratingTxt
              ? `<div style="margin-top:4px;font-size:11px;font-weight:600;color:#b45309">${esc(ratingTxt)}</div>`
              : ''),
        )
        .bindTooltip(m.businessName)
        .addTo(layer);
      points.push([lat, lng]);
    }

    if (!fittedRef.current && points.length) {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 13 });
      fittedRef.current = true;
    }
    staticLayerRef.current = layer;
  }, [zones, merchants, ready]);

  // Capa DINÁMICA (repartidores en vivo): se redibuja en cada polling SIN
  // tocar la vista (sin fitBounds) ni la capa estática.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (driversLayerRef.current) driversLayerRef.current.remove();
    const layer = L.layerGroup().addTo(map);
    const sane = (lat: number, lng: number) =>
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= 7 &&
      lat <= 12 &&
      lng >= -88 &&
      lng <= -82;

    // Repartidores en vivo: kiwi con pulso; apagado si el ping es viejo.
    for (const d of drivers) {
      if (!sane(d.lat, d.lng)) continue;
      const age = ageMin(d.updatedAt);
      const stale = age == null || age > 5;
      const ageTxt = age == null ? 'sin hora' : age < 1 ? 'ahora mismo' : `hace ${age} min`;
      const vehicleTxt = (d.vehicle && VEHICLE_ES[d.vehicle]) || d.vehicle || 'Vehículo';
      const statusTxt = (d.status && STATUS_ES[d.status]) || d.status || '';
      const avatar = d.photoUrl
        ? `<img src="${esc(d.photoUrl)}" alt="" style="width:36px;height:36px;border-radius:9999px;object-fit:cover;flex:none;background:#eef7fb">`
        : `<img src="/kiwi.svg" alt="Kiwi" style="width:36px;height:36px;border-radius:9999px;flex:none;background:#eef7fb">`;
      const ratingTxt =
        d.rating != null && Number.isFinite(Number(d.rating))
          ? `★ ${Number(d.rating).toFixed(1)}`
          : null;
      L.marker([d.lat, d.lng], { icon: kiwiIcon(L, { size: 34, pulse: !stale, dimmed: stale }) })
        .bindPopup(
          `<div style="display:flex;gap:8px;align-items:center;min-width:210px;max-width:260px">` +
            avatar +
            `<div style="min-width:0"><b style="font-size:13px">${esc(d.name)}</b>` +
            (statusTxt
              ? `<div style="font-size:11px;color:${stale ? '#71717a' : '#195a77'};font-weight:600">${esc(statusTxt)} · GPS ${esc(ageTxt)}</div>`
              : `<div style="font-size:11px;color:#71717a">GPS ${esc(ageTxt)}</div>`) +
            `</div></div>` +
            `<div style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#3f3f46">` +
            `<span style="display:inline-flex;color:#195a77">${BIKE_SVG}</span>` +
            `<span>${esc(vehicleTxt)}</span>` +
            (d.vehiclePlate
              ? `<span style="font-family:monospace;font-size:11px;font-weight:700;background:#f4f4f5;border-radius:6px;padding:1px 6px">${esc(d.vehiclePlate)}</span>`
              : '') +
            `</div>` +
            (ratingTxt || d.totalTrips != null
              ? `<div style="margin-top:4px;font-size:11px;color:#71717a">` +
                (ratingTxt ? esc(ratingTxt) : '') +
                (ratingTxt && d.totalTrips != null ? ' · ' : '') +
                (d.totalTrips != null
                  ? `${Number(d.totalTrips)} viaje${Number(d.totalTrips) === 1 ? '' : 's'}`
                  : '') +
                `</div>`
              : ''),
        )
        .bindTooltip(`${d.name} · ${ageTxt}`)
        .addTo(layer);
    }

    driversLayerRef.current = layer;
  }, [drivers, ready]);

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
