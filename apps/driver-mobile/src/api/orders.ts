import type { Http } from '@kiwi/mobile-core';

export type DriverOrderStatus =
  'in_transit_to_pickup' | 'picked_up' | 'in_transit_to_delivery' | 'delivered';

export function ordersApi(http: Http) {
  return {
    available: () => http.get<any[]>('/orders/available'),
    availableScheduled: () => http.get<any[]>('/orders/available?scheduled=true'),
    propose: (id: string, data: { estimatedArrival: string; message?: string }) =>
      http.post<any>(`/orders/${id}/proposals`, data),
    mine: () => http.get<any[]>('/orders/my'),
    accept: (id: string) => http.post<any>(`/orders/${id}/accept`),
    reject: (id: string) => http.post<any>(`/orders/${id}/reject`),
    updateStatus: (id: string, status: DriverOrderStatus) =>
      http.put<any>(`/orders/${id}/status`, { status }),
    uploadProof: (id: string, form: FormData) =>
      http.postMultipart<any>(`/orders/${id}/proof-photo`, form),
    get: (id: string) => http.get<any>(`/orders/${id}`),
    // Registrar el monto de la factura de un mandado (`PUT /orders/:id/receipt`).
    setReceipt: (id: string, amount: number) => http.put<any>(`/orders/${id}/receipt`, { amount }),
  };
}
