import { Injectable, Logger } from '@nestjs/common';
import { findNearestZone } from '../orders/delivery-zones';

export interface GeocodingResult {
  placeId: string;
  displayName: string;
  shortName: string;
  lat: number;
  lng: number;
  type: string;
  importance: number;
  address: {
    houseNumber?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    countryCode?: string;
    postcode?: string;
  };
}

export interface ReverseGeocodingResult {
  displayName: string;
  shortName: string;
  address: {
    houseNumber?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    countryCode?: string;
  };
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly baseUrl = 'https://nominatim.openstreetmap.org';
  private readonly userAgent = 'KiwiDeliveryApp/1.0 (https://kiwicr.express)';

  // Cache for geocoding results (in production, use Redis)
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  // Nominatim exige máx 1 req/s y banea IPs que lo saturan (429). Todo lo
  // que sale hacia allá pasa por nominatimFetch: espacía 1.1s, fusiona
  // llamadas idénticas en vuelo y en 429/503 entra en cooldown de 60s
  // devolviendo vacío en vez de seguir golpeando.
  private lastNominatimAt = 0;
  private cooldownUntil = 0;
  private readonly nominatimGapMs = 1100;
  private readonly nominatimCooldownMs = 60_000;
  private inflight = new Map<string, Promise<Response>>();

  private async nominatimFetch(url: string): Promise<Response | null> {
    if (Date.now() < this.cooldownUntil) return null;

    const running = this.inflight.get(url);
    if (running) return running;

    const wait = this.nominatimGapMs - (Date.now() - this.lastNominatimAt);
    const p = (async () => {
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastNominatimAt = Date.now();
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      });
      if (res.status === 429 || res.status === 503) {
        this.cooldownUntil = Date.now() + this.nominatimCooldownMs;
        this.logger.warn(`Nominatim limitado (${res.status}): pausa de 60s`);
        return null;
      }
      return res;
    })();
    this.inflight.set(url, p);
    try {
      return await p;
    } finally {
      if (this.inflight.get(url) === p) this.inflight.delete(url);
    }
  }

  /**
   * Search for addresses by text query
   * Uses Nominatim (OpenStreetMap) - completely free, no API key needed
   */
  async search(query: string, limit: number = 5): Promise<GeocodingResult[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Check cache
    const cacheKey = `search:${query.toLowerCase()}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: String(limit),
        addressdetails: '1',
        extratags: '1',
        namedetails: '1',
        // Focus on Costa Rica
        countrycodes: 'cr',
        // Prefer results in Nicoya area
        viewbox: '-85.6,10.0,-85.3,10.3',
        bounded: '0',
      });

      const response = await this.nominatimFetch(`${this.baseUrl}/search?${params.toString()}`);

      if (!response) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json();

      const results: GeocodingResult[] = data.map((item: any) => ({
        placeId: item.place_id?.toString() || '',
        displayName: item.display_name || '',
        shortName: this.formatShortName(item),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type || 'unknown',
        importance: item.importance || 0,
        address: {
          houseNumber: item.address?.house_number,
          road: item.address?.road,
          neighbourhood: item.address?.neighbourhood || item.address?.suburb,
          suburb: item.address?.suburb,
          city: item.address?.city || item.address?.town || item.address?.village,
          state: item.address?.state,
          country: item.address?.country,
          countryCode: item.address?.country_code,
          postcode: item.address?.postcode,
        },
      }));

      // Cache results
      this.setCache(cacheKey, results);

      return results;
    } catch (error) {
      this.logger.error(`Geocoding search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Search specifically for addresses in Costa Rica
   */
  async searchCostaRica(query: string, limit: number = 5): Promise<GeocodingResult[]> {
    const results = await this.search(`${query}, Costa Rica`, limit);
    return results.filter((r) => r.address.countryCode === 'cr');
  }

  /**
   * Search for addresses in Nicoya specifically
   */
  async searchNicoya(query: string, limit: number = 5): Promise<GeocodingResult[]> {
    const results = await this.search(`${query}, Nicoya, Guanacaste, Costa Rica`, limit + 2);

    // Prioritize Nicoya results
    const nicoyaResults = results.filter((r) => r.displayName.toLowerCase().includes('nicoya'));

    const otherResults = results.filter((r) => !r.displayName.toLowerCase().includes('nicoya'));

    return [...nicoyaResults, ...otherResults].slice(0, limit);
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodingResult | null> {
    // Check cache
    const cacheKey = `reverse:${lat}:${lng}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: 'json',
        addressdetails: '1',
        extratags: '1',
      });

      const response = await this.nominatimFetch(`${this.baseUrl}/reverse?${params.toString()}`);

      if (!response) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Nominatim reverse geocoding error: ${response.status}`);
      }

      const data = await response.json();

      if (!data || data.error) {
        return null;
      }

      const result: ReverseGeocodingResult = {
        displayName: data.display_name || '',
        shortName: this.formatShortName(data),
        address: {
          houseNumber: data.address?.house_number,
          road: data.address?.road,
          neighbourhood: data.address?.neighbourhood || data.address?.suburb,
          suburb: data.address?.suburb,
          city: data.address?.city || data.address?.town || data.address?.village,
          state: data.address?.state,
          country: data.address?.country,
          countryCode: data.address?.country_code,
        },
      };

      // Cache result
      this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      this.logger.error(`Reverse geocoding failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Resolve a shared map link (including shortened goo.gl / maps.app.goo.gl)
   * by following redirects server-side (no CORS issues) and extracting
   * coordinates from the final URL.
   */
  async resolveMapLink(rawUrl: string): Promise<{
    lat: number;
    lng: number;
    label: string;
    resolvedUrl: string;
  } | null> {
    const match = rawUrl?.trim().match(/https?:\/\/[^\s]+/i);
    if (!match) return null;

    let initial: URL;
    try {
      initial = new URL(match[0]);
    } catch {
      return null;
    }

    const allowedHosts = [
      'goo.gl',
      'maps.app.goo.gl',
      'google.com',
      'www.google.com',
      'maps.google.com',
      'maps.app.goo.gl',
      'apple.com',
      'maps.apple.com',
      'openstreetmap.org',
      'www.openstreetmap.org',
      'waze.com',
      'www.waze.com',
    ];
    const host = initial.hostname.toLowerCase();
    const allowed = allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
    if (!allowed) return null;

    const cacheKey = `resolvelink:${initial.toString().toLowerCase()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      // Seguir redirects a mano (algunos User-Agent reciben 200 con
      // interstitial en vez de 302 si se deja el follow automático).
      let current = initial.toString();
      let finalUrl = current;
      let lastResponse: Response | null = null;
      for (let i = 0; i < 5; i++) {
        const response = await fetch(current, {
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        });
        lastResponse = response;
        const location = response.headers.get('location');
        if (response.status >= 300 && response.status < 400 && location) {
          current = new URL(location, current).toString();
          finalUrl = current;
          // No hace falta leer el body de un redirect
          try {
            await response.arrayBuffer();
          } catch {
            // ignore
          }
          continue;
        }
        finalUrl = current;
        break;
      }
      const point = this.extractCoordsFromUrl(finalUrl);
      if (!point) {
        // Fallback: scan a bit of the HTML body for !3dLAT!4dLNG or @LAT,LNG
        try {
          const text = lastResponse ? await lastResponse.text() : '';
          const bodyPoint = this.extractCoordsFromUrl(text.slice(0, 200000));
          if (bodyPoint) {
            const result = {
              ...bodyPoint,
              resolvedUrl: finalUrl,
            };
            this.setCache(cacheKey, result);
            return result;
          }
        } catch {
          // ignore body parse errors
        }
        return null;
      }
      const result = { ...point, resolvedUrl: finalUrl };
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error(`Resolve map link failed: ${(error as Error)?.message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Extract lat/lng from a Google/Apple/OSM map URL or HTML blob.
   * Handles @lat,lng, ?q=/query=/ll=/destination=, mlat/mlon,
   * and Google's !3dLAT!4dLNG pin pattern.
   */
  private extractCoordsFromUrl(
    urlText: string,
  ): { lat: number; lng: number; label: string } | null {
    const numPair = (s: string | null): { lat: number; lng: number; label: string } | null => {
      if (!s) return null;
      const decoded = (() => {
        try {
          return decodeURIComponent(s);
        } catch {
          return s;
        }
      })();
      const m = decoded.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (!m) return null;
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return { lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    };

    // Google pin pattern: !3dLAT!4dLNG (most reliable for shared pins)
    const pin = urlText.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (pin) {
      const p = numPair(`${pin[1]},${pin[2]}`);
      if (p) return p;
    }

    try {
      const url = new URL(urlText);
      const q = (k: string) => url.searchParams.get(k);
      for (const key of ['q', 'query', 'll', 'destination', 'daddr', 'saddr']) {
        const p = numPair(q(key));
        if (p) return p;
      }
      const mlat = url.searchParams.get('mlat');
      const mlon = url.searchParams.get('mlon');
      if (mlat && mlon) {
        const p = numPair(`${mlat},${mlon}`);
        if (p) return p;
      }
      const at = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (at) {
        const p = numPair(`${at[1]},${at[2]}`);
        if (p) return p;
      }
      // Last resort: any lat,lng pair anywhere in the URL
      const generic = numPair(urlText);
      // Only trust generic match if host looks like a maps URL
      if (generic && /google|goo\.gl|apple|openstreetmap|waze/i.test(urlText)) return generic;
    } catch {
      // urlText may be an HTML blob, not a URL: try generic patterns
      const at = urlText.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (at) {
        const p = numPair(`${at[1]},${at[2]}`);
        if (p) return p;
      }
      return numPair(urlText);
    }
    return null;
  }
  async getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
    // This is a client-side operation
    // Return null and let the client handle geolocation
    return null;
  }

  /**
   * Zona de referencia más cercana a un GPS (detect → validar → tarifa).
   * Mientras las zonas sean `referenceOnly` (sin polígono), el resultado con
   * `confident: false` NO debe usarse para cobrar: pedir confirmación.
   * PUNTO DE EXTENSIÓN POSTGIS: el point-in-polygon vivirá en
   * orders/delivery-zones (findNearestZone); este método no cambia de firma.
   */
  nearestZone(lat: number, lng: number) {
    const match = findNearestZone(lat, lng);
    if (!match) return null;
    return {
      zone: { id: match.zone.id, label: match.zone.label, price: match.zone.price },
      distanceKm: Math.round(match.distanceKm * 100) / 100,
      confident: match.confident,
      runnerUp: match.runnerUp
        ? {
            zone: {
              id: match.runnerUp.zone.id,
              label: match.runnerUp.zone.label,
              price: match.runnerUp.zone.price,
            },
            distanceKm: Math.round(match.runnerUp.distanceKm * 100) / 100,
          }
        : null,
      referenceOnly: match.referenceOnly,
    };
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Format a short name from geocoding result
   */
  private formatShortName(item: any): string {
    const address = item.address || {};
    const parts: string[] = [];

    // Build short address
    if (address.house_number && address.road) {
      parts.push(`${address.road} ${address.house_number}`);
    } else if (address.road) {
      parts.push(address.road);
    } else if (address.neighbourhood) {
      parts.push(address.neighbourhood);
    }

    if (address.city || address.town || address.village) {
      parts.push(address.city || address.town || address.village);
    }

    return (
      parts.join(', ') ||
      item.display_name?.split(',').slice(0, 2).join(',') ||
      'Dirección desconocida'
    );
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });

    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }
}
