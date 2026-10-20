import type { Http } from '@kiwi/mobile-core';

export function profileApi(http: Http) {
  return {
    // Usuario actual (`GET /users/me`).
    me: () => http.get<any>('/users/me'),
    // Editar usuario (`PUT /users/me`).
    updateMe: (data: any) => http.put<any>('/users/me', data),
    // Perfil del comercio (`GET /merchants/me`).
    merchantProfile: () => http.get<any>('/merchants/me'),
    // Editar perfil del comercio (`PUT /merchants/me`).
    updateMerchantProfile: (data: any) => http.put<any>('/merchants/me', data),
    // Visible/oculto en la app cliente.
    setVisibility: (listed: boolean) => http.put<any>('/merchants/me/visibility', { listed }),
  };
}
