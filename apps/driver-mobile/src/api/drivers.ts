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
  };
}
