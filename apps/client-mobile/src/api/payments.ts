import type { Http } from '@kiwi/mobile-core';

export function paymentsApi(http: Http) {
  return {
    createAuthed: (body: any) => http.post<any>('/payments/create', body),
    createGuest: (body: any) => http.post<any>('/payments/guest', body),
    status: (orderId: string) => http.get<any>(`/payments/status/${orderId}`),
    publicStatus: (orderId: string) => http.get<any>(`/payments/public-status/${orderId}`),
  };
}
