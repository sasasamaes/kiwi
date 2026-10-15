import type { Http } from '@kiwi/mobile-core';
import { queryString } from './query';

export interface DiscoverParams {
  city?: string;
  q?: string;
  take?: number;
  lat?: number;
  lng?: number;
  category?: string;
}

export function menuApi(http: Http) {
  return {
    discover: (params: DiscoverParams = {}) =>
      http.get<any[]>(`/merchants/discover${queryString(params)}`),
    publicProfile: (id: string) => http.get<any>(`/menu/merchant/${id}`),
    items: (id: string, category?: string) =>
      http.get<any[]>(`/menu/merchant/${id}/items${queryString({ category })}`),
    tomorrow: (city?: string) => http.get<any[]>(`/menu/tomorrow${queryString({ city })}`),
  };
}
