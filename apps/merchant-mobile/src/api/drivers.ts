import type { Http } from '@kiwi/mobile-core';

export function driversApi(http: Http) {
  return {
    // Merchant/admin view of online drivers (`GET /drivers/available`).
    available: (lat?: number, lng?: number) => {
      const q = [
        lat != null ? `lat=${encodeURIComponent(String(lat))}` : '',
        lng != null ? `lng=${encodeURIComponent(String(lng))}` : '',
      ]
        .filter(Boolean)
        .join('&');
      return http.get<any[]>(`/drivers/available${q ? `?${q}` : ''}`);
    },
    // Favorite drivers live under the merchant profile
    // (`GET /merchants/me/favorites`), not under /drivers.
    favorites: () => http.get<any[]>('/merchants/me/favorites'),
    addFavorite: (driverId: string) => http.post<any>(`/merchants/me/favorites/${driverId}`),
    removeFavorite: (driverId: string) => http.delete<any>(`/merchants/me/favorites/${driverId}`),
  };
}
