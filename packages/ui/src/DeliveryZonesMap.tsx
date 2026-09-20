'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { NICOYA_DELIVERY_ZONES } from '@kiwi/types';

interface DeliveryZonesMapProps {
  selectedId?: string;
  onSelect?: (zoneId: string) => void;
  height?: number;
  className?: string;
}

const CARTO_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Color por tarifa para leer el mapa de un vistazo. */
function tierColor(price: number): string {
  if (price <= 1500) return '#22c55e';
  if (price <= 2500) return '#f59e0b';
  if (price <= 5000) return '#f97316';
  return '#ef4444';
}

let L: any = null;

/**
 * Mapa de zonas de entrega: un marcador con precio por zona.
 * Los puntos son REFERENCIA (no límites del barrio): al tocar un marcador
 * se sugiere esa zona, pero la confirmación final es del comercio.
 */
export function DeliveryZonesMap({
  selectedId,
  onSelect,
  height = 300,
  className = '',
}: DeliveryZonesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;
    let tilesOk = false;
    let failTimer: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      try {
        L = await import('leaflet');
        await import('leaflet/dist/leaflet.css' as string);
        if (cancelled || !mapRef.current) return;

        const map = L.map(mapRef.current, {
          center: [10.14828, -85.45201],
          zoom: 12,
          zoomControl: false,
          attributionControl: false,
        });

        const primary = L.tileLayer(CARTO_URL, {
          maxZoom: 20,
          subdomains: 'abcd',
          attribution: '© OpenStreetMap contributors © CARTO',
        });
        primary.on('tileload', () => {
          tilesOk = true;
        });
        primary.on('tileerror', () => {
          try {
            map.removeLayer(primary);
            L.tileLayer(OSM_URL, {
              maxZoom: 19,
              attribution: '© OpenStreetMap contributors',
            }).addTo(map);
          } catch {
            /* noop */
          }
        });
        primary.addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        failTimer = setTimeout(() => {
          if (!cancelled && !tilesOk) setMapError('El mapa no cargó. Revisá tu conexión.');
        }, 10000);

        mapInstanceRef.current = map;
        setReady(true);
      } catch (err) {
        console.error('DeliveryZonesMap init failed:', err);
        if (!cancelled) setMapError('No se pudo cargar el mapa');
      }
    };

    init();
    return () => {
      cancelled = true;
      if (failTimer) clearTimeout(failTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setReady(false);
    };
  }, [retryKey]);

  useEffect(() => {
    if (!mapInstanceRef.current || !L || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = L.latLngBounds([]);
    for (const z of NICOYA_DELIVERY_ZONES) {
      if (!Number.isFinite(z.latitude) || !Number.isFinite(z.longitude)) continue;
      const color = tierColor(z.price);
      const selected = z.id === selectedId;
      const icon = L.divIcon({
        html: `<div style="
          background: ${color};
          color: white;
          font-size: 11px;
          font-weight: 800;
          padding: 4px 8px;
          border-radius: 999px;
          border: ${selected ? '3px solid #1f2937' : '2px solid white'};
          box-shadow: 0 2px 8px rgba(0,0,0,.35);
          white-space: nowrap;
          ${selected ? 'transform: scale(1.15);' : ''}
        ">₡${z.price.toLocaleString()}</div>`,
        className: 'zone-price-marker',
        iconSize: undefined,
      });
      const marker = L.marker([z.latitude, z.longitude], { icon }).addTo(mapInstanceRef.current);
      marker.bindPopup(
        `<b>${z.label}</b><br>Envío ₡${z.price.toLocaleString()}<br><small>Punto de referencia, no límite del barrio</small>`,
      );
      marker.on('click', () => onSelectRef.current?.(z.id));
      markersRef.current.push(marker);
      bounds.extend([z.latitude, z.longitude]);
    }
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [ready, selectedId]);

  if (mapError) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-surface-100 dark:bg-surface-800 ${className}`}
        style={{ height }}
      >
        <div className="px-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-surface-400" />
          <p className="mb-3 text-sm text-surface-500">{mapError}</p>
          <button
            className="rounded-xl bg-kiwi-500 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => {
              setMapError(null);
              setRetryKey((k) => k + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ height }}>
      <div ref={mapRef} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-100 dark:bg-surface-800">
          <p className="text-sm text-surface-500">Cargando zonas…</p>
        </div>
      )}
      <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1.5">
        {[
          ['#22c55e', '≤ ₡1.500'],
          ['#f59e0b', '≤ ₡2.500'],
          ['#f97316', '≤ ₡5.000'],
          ['#ef4444', '+ ₡5.000'],
        ].map(([c, label]) => (
          <span
            key={label}
            className="flex items-center gap-1 rounded-full bg-white/95 dark:bg-surface-900/95 px-2 py-0.5 text-[10px] font-semibold text-surface-600 dark:text-surface-300 shadow"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: c }} />
            {label}
          </span>
        ))}
      </div>
      <p className="absolute bottom-2 left-2 rounded-lg bg-white/85 dark:bg-surface-900/85 px-2 py-0.5 text-[10px] text-surface-500 backdrop-blur">
        Puntos de referencia, no límites · © OSM · © CARTO
      </p>
    </div>
  );
}

export default DeliveryZonesMap;
