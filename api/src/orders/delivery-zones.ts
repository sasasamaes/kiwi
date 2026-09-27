// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Catálogo oficial de zonas de entrega — Nicoya (fuente de verdad del precio).
 * Espejo de `@kiwi/types/deliveryZones`: el backend no importa el workspace
 * para no acoplar el build de Nest; si cambias precios/coords, cambia ambos.
 *
 * GEO: latitude/longitude son PUNTOS DE REFERENCIA (WGS84/EPSG:4326), NO
 * límites del barrio. `geometry` quedará como Polygon/MultiPolygon GeoJSON
 * (futuro PostGIS); mientras sea null la zona es `referenceOnly` y el
 * sistema NO debe cobrar automáticamente por cercanía cerca de un límite.
 */
export type ZoneGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface DeliveryZone {
  id: string;
  label: string;
  price: number;
  latitude?: number | null;
  longitude?: number | null;
  geometry?: ZoneGeometry | null;
  referenceOnly: boolean;
}

export const NICOYA_DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: 'centro',
    label: 'Centro',
    price: 1000,
    latitude: 10.14828,
    longitude: -85.45201,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'carmen',
    label: 'Carmen',
    price: 1000,
    latitude: 10.149,
    longitude: -85.454,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'santa-lucia',
    label: 'Santa Lucía',
    price: 1000,
    latitude: 10.151,
    longitude: -85.456,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'cananga',
    label: 'Cananga',
    price: 1000,
    latitude: 10.153,
    longitude: -85.459,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'virginia',
    label: 'Virginia',
    price: 1000,
    latitude: 10.157,
    longitude: -85.463,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'cementerio',
    label: 'Cementerio',
    price: 1000,
    latitude: 10.145,
    longitude: -85.458,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'matabuey',
    label: 'Matabuey',
    price: 1500,
    latitude: 10.155,
    longitude: -85.449,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'barrio-aeropuerto',
    label: 'Barrio Aeropuerto',
    price: 1500,
    latitude: 10.171,
    longitude: -85.449,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'caimito',
    label: 'Caimito',
    price: 1500,
    latitude: 10.143,
    longitude: -85.443,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'los-angeles',
    label: 'Los Ángeles',
    price: 1500,
    latitude: 10.15,
    longitude: -85.36667,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'la-granja',
    label: 'La Granja',
    price: 1500,
    latitude: 10.153,
    longitude: -85.447,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'san-martin',
    label: 'San Martín',
    price: 1500,
    latitude: 10.158,
    longitude: -85.45,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'brisas-del-cerro',
    label: 'Brisas del cerro',
    price: 1500,
    latitude: null,
    longitude: null,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'hospital-emergencias',
    label: 'Hospital · Emergencias',
    price: 1500,
    latitude: null,
    longitude: null,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'hospital-visitas',
    label: 'Hospital · Visitas',
    price: 1500,
    latitude: null,
    longitude: null,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'hospital-laboratorio',
    label: 'Hospital · Laboratorio',
    price: 1500,
    latitude: null,
    longitude: null,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'hospital-atras',
    label: 'Hospital · Atrás',
    price: 1500,
    latitude: null,
    longitude: null,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'casitas',
    label: 'Casitas',
    price: 2000,
    latitude: 10.14,
    longitude: -85.44,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'cruce-afuera',
    label: 'Del cruce pa afuera',
    price: 2000,
    latitude: 10.16,
    longitude: -85.47,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'bosques-afuera',
    label: 'Bosques afuera',
    price: 2000,
    latitude: 10.155,
    longitude: -85.475,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'curime',
    label: 'Curime',
    price: 2500,
    latitude: 10.11967,
    longitude: -85.46179,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'bosques-adentro',
    label: 'Bosques adentro',
    price: 2500,
    latitude: 10.15,
    longitude: -85.48,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'llano',
    label: 'Llano',
    price: 3000,
    latitude: 10.165,
    longitude: -85.47,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'reserva-curime',
    label: 'Reserva Curime',
    price: 3000,
    latitude: 10.1047,
    longitude: -85.4478,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'nambi',
    label: 'Nambi',
    price: 3500,
    latitude: 10.2083,
    longitude: -85.50222,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'monte-galan',
    label: 'Monte Galán',
    price: 5000,
    latitude: 10.13333,
    longitude: -85.38333,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'moracia',
    label: 'Moracia',
    price: 5000,
    latitude: 10.23874,
    longitude: -85.39726,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'caimital',
    label: 'Caimital',
    price: 5000,
    latitude: 10.06746,
    longitude: -85.47429,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'mansion',
    label: 'Mansión',
    price: 6000,
    latitude: 10.09978,
    longitude: -85.37249,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'hojancha',
    label: 'Hojancha',
    price: 7000,
    latitude: 10.05889,
    longitude: -85.41944,
    geometry: null,
    referenceOnly: true,
  },
];

const byId = new Map(NICOYA_DELIVERY_ZONES.map((z) => [z.id, z]));
const byLabel = new Map(NICOYA_DELIVERY_ZONES.map((z) => [z.label.trim().toLowerCase(), z]));

/** Busca por id o por nombre (insensible a mayúsculas/espacios). */
export function findDeliveryZone(ref: unknown): DeliveryZone | null {
  if (typeof ref !== 'string') return null;
  const key = ref.trim().toLowerCase();
  if (!key) return null;
  return byId.get(key) ?? byLabel.get(key) ?? null;
}

// ---------------------------------------------------------------------------
// Detección best-effort de zona a partir de texto libre (espejo de
// @kiwi/types: mismas reglas — cambia allá, cambia acá).
// ---------------------------------------------------------------------------

const normTokens = (s: string): string[] =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

// Cada regla: TODOS los tokens deben aparecer. Orden = especificidad
// ("Reserva Curime" antes que "Curime"; "Bosques adentro/afuera" antes que
// nada). Ante ambigüedad ("Bosques" sin calificar) no adivina.
const DETECTION_RULES: Array<{ tokens: string[]; zoneId: string }> = [
  { tokens: ['reserva', 'curime'], zoneId: 'reserva-curime' },
  { tokens: ['bosques', 'adentro'], zoneId: 'bosques-adentro' },
  { tokens: ['bosques', 'afuera'], zoneId: 'bosques-afuera' },
  { tokens: ['cruce'], zoneId: 'cruce-afuera' },
  { tokens: ['aeropuerto'], zoneId: 'barrio-aeropuerto' },
  { tokens: ['san', 'martin'], zoneId: 'san-martin' },
  { tokens: ['angeles'], zoneId: 'los-angeles' },
  { tokens: ['santa', 'lucia'], zoneId: 'santa-lucia' },
  { tokens: ['granja'], zoneId: 'la-granja' },
  { tokens: ['brisas', 'cerro'], zoneId: 'brisas-del-cerro' },
  { tokens: ['hospital', 'emergencias'], zoneId: 'hospital-emergencias' },
  { tokens: ['hospital', 'visitas'], zoneId: 'hospital-visitas' },
  { tokens: ['hospital', 'laboratorio'], zoneId: 'hospital-laboratorio' },
  { tokens: ['hospital', 'atras'], zoneId: 'hospital-atras' },
  { tokens: ['emergencias'], zoneId: 'hospital-emergencias' },
  { tokens: ['laboratorio'], zoneId: 'hospital-laboratorio' },
  { tokens: ['visitas'], zoneId: 'hospital-visitas' },
  { tokens: ['caimital'], zoneId: 'caimital' },
  { tokens: ['caimito'], zoneId: 'caimito' },
  { tokens: ['monte', 'galan'], zoneId: 'monte-galan' },
  { tokens: ['galan'], zoneId: 'monte-galan' },
  { tokens: ['moracia'], zoneId: 'moracia' },
  { tokens: ['matabuey'], zoneId: 'matabuey' },
  { tokens: ['casitas'], zoneId: 'casitas' },
  { tokens: ['casita'], zoneId: 'casitas' },
  { tokens: ['curime'], zoneId: 'curime' },
  { tokens: ['llano'], zoneId: 'llano' },
  { tokens: ['nambi'], zoneId: 'nambi' },
  { tokens: ['mansion'], zoneId: 'mansion' },
  { tokens: ['hojancha'], zoneId: 'hojancha' },
  { tokens: ['carmen'], zoneId: 'carmen' },
  { tokens: ['cananga'], zoneId: 'cananga' },
  { tokens: ['virginia'], zoneId: 'virginia' },
  { tokens: ['cementerio'], zoneId: 'cementerio' },
  { tokens: ['centro'], zoneId: 'centro' },
];

/** Detecta zona a partir de texto libre (dirección, displayName, etc.). */
export function detectDeliveryZoneFromText(
  ...texts: Array<string | null | undefined>
): DeliveryZone | null {
  const tokens = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const tok of normTokens(t)) tokens.add(tok);
  }
  if (tokens.size === 0) return null;
  for (const rule of DETECTION_RULES) {
    if (rule.tokens.every((tok) => tokens.has(tok))) {
      return byId.get(rule.zoneId) ?? null;
    }
  }
  return null;
}

/** Distancia Haversine en km (WGS84). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface NearestZoneCandidate {
  zone: DeliveryZone;
  distanceKm: number;
}

export interface NearestZoneResult {
  zone: DeliveryZone;
  distanceKm: number;
  /** false si la 2ª zona está a menos de ambiguityKm: NO fijar precio solo. */
  confident: boolean;
  runnerUp: NearestZoneCandidate | null;
  referenceOnly: boolean;
}

/** En el casco de Nicoya los puntos vecinos están a ~0.2–0.5 km. */
export const NEAREST_ZONE_AMBIGUITY_KM = 0.15;

/**
 * Zona de referencia más cercana a un GPS. Solo zonas CON punto.
 *
 * PUNTO DE EXTENSIÓN POSTGIS: cuando `geometry` exista, reemplazar por
 * point-in-polygon (primero ST_Within, fallback a distancia). La firma y
 * `confident` no cambian.
 */
export function findNearestZone(
  lat: unknown,
  lng: unknown,
  opts?: { ambiguityKm?: number },
): NearestZoneResult | null {
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;

  const ranked: NearestZoneCandidate[] = [];
  for (const zone of NICOYA_DELIVERY_ZONES) {
    if (!Number.isFinite(zone.latitude) || !Number.isFinite(zone.longitude)) continue;
    ranked.push({
      zone,
      distanceKm: haversineKm(la, ln, zone.latitude as number, zone.longitude as number),
    });
  }
  if (ranked.length === 0) return null;
  ranked.sort((a, b) => a.distanceKm - b.distanceKm || a.zone.id.localeCompare(b.zone.id));

  const [first, second] = ranked;
  const ambiguityKm = opts?.ambiguityKm ?? NEAREST_ZONE_AMBIGUITY_KM;
  const gap = second ? second.distanceKm - first.distanceKm : Number.POSITIVE_INFINITY;
  return {
    zone: first.zone,
    distanceKm: first.distanceKm,
    confident: gap >= ambiguityKm,
    runnerUp: second ?? null,
    referenceOnly: true,
  };
}
