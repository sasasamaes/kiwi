import type { Http } from '@kiwi/mobile-core';

export interface EncomiendaInput {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  packageDescription: string;
  recipientName?: string;
  recipientPhone?: string;
  specialInstructions?: string;
}

export function encomiendaApi(http: Http) {
  return {
    // Crear encomienda de cliente registrado (`POST /orders/encomienda`).
    create: (data: EncomiendaInput, idempotencyKey?: string) =>
      http.post<any>(
        '/orders/encomienda',
        idempotencyKey ? { ...data, idempotencyKey } : data,
        idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
      ),
  };
}
