// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, LocateFixed, Navigation } from 'lucide-react';

export interface DriverMapPoint {
  lat: number;
  lng: number;
  label?: string;
}

interface DriverMapProps {
  pickup?: DriverMapPoint | null;
  delivery?: DriverMapPoint | null;
  /** Próxima parada según el estado del pedido (Uber: siempre muestra a dónde vas) */
  target?: 'pickup' | 'delivery';
  targetLabel?: string;
  height?: number;
  className?: string;
}

// OpenStreetMap directo (sin key). CARTO ahora exige API key y sus
// mosaicos de error disparan tileload: el fallback nunca se enteraba.
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function haversineM(a: DriverMapPoint, b: DriverMapPoint): number {
  const R = 6371e3;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa =
    s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

/** Escapa texto para interpolar en popups Leaflet (direcciones con <>&). */
function esc(s?: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDist(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatEta(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  return `~${h} h ${mins % 60 ? `${mins % 60} min` : ''}`;
}

// ~30 km/h urbano en moto como estimación cuando OSRM no responde
function fallbackEtaSeconds(meters: number): number {
  return meters / (30_000 / 3600);
}

let L: any = null;

export function DriverMap({
  pickup,
  delivery,
  target = 'pickup',
  targetLabel,
  height = 340,
  className = '',
}: DriverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLineRef = useRef<any>(null);
  const overviewLineRef = useRef<any>(null);
  const driverRef = useRef<DriverMapPoint | null>(null);
  const fittedRef = useRef(false);

  const [driver, setDriver] = useState<DriverMapPoint | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [routeGeom, setRouteGeom] = useState<Array<[number, number]> | null>(null);
  const [routeMeta, setRouteMeta] = useState<{ distanceM: number; durationS: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [mapReady, setMapReady] = useState(false);

  const activeDest = target === 'pickup' ? pickup : delivery;

  // ---- 1. Inicializar mapa (una vez) ----
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;
    let failTimer: ReturnType<typeof setTimeout> | null = null;
    let tilesOk = false;

    const init = async () => {
      try {
        L = await import('leaflet');
        if (cancelled || !mapRef.current) return;

        const map = L.map(mapRef.current, {
          center: [10.14828, -85.45201], // Nicoya; se ajusta con fitBounds
          zoom: 13,
          zoomControl: false,
          attributionControl: false,
        });

        // Un tile suelto que falla es normal (404 de borde): el error
        // accionable sale solo si en 10s no cargó NADA.
        const layer = L.tileLayer(OSM_URL, {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        });
        layer.on('tileload', () => {
          tilesOk = true;
        });
        layer.addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        failTimer = setTimeout(() => {
          if (!cancelled && !tilesOk) {
            setMapError('El mapa no cargó. Revisá tu conexión e intentá de nuevo.');
          }
        }, 10000);

        mapInstanceRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error('DriverMap init failed:', err);
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
      setMapReady(false);
      fittedRef.current = false;
    };
  }, [retryKey]);

  // ---- 2. GPS en vivo tipo Uber (watchPosition) ----
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsDenied(true);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        driverRef.current = next;
        setDriver((prev) => {
          // Evita re-renders por micro-movimientos (<10m)
          if (prev && haversineM(prev, next) < 10) return prev;
          return next;
        });
        setGpsDenied(false);
      },
      () => setGpsDenied(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ---- 3. Marcadores: comercio / cliente / repartidor ----
  useEffect(() => {
    if (!mapInstanceRef.current || !L || !mapReady) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const mk = (html: string, size = 40) =>
      L.divIcon({
        html,
        className: 'driver-map-marker',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

    const bounds = L.latLngBounds([]);
    const dot = (color: string, inner: string) =>
      `<div style="background:${color};width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,.35);color:white;font-weight:bold;">${inner}</div>`;

    if (pickup) {
      const m = L.marker([pickup.lat, pickup.lng], {
        icon: mk(dot('#22c55e', '◈'), 40),
      })
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>Recoger</b><br>${esc(pickup.label)}`);
      markersRef.current.push(m);
      bounds.extend([pickup.lat, pickup.lng]);
    }
    if (delivery) {
      const m = L.marker([delivery.lat, delivery.lng], {
        icon: mk(dot('#f59e0b', '◎'), 40),
      })
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>Entregar</b><br>${esc(delivery.label)}`);
      markersRef.current.push(m);
      bounds.extend([delivery.lat, delivery.lng]);
    }
    if (driver) {
      const pulse = `<div style="position:relative;width:44px;height:44px;"><div style="position:absolute;inset:0;border-radius:50%;background:#3b82f633;border:2px solid #3b82f6;"></div><div style="position:absolute;inset:10px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);"></div></div>`;
      const m = L.marker([driver.lat, driver.lng], { icon: mk(pulse, 44), zIndexOffset: 1000 })
        .addTo(mapInstanceRef.current)
        .bindPopup('<b>Vos</b><br>Ubicación en vivo');
      markersRef.current.push(m);
      bounds.extend([driver.lat, driver.lng]);
    }

    if (bounds.isValid() && !fittedRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [56, 56] });
      fittedRef.current = true;
    }
  }, [pickup, delivery, driver, mapReady]);

  // ---- 4. Ruta real OSRM (driver -> destino) con fallback recto ----
  useEffect(() => {
    if (!activeDest) {
      setRouteGeom(null);
      setRouteMeta(null);
      return;
    }
    // Sin GPS aún: estima pickup->delivery solo como referencia
    const origin = driver ?? pickup;
    if (!origin) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      const straight = haversineM(origin, activeDest);
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 8000);
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${origin.lng},${origin.lat};${activeDest.lng},${activeDest.lat}` +
          `?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(to);
        if (!res.ok) throw new Error('osrm');
        const data = await res.json();
        const r = data?.routes?.[0];
        if (!r?.geometry?.coordinates?.length) throw new Error('no-route');
        if (cancelled) return;
        setRouteGeom(r.geometry.coordinates.map((c: number[]) => [c[1], c[0]]));
        setRouteMeta({
          distanceM: Number(r.distance ?? straight),
          durationS: Number(r.duration ?? fallbackEtaSeconds(straight)),
        });
      } catch {
        if (cancelled) return;
        // Fallback offline: línea recta + estimación 30 km/h
        setRouteGeom([
          [origin.lat, origin.lng],
          [activeDest.lat, activeDest.lng],
        ]);
        setRouteMeta({ distanceM: straight, durationS: fallbackEtaSeconds(straight) });
      }
    }, 400); // debounce: no spamear OSRM con cada metro

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [driver?.lat, driver?.lng, activeDest?.lat, activeDest?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 5. Dibujar ruta ----
  useEffect(() => {
    if (!mapInstanceRef.current || !L || !mapReady) return;
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
    if (overviewLineRef.current) {
      overviewLineRef.current.remove();
      overviewLineRef.current = null;
    }
    if (routeGeom && routeGeom.length >= 2) {
      routeLineRef.current = L.polyline(routeGeom, {
        color: target === 'pickup' ? '#16a34a' : '#f59e0b',
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
      }).addTo(mapInstanceRef.current);
    }
    // Referencia tenue pickup->delivery para contexto (estilo Uber: ves todo el viaje)
    if (pickup && delivery && driver) {
      overviewLineRef.current = L.polyline(
        [
          [pickup.lat, pickup.lng],
          [delivery.lat, delivery.lng],
        ],
        { color: '#94a3b8', weight: 2, opacity: 0.5, dashArray: '6,8' },
      ).addTo(mapInstanceRef.current);
    }
  }, [routeGeom, pickup, delivery, driver, target, mapReady]);

  const recenter = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !L) return;
    if (driver && activeDest) {
      map.fitBounds(
        L.latLngBounds([
          [driver.lat, driver.lng],
          [activeDest.lat, activeDest.lng],
        ]),
        { padding: [56, 56] },
      );
    } else if (driver) {
      map.setView([driver.lat, driver.lng], 16, { animate: true });
    } else if (activeDest) {
      map.setView([activeDest.lat, activeDest.lng], 15, { animate: true });
    }
  }, [driver, activeDest]);

  const openExternal = useCallback(() => {
    if (!activeDest) return;
    const dest = `${activeDest.lat},${activeDest.lng}`;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
      '_blank',
      'noopener,noreferrer',
    );
  }, [activeDest]);

  if (mapError) {
    return (
      <div
        className={`flex items-center justify-center rounded-3xl bg-surface-100 dark:bg-surface-800 ${className}`}
        style={{ height }}
      >
        <div className="px-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-10 w-10 text-surface-400" />
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

  if (!pickup && !delivery) {
    return (
      <div
        className={`flex items-center justify-center rounded-3xl bg-surface-100 dark:bg-surface-800 ${className}`}
        style={{ height }}
      >
        <p className="px-6 text-center text-sm text-surface-500">
          Este pedido no trae coordenadas. Usá la dirección escrita abajo.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl ${className}`} style={{ height }}>
      <div ref={mapRef} className="h-full w-full" />

      {/* Banner Uber: próxima parada + distancia/ETA */}
      {activeDest && (
        <div className="absolute inset-x-3 top-3 flex items-center gap-2 rounded-2xl bg-white/95 dark:bg-surface-900/95 px-3 py-2.5 shadow-lg backdrop-blur">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${
              target === 'pickup' ? 'bg-kiwi-500' : 'bg-amber-500'
            }`}
          >
            <Navigation className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-surface-800 dark:text-surface-100">
              {targetLabel ?? (target === 'pickup' ? 'Vas a recoger' : 'Vas a entregar')}
            </p>
            <p className="truncate text-xs text-surface-500">
              {routeMeta
                ? `${formatDist(routeMeta.distanceM)} · ${formatEta(routeMeta.durationS)}${driver ? '' : ' (estimado)'}`
                : 'Calculando ruta…'}
            </p>
          </div>
        </div>
      )}

      {/* Sin GPS */}
      {gpsDenied && (
        <div className="absolute inset-x-3 bottom-12 rounded-2xl bg-amber-500/95 px-3 py-2 text-center text-xs font-medium text-white shadow-lg">
          Activá el GPS para verte en el mapa y navegar en vivo.
        </div>
      )}

      {/* Controles */}
      <div className="absolute bottom-12 right-3 flex flex-col gap-2">
        <button
          onClick={recenter}
          aria-label="Centrar en mi ubicación"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-surface-800 shadow-lg text-surface-700 dark:text-surface-200"
        >
          <LocateFixed className="h-5 w-5" />
        </button>
      </div>
      <button
        onClick={openExternal}
        className="absolute bottom-3 right-3 rounded-xl bg-white/90 dark:bg-surface-800/90 px-3 py-1.5 text-[11px] font-medium text-surface-500 shadow backdrop-blur"
      >
        Abrir en Maps
      </button>

      <p className="absolute bottom-3 left-3 rounded-lg bg-white/80 dark:bg-surface-900/80 px-2 py-0.5 text-[10px] text-surface-400 backdrop-blur">
        {/* Atribución con enlace: requisito de la ODbL al usar tiles OSM. */}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted hover:text-surface-600 dark:hover:text-surface-300"
        >
          © OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}

export default DriverMap;
