import type { Http } from '@kiwi/mobile-core';

export function driversApi(http: Http) {
  return {
    // Perfil del repartidor (`GET /drivers/me`). Incluye kycStatus y
    // kycRequired: sin KYC aprobado no hay pedidos en el sistema.
    profile: () => http.get<any>('/drivers/me'),
    // Cambia el estado en el servidor (fuente de verdad para recibir
    // pedidos). El toggle local solo es espejo.
    updateStatus: (status: 'offline' | 'available' | 'busy') =>
      http.put<any>('/drivers/me/status', { status }),
    // Horario propuesto (`GET /drivers/me/schedule`).
    schedule: () => http.get<any>('/drivers/me/schedule'),
    // Ranking (`GET /drivers/me/ranking?period=`).
    ranking: (period = 'week') =>
      http.get<any>(`/drivers/me/ranking?period=${encodeURIComponent(period)}`),
    // Analíticas (`GET /analytics/driver?period=`).
    analytics: (period = 'week') =>
      http.get<any>(`/analytics/driver?period=${encodeURIComponent(period)}`),
    // Ubicación del repartidor (`PUT /drivers/me/location`).
    updateLocation: (lat: number, lng: number, orderId?: string) =>
      http.put<any>('/drivers/me/location', { lat, lng, orderId }),
    // Mis pedidos (`GET /drivers/me/orders?status=&take=`).
    myOrders: (status?: string, take?: number) => {
      const q = new URLSearchParams();
      if (status) q.append('status', status);
      if (take != null) q.append('take', String(take));
      const s = q.toString();
      return http.get<any>(`/drivers/me/orders${s ? `?${s}` : ''}`);
    },
    // Guarda el horario propuesto (bloques día+horas).
    updateSchedule: (schedules: any[]) => http.put<any>('/drivers/me/schedule', { schedules }),
  };
}
