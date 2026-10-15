export interface LatLng {
  lat: number;
  lng: number;
}

export interface EtaInput {
  driver?: LatLng | null;
  pickup?: LatLng | null;
  delivery?: LatLng | null;
  serverEtaMin?: number | null;
}

export type EtaSource = 'server' | 'estimate' | 'none';

export interface EtaResult {
  minutes: number | null;
  source: EtaSource;
}

const EARTH_RADIUS_KM = 6371;
// Urban motorcycle average, matching the web client's heuristic.
const AVG_SPEED_KMH = 22;
// Fixed handover/prep buffer added to the distance estimate.
const PREP_MINUTES = 3;

// Rejects null/NaN/(0,0) (the null Island) and out-of-range coordinates so the
// map never plots a bogus pin.
export function isPoint(p: LatLng | null | undefined): p is LatLng {
  return (
    !!p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    !(p.lat === 0 && p.lng === 0) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Pure ETA resolver: prefers the server estimate when present, otherwise falls
// back to a distance-based estimate (driver → delivery, or pickup → delivery
// before the driver has a fix), and `none` when there is nothing to work with.
export function computeEta(input: EtaInput): EtaResult {
  const server = input.serverEtaMin;
  if (typeof server === 'number' && Number.isFinite(server) && server >= 0) {
    return { minutes: Math.round(server), source: 'server' };
  }

  const origin = isPoint(input.driver) ? input.driver : isPoint(input.pickup) ? input.pickup : null;
  if (origin && isPoint(input.delivery)) {
    const km = haversineKm(origin, input.delivery);
    const minutes = Math.ceil((km / AVG_SPEED_KMH) * 60) + PREP_MINUTES;
    return { minutes, source: 'estimate' };
  }

  return { minutes: null, source: 'none' };
}
