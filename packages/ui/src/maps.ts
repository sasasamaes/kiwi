// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * Capas base compartidas (calles + satélite) para los mini-mapas Leaflet.
 * Se pasa el `L` del import dinámico para no romper el SSR.
 * Satélite: Esri World Imagery (gratis, sin API key).
 */

export const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/** Agrega calles + satélite con control de capas. Devuelve ambas capas. */
export function addStreetsAndSatellite(
  map: any,
  L: any,
  opts?: { defaultSatellite?: boolean; position?: string },
): { streets: any; satellite: any } {
  const streets = L.tileLayer(OSM_TILES, { attribution: '© OpenStreetMap' });
  const satellite = L.tileLayer(SATELLITE_TILES, { attribution: '© Esri World Imagery' });
  (opts?.defaultSatellite ? satellite : streets).addTo(map);
  L.control
    .layers({ '🗺️ Mapa': streets, '🛰️ Satélite': satellite }, undefined, {
      position: opts?.position ?? 'topright',
    })
    .addTo(map);
  return { streets, satellite };
}
