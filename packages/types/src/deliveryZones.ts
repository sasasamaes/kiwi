// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Catálogo oficial de zonas de entrega — Nicoya.
 * El servidor es la fuente de verdad del precio (orders.service lo revalida);
 * este archivo existe para que web/cliente/driver muestren el mismo precio
 * sin adivinar por distancia.
 *
 * Precios en colones (CRC). El viaje del repartidor (driverPayout) es este
 * monto; la comisión de la app (10%) se suma encima en el total.
 *
 * GEO: latitude/longitude son PUNTOS DE REFERENCIA (WGS84/EPSG:4326), NO
 * límites del barrio. Sirven para ubicar la zona en el mapa y para sugerir
 * la zona más cercana. `geometry` quedará como Polygon/MultiPolygon GeoJSON
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
  /** Punto de referencia WGS84. Ausente = solo selección manual (ej. Casitas). */
  latitude?: number | null;
  longitude?: number | null;
  /** Polígono real. null = aún no definido (ver referenceOnly). */
  geometry?: ZoneGeometry | null;
  /** true mientras no haya polígono: sugerir sí, cobrar automático no. */
  referenceOnly: boolean;
}

export const NICOYA_DELIVERY_ZONES: DeliveryZone[] = [
  // ₡1000
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
    id: 'los-malinches',
    label: 'Los Malinches',
    price: 1000,
    latitude: 10.13648,
    longitude: -85.45505,
    geometry: null,
    referenceOnly: true,
  },
  {
    id: 'guadalupe',
    label: 'Guadalupe',
    price: 1000,
    latitude: 10.14051,
    longitude: -85.44541,
    geometry: null,
    referenceOnly: true,
  },
  // ₡1500
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
    id: 'cruce-casitas',
    label: 'Cruce Casitas',
    price: 1500,
    latitude: 10.132,
    longitude: -85.438,
    geometry: null,
    referenceOnly: true,
  },
  // ₡1500 sin punto GPS (solo selección manual + match por texto)
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
  // ₡2000
  {
    id: 'casitas',
    label: 'Casitas',
    price: 2000,
    latitude: 10.12491,
    longitude: -85.43247,
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
  // ₡2500
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
  // ₡3000
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
  // ₡3500+
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

/**
 * Comisión que paga el REPARTIDOR por viaje: % configurable por el admin
 * (default 15). El comercio/cliente NO paga comisión: paga productos + viaje.
 */
export const DRIVER_COMMISSION_PCT = 15;

/** % del viaje que retiene la app (espejo del backend). */
export function computeDriverCommission(trip: number, pct: number = DRIVER_COMMISSION_PCT): number {
  const rate = Math.min(Math.max(Number(pct) || 0, 0), 100) / 100;
  return Math.round(trip * rate);
}

/** Lo que recibe el repartidor por el viaje: viaje menos comisión. */
export function computeDriverPayout(trip: number, pct: number = DRIVER_COMMISSION_PCT): number {
  return trip - computeDriverCommission(trip, pct);
}

/** Busca por id o por nombre (insensible a mayúsculas/espacios). */
export function findDeliveryZone(ref: unknown): DeliveryZone | null {
  if (typeof ref !== 'string') return null;
  const key = ref.trim().toLowerCase();
  if (!key) return null;
  return byId.get(key) ?? byLabel.get(key) ?? null;
}

/**
 * Detección best-effort de zona a partir de texto libre: dirección escrita
 * por el comercio, displayName de Nominatim (búsqueda o reverse-geocode),
 * o label de un link de Maps pegado por WhatsApp.
 *
 * Compara por tokens (sin tildes, insensible a mayúsculas) para que
 * "Barrio Aeropuerto, Nicoya" o "150m este del cruce" matcheen aunque el
 * texto traiga ruido alrededor. Las reglas van de más a menos específica
 * ("Reserva Curime" antes que "Curime") y ante ambigüedad ("Bosques" sin
 * adentro/afuera) devuelve null en vez de adivinar.
 */
const normTokens = (s: string): string[] =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

// Cada regla: TODOS los tokens deben aparecer. Orden = especificidad.
const DETECTION_RULES: Array<{ tokens: string[]; zoneId: string }> = [
  { tokens: ['reserva', 'curime'], zoneId: 'reserva-curime' },
  { tokens: ['bosques', 'adentro'], zoneId: 'bosques-adentro' },
  { tokens: ['bosques', 'afuera'], zoneId: 'bosques-afuera' },
  { tokens: ['cruce', 'casitas'], zoneId: 'cruce-casitas' },
  { tokens: ['cruce'], zoneId: 'cruce-afuera' },
  { tokens: ['aeropuerto'], zoneId: 'barrio-aeropuerto' },
  { tokens: ['san', 'martin'], zoneId: 'san-martin' },
  { tokens: ['angeles'], zoneId: 'los-angeles' },
  { tokens: ['malinches'], zoneId: 'los-malinches' },
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
  { tokens: ['guadalupe'], zoneId: 'guadalupe' },
  { tokens: ['centro'], zoneId: 'centro' },
];

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

export function getDeliveryZonePrice(ref: unknown): number | null {
  return findDeliveryZone(ref)?.price ?? null;
}

// ---------------------------------------------------------------------------
// GEO: zona más cercana (referencia) + punto de extensión a polígonos.
// ---------------------------------------------------------------------------

/** true mientras la zona no tenga polígono: sugerir sí, cobrar automático no. */
export function isReferenceOnly(zone: DeliveryZone): boolean {
  return zone.referenceOnly || zone.geometry == null;
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

/**
 * IMPORTANTE: con `geometry == null` el punto de referencia NO define el
 * barrio. Por eso el resultado trae `confident`: si la 2ª zona está a menos
 * de `ambiguityKm`, el llamador NO debe fijar la zona ni el precio solo, debe
 * pedir confirmación (manual o mapa).
 */
export interface NearestZoneResult {
  zone: DeliveryZone;
  distanceKm: number;
  confident: boolean;
  runnerUp: NearestZoneCandidate | null;
  /** true mientras no haya polígonos: el precio final lo valida el servidor. */
  referenceOnly: boolean;
}

/**
 * Umbral de ambigüedad: en el casco de Nicoya los puntos de referencia
 * vecinos están a ~0.2–0.5 km; un gap menor a 0.15 km = cerca del límite.
 */
export const NEAREST_ZONE_AMBIGUITY_KM = 0.15;

/**
 * Zona de referencia más cercana a un GPS. Solo considera zonas CON punto
 * (las que tienen latitude/longitude en null quedan fuera).
 *
 * PUNTO DE EXTENSIÓN POSTGIS: cuando `geometry` exista, este es el lugar a
 * reemplazar por point-in-polygon: primero ST_Within(geometry), y solo como
 * fallback la distancia mínima. La firma y `confident` no cambian.
 */
export function findNearestZone(
  lat: unknown,
  lng: unknown,
  opts?: { ambiguityKm?: number },
): NearestZoneResult | null {
  // Number(null) === 0 y Number('') === 0: rechazar vacíos explícitos
  // antes de convertir, si no un GPS ausente matchea cualquier zona.
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
