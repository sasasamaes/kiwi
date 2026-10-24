// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bike, MapPin, Home, AlertTriangle } from 'lucide-react';
import { isHttpUrl } from './utils';

let L: any = null;

interface Location {
  lat: number;
  lng: number;
}

export interface TrackingMapProps {
  pickup?: Location;
  delivery?: Location;
  driverLocation?: Location;
  /** Foto de perfil del repartidor: va en el marcador (igual que el mapa de zonas). */
  driverPhotoUrl?: string | null;
  height?: number;
  className?: string;
  showRoute?: boolean;
}

function createSvgIcon(svgContent: string, color: string, size = 40): any {
  return L.divIcon({
    html: `<div style="
      background: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 3px solid white;
    ">${svgContent}</div>`,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Marcador con la foto de perfil del repartidor (igual que el mapa de
 * zonas del admin). Solo URLs https: cualquier otro valor usa el icono
 * de bici. La URL se escapa para el atributo src.
 */
function createDriverPhotoIcon(photoUrl: string, size = 44): any {
  const src = photoUrl.replace(/"/g, '%22');
  return L.divIcon({
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      overflow: hidden;
      background: #3b82f6;
    "><img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block" /></div>`,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const MARKER_SVGS = {
  pickup: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  delivery: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  driver: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3.5-3.5 2-3 2 3 2-3 2 3 2-3 2 3V14l-2.5 3.5"/></svg>`,
  traffic: (level: string, color: string) => {
    const icon =
      level === 'free' ? '●' : level === 'light' ? '◐' : level === 'moderate' ? '◑' : '●';
    return `<div style="
      background: ${color}40;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: 3px solid ${color};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      color: ${color};
    ">${icon}</div>`;
  },
};

// OpenStreetMap directo (sin key). CARTO ahora exige API key y devuelve
// mosaicos "API KEY REQUIRED" que disparan tileload: con fallback nunca se
// detectaba la falla. Un solo proveedor + error accionable a los 10s.
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_OPTIONS = {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors',
};

export function TrackingMap({
  pickup,
  delivery,
  driverLocation,
  driverPhotoUrl,
  height = 300,
  className = '',
  showRoute = true,
}: TrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstanceRef.current) return;

    let cancelled = false;
    let tilesOk = false;
    let failTimer: ReturnType<typeof setTimeout> | null = null;

    const initMap = async () => {
      try {
        L = await import('leaflet');
        if (cancelled || !mapRef.current) return;

        const map = L.map(mapRef.current, {
          center: [10.1483, -85.4527],
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
        });

        const layer = L.tileLayer(OSM_URL, OSM_OPTIONS);
        layer.on('tileload', () => {
          tilesOk = true;
        });
        layer.addTo(map);
        tileLayerRef.current = layer;

        // Sin ningún mosaico en 10s: mostrar error accionable en vez de
        // una pantalla azul muda (red bloqueada, DNS, proveedor caído…).
        failTimer = setTimeout(() => {
          if (!cancelled && !tilesOk) {
            setError('El mapa no cargó. Revisá tu conexión e intentá de nuevo.');
          }
        }, 10000);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        mapInstanceRef.current = map;
        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to initialize map:', err);
        if (!cancelled) setError('No se pudo cargar el mapa');
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (failTimer) clearTimeout(failTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      tileLayerRef.current = null;
    };
  }, [retryKey]);

  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = L.latLngBounds([]);

    if (pickup) {
      const icon = createSvgIcon(MARKER_SVGS.pickup, '#22c55e');
      const marker = L.marker([pickup.lat, pickup.lng], { icon })
        .addTo(mapInstanceRef.current)
        .bindPopup('<b>Pickup</b><br>Tu negocio');
      markersRef.current.push(marker);
      bounds.extend([pickup.lat, pickup.lng]);
    }

    if (delivery) {
      const icon = createSvgIcon(MARKER_SVGS.delivery, '#f59e0b');
      const marker = L.marker([delivery.lat, delivery.lng], { icon })
        .addTo(mapInstanceRef.current)
        .bindPopup('<b>Entrega</b><br>Direccion del cliente');
      markersRef.current.push(marker);
      bounds.extend([delivery.lat, delivery.lng]);
    }

    if (driverLocation) {
      const icon = isHttpUrl(driverPhotoUrl)
        ? createDriverPhotoIcon(driverPhotoUrl)
        : createSvgIcon(MARKER_SVGS.driver, '#3b82f6');
      const marker = L.marker([driverLocation.lat, driverLocation.lng], { icon })
        .addTo(mapInstanceRef.current)
        .bindPopup('<b>Repartidor</b><br>En camino');
      markersRef.current.push(marker);
      bounds.extend([driverLocation.lat, driverLocation.lng]);
    }

    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [pickup, delivery, driverLocation, driverPhotoUrl]);

  useEffect(() => {
    if (!mapInstanceRef.current || !L || !showRoute) return;

    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    const points: Location[] = [];
    if (pickup) points.push(pickup);
    if (driverLocation) points.push(driverLocation);
    if (delivery) points.push(delivery);

    if (points.length >= 2) {
      const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);
      routeRef.current = L.polyline(latLngs, {
        color: '#22c55e',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10',
      }).addTo(mapInstanceRef.current);
    }
  }, [pickup, delivery, driverLocation, showRoute]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-100 dark:bg-surface-800 rounded-2xl ${className}`}
        style={{ height }}
      >
        <div className="text-center px-6">
          <AlertTriangle className="h-10 w-10 text-surface-500 dark:text-surface-400 mx-auto mb-2" />
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-3">{error}</p>
          <button
            className="rounded-xl bg-kiwi-700 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => {
              setError(null);
              setIsLoaded(false);
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
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      {/* El mapa Leaflet es canvas interactivo no accesible: role + descripción
          avisando qué muestra, y la info equivalente vive en la leyenda de
          abajo y en el texto del tracking (estados, tiempos, direcciones). */}
      <div
        ref={mapRef}
        style={{ height }}
        className="w-full"
        role="application"
        aria-label="Mapa de seguimiento del pedido: ubicación del negocio, del cliente y del repartidor en tiempo real"
      />

      {!isLoaded && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-surface-100 dark:bg-surface-800"
          initial={{ opacity: 1 }}
          animate={{ opacity: isLoaded ? 0 : 1 }}
        >
          <div className="text-center">
            <motion.div
              className="w-8 h-8 border-4 border-kiwi-600 border-t-transparent rounded-full mx-auto mb-2"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-sm text-surface-500 dark:text-surface-400">Cargando mapa...</p>
          </div>
        </motion.div>
      )}

      {isLoaded && (
        <motion.div
          className="absolute bottom-2 left-2 glass rounded-lg p-2 text-xs"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-kiwi-500" />
              <span className="text-surface-600 dark:text-surface-400">Negocio</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-surface-600 dark:text-surface-400">Entrega</span>
            </div>
            {driverLocation && (
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-surface-600 dark:text-surface-400">Repartidor</span>
              </div>
            )}
          </div>
          <p className="mt-1 text-[10px] text-surface-500 dark:text-surface-400">
            {/* Atribución con enlace: requisito de la ODbL al usar tiles OSM. */}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-kiwi-700 dark:hover:text-kiwi-400"
            >
              © OpenStreetMap contributors
            </a>
          </p>
        </motion.div>
      )}

      <button
        className="absolute top-2 right-2 w-8 h-8 glass rounded-lg flex items-center justify-center hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
        onClick={() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + 1);
          }
        }}
        aria-label="Acercar mapa"
      >
        <span className="text-lg" aria-hidden>
          +
        </span>
      </button>
    </div>
  );
}

export default TrackingMap;
