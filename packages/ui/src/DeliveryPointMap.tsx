// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface DeliveryPointMapProps {
  lat?: number | null;
  lng?: number | null;
  onPick: (lat: number, lng: number) => void;
  height?: number;
  className?: string;
}

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

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
    if (!markerRef.current) {
      markerRef.current = L.marker(point, { draggable: true }).addTo(mapInstanceRef.current);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current?.getLatLng();
        if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
          onPickRef.current?.(p.lat, p.lng);
      });
    } else {
      markerRef.current.setLatLng(point);
    }
    mapInstanceRef.current.setView(point, Math.max(mapInstanceRef.current.getZoom(), 15), {
      animate: true,
    });
  }, [ready, lat, lng]);

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
