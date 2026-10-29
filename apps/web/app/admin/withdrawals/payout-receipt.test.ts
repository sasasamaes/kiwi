// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { describe, expect, it } from 'vitest';

import { buildPayoutReceipt, renderPayoutReceiptPdf } from './payout-receipt';

const base = {
  id: 'abcdef1234567890',
  amount: 6375,
  status: 'completed',
  paymentMethod: 'sinpe',
  sinpePhone: '88881234',
  sinpeName: 'Luis',
  periodStart: '2026-10-26T06:00:00.000Z',
  periodEnd: '2026-11-02T06:00:00.000Z',
  transactionId: 'SINPE-1',
  createdAt: '2026-11-04T00:00:00.000Z',
  driver: { fullName: 'Luis Espinoza', phone: '88881234' },
  trips: [
    {
      orderId: 'o1',
      deliveredAt: '2026-10-28T20:00:00.000Z',
      merchant: 'Soda',
      trip: 1000,
      payout: 850,
    },
    {
      orderId: 'o2',
      deliveredAt: '2026-10-29T20:00:00.000Z',
      merchant: null,
      trip: 2000,
      payout: 5525,
    },
  ],
  tripsTotal: 6375,
  tripCount: 2,
};

describe('buildPayoutReceipt', () => {
  it('arma encabezado, método SINPE y totales', () => {
    const f = buildPayoutReceipt(base);
    expect(f.title).toBe('Recibo de pago de corte');
    expect(f.folio).toBe('ABCDEF12');
    expect(f.driver).toBe('Luis Espinoza');
    expect(f.method).toContain('88881234');
    expect(f.amount.replace(/\D/g, '')).toBe('6375');
    expect(f.rows).toHaveLength(2);
    expect(f.rows[1].merchant).toContain('#o2');
  });

  it('método transferencia muestra banco y cuenta', () => {
    const f = buildPayoutReceipt({
      ...base,
      paymentMethod: 'bank_transfer',
      bankName: 'BN',
      accountNumber: '123',
      accountHolder: 'Luis',
      sinpePhone: null,
      sinpeName: null,
    });
    expect(f.method).toContain('BN');
    expect(f.method).toContain('123');
  });

  it('renderiza un PDF válido', async () => {
    const bytes = await renderPayoutReceiptPdf(base);
    expect(bytes.length).toBeGreaterThan(500);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });
});
