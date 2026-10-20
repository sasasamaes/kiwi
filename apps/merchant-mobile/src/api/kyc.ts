import type { Http } from '@kiwi/mobile-core';

export function kycApi(http: Http) {
  return {
    // Estado de verificación (`GET /kyc/status`).
    status: () => http.get<any>('/kyc/status'),
    // Inicia verificación Didit hospedada. Devuelve { url, sessionId, status }.
    startDidit: () =>
      http.post<{ url: string; sessionId: string; status: string }>('/kyc/didit/start'),
    // Pull manual de la decisión Didit (`POST /kyc/didit/refresh`).
    refreshDidit: () => http.post<any>('/kyc/didit/refresh'),
  };
}
