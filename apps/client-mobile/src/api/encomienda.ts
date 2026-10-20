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

export interface MandadoInput extends EncomiendaInput {
  purchaseStore: string;
  purchaseEstimate: number;
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
    // Crear mandado (compra presencial + 10% fee) (`POST /orders/mandado`).
    createMandado: (data: MandadoInput, idempotencyKey?: string) =>
      http.post<any>(
        '/orders/mandado',
        idempotencyKey ? { ...data, idempotencyKey } : data,
        idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
      ),
  };
}
