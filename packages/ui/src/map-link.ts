// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.

/** Punto geográfico extraído de un link de mapa compartido (ej. WhatsApp). */
export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

/**
 * Parser local de links de mapa: coords directas (geo:, ?q=lat,lng, @lat,lng,
 * !3d/!4d, mlat/mlon), links acortados (se resuelven vía backend) o texto
 * buscable. Nada de red acá: lo externo lo resuelve quien llama.
 */
export function parseMapLink(
  raw: string,
):
  | { kind: 'coords'; point: GeoPoint }
  | { kind: 'query'; query: string }
  | { kind: 'short' }
  | null {
  const text = raw.trim();
  if (!text) return null;
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) return null;

  let url: URL;
  try {
    url = new URL(urlMatch[0]);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();

  if (host.includes('goo.gl') || host.includes('maps.app.goo.gl')) {
    return { kind: 'short' };
  }

  const numPair = (s: string | null): GeoPoint | null => {
    if (!s) return null;
    const m = s.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  };

  // geo:lat,lng
  if (url.protocol === 'geo:') {
    const p = numPair(url.pathname);
    return p ? { kind: 'coords', point: p } : null;
  }

  const q = (k: string) => url.searchParams.get(k);
  for (const key of ['q', 'query', 'll', 'destination']) {
    const p = numPair(q(key));
    if (p) return { kind: 'coords', point: p };
  }

  // /maps/@lat,lng,zoom
  const atMatch = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const p = numPair(`${atMatch[1]},${atMatch[2]}`);
    if (p) return { kind: 'coords', point: p };
  }

  // Pin compartido de Google: .../data=!3m...!3dLAT!4dLNG
  const pinMatch = urlMatch[0].match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pinMatch) {
    const p = numPair(`${pinMatch[1]},${pinMatch[2]}`);
    if (p) return { kind: 'coords', point: p };
  }

  // OSM ?mlat=&mlon=
  const mlat = url.searchParams.get('mlat');
  const mlon = url.searchParams.get('mlon');
  if (mlat && mlon) {
    const p = numPair(`${mlat},${mlon}`);
    if (p) return { kind: 'coords', point: p };
  }

  // Texto buscable como fallback (q=nombre del lugar)
  const textQuery = q('q') || q('query');
  if (textQuery && textQuery.trim()) return { kind: 'query', query: textQuery.trim() };

  return null;
}
