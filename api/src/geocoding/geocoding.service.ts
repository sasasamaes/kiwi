import { Injectable, Logger } from '@nestjs/common';

interface GeocodingResult {
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

interface ReverseGeocodingResult {
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
  private readonly userAgent = 'KiwiDeliveryApp/1.0 (https://kiwi-api-fe54.onrender.com)';

  // Cache for geocoding results (in production, use Redis)
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

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

      const response = await fetch(`${this.baseUrl}/search?${params.toString()}`, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

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

      const response = await fetch(`${this.baseUrl}/reverse?${params.toString()}`, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

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
   * Get current user location (browser geolocation)
   */
  async getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
    // This is a client-side operation
    // Return null and let the client handle geolocation
    return null;
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
