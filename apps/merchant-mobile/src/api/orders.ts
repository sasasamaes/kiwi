import type { Http } from '@kiwi/mobile-core';

export function ordersApi(http: Http) {
  return {
    // Merchant comandas feed. The controller (`GET /orders/incoming`) currently
    // ignores `status`; the param is kept for forward compatibility.
    incoming: (status?: string) =>
      http.get<any[]>(`/orders/incoming${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    mine: () => http.get<any[]>('/orders/my'),
    get: (id: string) => http.get<any>(`/orders/${id}`),
    updateStatus: (id: string, status: string) => http.put<any>(`/orders/${id}/status`, { status }),
    // Multipart: the controller reads the file from the `photo` field and the
    // `kind` body field. The caller appends the `photo` file; we set `kind`.
    uploadPickupProof: (id: string, form: FormData) => {
      form.append('kind', 'pickup');
      return http.postMultipart<any>(`/orders/${id}/proof-photo`, form);
    },
    assign: (orderId: string, driverProfileId: string) =>
      http.put<any>(`/orders/${orderId}/assign`, { driverId: driverProfileId }),
  };
}
