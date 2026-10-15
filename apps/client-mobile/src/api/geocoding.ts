import type { Http } from '@kiwi/mobile-core';
import { queryString } from './query';

export function geocodingApi(http: Http) {
  return {
    search: (q: string, limit?: number) =>
      http.get<any[]>(`/geocoding/search${queryString({ q, limit })}`),
    searchNicoya: (q: string, limit?: number) =>
      http.get<any[]>(`/geocoding/search/nicoya${queryString({ q, limit })}`),
    reverse: (lat: number, lng: number) =>
      http.get<any>(`/geocoding/reverse${queryString({ lat, lng })}`),
    nearestZone: (lat: number, lng: number) =>
      http.get<any>(`/geocoding/nearest-zone${queryString({ lat, lng })}`),
  };
}
