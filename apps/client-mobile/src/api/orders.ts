import type { Http } from '@kiwi/mobile-core';

// The controller (`api/src/orders/orders.controller.ts`) reads the key from the
// `idempotency-key` header first and falls back to a body `idempotencyKey`.
// We always send the header; the body is left untouched.
const idempotency = (key: string) => ({ headers: { 'Idempotency-Key': key } });

export function ordersApi(http: Http) {
  return {
    // Customers use POST /orders/mine (@Roles('customer')); POST /orders is merchant-only.
    createAuthed: (body: any, idempotencyKey: string) =>
      http.post<any>('/orders/mine', body, idempotency(idempotencyKey)),
    createGuest: (body: any, idempotencyKey: string) =>
      http.post<any>('/orders/guest', body, idempotency(idempotencyKey)),
    mine: () => http.get<any[]>('/orders/my'),
    get: (id: string) => http.get<any>(`/orders/${id}`),
    // Public tracking (works for guests, no auth).
    track: (id: string) => http.get<any>(`/orders/track/${id}`),
    trackLocation: (id: string) => http.get<any>(`/orders/track/${id}/location`),
  };
}
