'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

// Dynamically import Leaflet to avoid SSR issues
let L: any = null;

interface Location {
  lat: number;
  lng: number;
}

interface TrackingMapProps {
  pickup?: Location;
  delivery?: Location;
  driverLocation?: Location;
  height?: number;
  className?: string;
  showRoute?: boolean;
}

export function TrackingMap({
  pickup,
  delivery,
  driverLocation,
  height = 300,
  className = '',
  showRoute = true,
}: TrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      try {
        // Dynamic import of Leaflet
        L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        // Create map centered on Nicoya, Costa Rica
        const map = L.map(mapRef.current, {
          center: [10.1483, -85.4527], // Nicoya coordinates
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
        });

        // Add OpenStreetMap tiles (free, no API key needed)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        // Add zoom control to bottom right
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        mapInstanceRef.current = map;
        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to initialize map:', err);
        setError('No se pudo cargar el mapa');
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Custom icons
  const createIcon = (emoji: string, color: string) => {
    if (!L) return null;
    
    return L.divIcon({
      html: `<div style="
        background: ${color};
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 3px solid white;
      ">${emoji}</div>`,
      className: 'custom-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  // Update markers when locations change
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = L.latLngBounds([]);

    // Add pickup marker
    if (pickup) {
      const icon = createIcon('🏪', '#22c55e');
      const marker = L.marker([pickup.lat, pickup.lng], { icon })
        .addTo(mapInstanceRef.current)
        .bindPopup('<b>Pickup</b><br>Tu negocio');
      markersRef.current.push(marker);
      bounds.extend([pickup.lat, pickup.lng]);
    }

    // Add delivery marker
    if (delivery) {
      const icon = createIcon('🏠', '#f59e0b');
      const marker = L.marker([delivery.lat, delivery.lng], { icon })
        .addTo(mapInstanceRef.current)
        .bindPopup('<b>Entrega</b><br>Dirección del cliente');
      markersRef.current.push(marker);
      bounds.extend([delivery.lat, delivery.lng]);
    }

    // Add driver marker (animated)
    if (driverLocation) {
      const icon = createIcon('🛵', '#3b82f6');
      const marker = L.marker([driverLocation.lat, driverLocation.lng], { icon })
        .addTo(mapInstanceRef.current)
        .bindPopup('<b>Repartidor</b><br>En camino');
      markersRef.current.push(marker);
      bounds.extend([driverLocation.lat, driverLocation.lng]);
    }

    // Fit map to show all markers
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [pickup, delivery, driverLocation]);

  // Draw route line
  useEffect(() => {
    if (!mapInstanceRef.current || !L || !showRoute) return;

    // Remove existing route
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    // Draw line from pickup to delivery through driver
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
        <div className="text-center">
          <span className="text-4xl block mb-2">🗺️</span>
          <p className="text-sm text-surface-500 dark:text-surface-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      {/* Map Container */}
      <div 
        ref={mapRef} 
        style={{ height }}
        className="w-full"
      />

      {/* Loading Overlay */}
      {!isLoaded && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-surface-100 dark:bg-surface-800"
          initial={{ opacity: 1 }}
          animate={{ opacity: isLoaded ? 0 : 1 }}
        >
          <div className="text-center">
            <motion.div
              className="w-8 h-8 border-4 border-kiwi-500 border-t-transparent rounded-full mx-auto mb-2"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-sm text-surface-500 dark:text-surface-400">Cargando mapa...</p>
          </div>
        </motion.div>
      )}

      {/* Legend */}
      {isLoaded && (
        <motion.div
          className="absolute bottom-2 left-2 bg-white dark:bg-surface-800 rounded-lg shadow-lg p-2 text-xs"
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
        </motion.div>
      )}

      {/* Fullscreen Button */}
      <button
        className="absolute top-2 right-2 w-8 h-8 bg-white dark:bg-surface-800 rounded-lg shadow-lg flex items-center justify-center hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
        onClick={() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + 1);
          }
        }}
      >
        <span className="text-lg">+</span>
      </button>
    </div>
  );
}

export default TrackingMap;
