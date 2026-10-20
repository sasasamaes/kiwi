import type { Http } from '@kiwi/mobile-core';

export function analyticsApi(http: Http) {
  return {
    // Números del negocio (`GET /analytics/merchant?period=`).
    merchant: (period = 'week') =>
      http.get<any>(`/analytics/merchant?period=${encodeURIComponent(period)}`),
  };
}
