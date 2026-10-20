import type { Http } from '@kiwi/mobile-core';

export function flagsApi(http: Http) {
  return {
    // Feature flags públicos (`GET /settings/features`).
    features: () =>
      http.get<{
        encomiendaEnabled: boolean;
        mercaditoEnabled: boolean;
        bannersEnabled: boolean;
        mandadosEnabled: boolean;
        clientAppEnabled: boolean;
      }>('/settings/features'),
    // Banners patrocinados (`GET /ads/banners?city=`).
    banners: (city = 'nicoya') => http.get<any>(`/ads/banners?city=${encodeURIComponent(city)}`),
    // Métrica de sponsored (best-effort).
    recordAdEvent: (data: { campaignId?: string; broadcastId?: string; type: string }) =>
      http.post<any>('/ads/events', data),
  };
}
