// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface DeliveryPointMapProps {
  lat?: number | null;
  lng?: number | null;
  onPick: (lat: number, lng: number) => void;
  /** Zona detectada por el formulario: se muestra junto al pin con su precio. */
  zoneLabel?: string | null;
  zonePrice?: number | null;
  height?: number;
  className?: string;
}

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Escapa el nombre de la zona antes de meterlo en el HTML del pin. */
const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let L: any = null;

/**
 * Mapa para marcar el punto exacto de entrega: tocar pone/mueve el pin,
 * también se puede arrastrar. El padre guarda lat/lng que viajan en el
 * pedido para que el repartidor navegue hasta ahí.
 */
export function DeliveryPointMap({
  lat,
  lng,
  onPick,
  zoneLabel,
  zonePrice,
  height = 280,
  className = '',
}: DeliveryPointMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;
    let tilesOk = false;
    let failTimer: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      try {
        L = await import('leaflet');
        if (cancelled || !mapRef.current) return;

        const center: [number, number] =
          hasPoint && Number.isFinite(lat) && Number.isFinite(lng)
            ? [lat as number, lng as number]
            : [10.14828, -85.45201];
        const map = L.map(mapRef.current, {
          center,
          zoom: hasPoint ? 16 : 13,
          zoomControl: false,
          attributionControl: false,
        });

        const layer = L.tileLayer(OSM_URL, {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        });
        layer.on('tileload', () => {
          tilesOk = true;
        });
        layer.addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        map.on('click', (e: any) => {
          const { lat: clat, lng: clng } = e.latlng ?? {};
          if (Number.isFinite(clat) && Number.isFinite(clng)) onPickRef.current?.(clat, clng);
        });

        failTimer = setTimeout(() => {
          if (!cancelled && !tilesOk) setMapError('El mapa no cargó. Revisá tu conexión.');
        }, 10000);

        mapInstanceRef.current = map;
        setReady(true);
      } catch (err) {
        console.error('DeliveryPointMap init failed:', err);
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
      if (markerRef.current) markerRef.current = null;
      setReady(false);
    };
    // Solo al montar / reintentar: el pin se sincroniza en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  useEffect(() => {
    if (!mapInstanceRef.current || !L || !ready) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const point: [number, number] = [lat as number, lng as number];
    // Pin propio de Kiwi (divIcon: sin imágenes externas que se rompan con
    // el bundler como el marcador default de Leaflet).
    const kiwiIcon = L.divIcon({
      html:
        '<div style="display:flex;flex-direction:column;align-items:center;">' +
        '<div style="background:linear-gradient(135deg,#4ade80,#15803d);width:40px;height:40px;' +
        'border-radius:9999px;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.35);' +
        'display:flex;align-items:center;justify-content:center;font-size:22px;line-height:1;">🥝</div>' +
        '<div style="width:4px;height:10px;background:#15803d;border-radius:2px;"></div></div>',
      className: 'kiwi-delivery-pin',
      iconSize: [44, 52],
      iconAnchor: [22, 50],
    });
    const tip =
      zoneLabel && zonePrice != null
        ? `${zoneLabel} · ₡${Number(zonePrice).toLocaleString()}`
        : zoneLabel
          ? zoneLabel
          : null;
    if (!markerRef.current) {
      markerRef.current = L.marker(point, { draggable: true, icon: kiwiIcon }).addTo(
        mapInstanceRef.current,
      );
      markerRef.current.on('dragend', () => {
        const p = markerRef.current?.getLatLng();
        if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
          onPickRef.current?.(p.lat, p.lng);
      });
    } else {
      markerRef.current.setLatLng(point);
      markerRef.current.setIcon(kiwiIcon);
    }
    // Etiqueta de zona/precio pegada al pin (se actualiza con cada pick).
    try {
      markerRef.current.unbindTooltip();
    } catch {
      // sin tooltip previo: nada que soltar
    }
    if (tip) {
      markerRef.current.bindTooltip(escHtml(tip), {
        permanent: true,
        direction: 'top',
        offset: [0, -52],
        className: 'kiwi-pin-tip',
      });
    }
    mapInstanceRef.current.setView(point, Math.max(mapInstanceRef.current.getZoom(), 15), {
      animate: true,
    });
  }, [ready, lat, lng, zoneLabel, zonePrice]);

  if (mapError) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-surface-100 dark:bg-surface-800 ${className}`}
        style={{ height }}
      >
        <div className="px-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-surface-500 dark:text-surface-400" />
          <p className="mb-3 text-sm text-surface-500">{mapError}</p>
          <button
            className="rounded-xl bg-kiwi-700 px-4 py-2 text-sm font-semibold text-white"
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
          <p className="text-sm text-surface-500">Cargando mapa…</p>
        </div>
      )}
      {zoneLabel != null && zoneLabel !== '' && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-surface-900/90 dark:bg-white/95 px-3 py-1 text-[11px] font-bold text-white dark:text-surface-900 shadow">
          📍 {zoneLabel}
          {zonePrice != null ? ` · ₡${Number(zonePrice).toLocaleString()}` : ''}
        </div>
      )}
      <p className="absolute bottom-2 left-2 rounded-lg bg-white/85 dark:bg-surface-900/85 px-2 py-0.5 text-[10px] text-surface-500 backdrop-blur">
        Tocá el mapa para mover el pin ·{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted hover:text-kiwi-700 dark:hover:text-kiwi-400"
        >
          © OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}

export default DeliveryPointMap;
