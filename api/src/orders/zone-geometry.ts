// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Geometría pura de zonas: punto-en-polígono, área (para desempatar por
 * especificidad) y resolución de precio. Sin dependencias externas ni DB —
 * se testea en Node.
 *
 * GeoJSON usa [lng, lat]; acá se trabaja con anillos number[][] = [[lng,lat],…].
 */
export type Ring = number[][];
export type ZoneGeometry =
  { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

export interface PriceZone {
  id: string;
  label: string;
  price: number;
  latitude?: number | null;
  longitude?: number | null;
  geometry?: ZoneGeometry | null;
  referenceOnly: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Ray-casting sobre un anillo cerrado (exterior o agujero). */
export function pointInRing(point: LatLng, ring: Ring): boolean {
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Polygon = anillo exterior menos los agujeros. */
export function pointInPolygon(point: LatLng, coordinates: Ring[]): boolean {
  if (!coordinates.length) return false;
  if (!pointInRing(point, coordinates[0])) return false;
  for (let h = 1; h < coordinates.length; h++) {
    if (pointInRing(point, coordinates[h])) return false; // cae en un agujero
  }
  return true;
}

export function pointInGeometry(point: LatLng, geometry: ZoneGeometry): boolean {
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates);
  return geometry.coordinates.some((poly) => pointInPolygon(point, poly));
}

/** Área (shoelace, anillo exterior). Solo para comparar "más específica". */
function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(area / 2);
}

export function geometryArea(geometry: ZoneGeometry): number {
  if (geometry.type === 'Polygon') return ringArea(geometry.coordinates[0] ?? []);
  return geometry.coordinates.reduce((sum, poly) => sum + ringArea(poly[0] ?? []), 0);
}

const R = 6371000;
function meters(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type PriceResolution =
  { zone: PriceZone; source: 'polygon' } | { zone: PriceZone; source: 'reference' };

/**
 * Precio por zona para un punto:
 *  1. Si cae dentro de 1+ polígonos → la de MENOR área (más específica) → auto.
 *  2. Si no → la referencia más cercana (sugerencia, sin cobro automático).
 *  3. Sin zonas con coords/geometría → null.
 */
export function resolveZonePrice(zones: PriceZone[], point: LatLng): PriceResolution | null {
  const containing = zones.filter((z) => z.geometry && pointInGeometry(point, z.geometry));
  if (containing.length) {
    const zone = containing.reduce((best, cur) =>
      geometryArea(cur.geometry as ZoneGeometry) < geometryArea(best.geometry as ZoneGeometry)
        ? cur
        : best,
    );
    return { zone, source: 'polygon' };
  }

  const refs = zones.filter((z) => z.latitude != null && z.longitude != null);
  if (!refs.length) return null;
  let best = refs[0];
  let bestD = meters(point, { lat: Number(best.latitude), lng: Number(best.longitude) });
  for (const z of refs.slice(1)) {
    const d = meters(point, { lat: Number(z.latitude), lng: Number(z.longitude) });
    if (d < bestD) {
      best = z;
      bestD = d;
    }
  }
  return { zone: best, source: 'reference' };
}
