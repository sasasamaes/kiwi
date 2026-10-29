// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { describe, expect, it } from 'vitest';

import { buildRechargeReceipt, renderRechargeReceiptPdf } from './receipt';

describe('buildRechargeReceipt', () => {
  it('arma los campos del recibo con marca y folio corto', () => {
    const f = buildRechargeReceipt({
      businessName: 'Soda La Esquina',
      amount: 10000,
      balance: 25000,
      createdAt: '2026-10-29T18:00:00.000Z',
      reason: 'Paquete prepago semanal',
      transactionId: 'abcdef1234567890',
    });
    expect(f.title).toBe('Recibo de recarga de crédito');
    expect(f.folio).toBe('ABCDEF12');
    expect(f.rows.find((r) => r.label === 'Comercio')?.value).toBe('Soda La Esquina');
    expect(f.rows.find((r) => r.label === 'Monto recargado')?.value.replace(/\D/g, '')).toBe(
      '10000',
    );
    expect(f.rows.find((r) => r.label === 'Saldo posterior')?.value.replace(/\D/g, '')).toBe(
      '25000',
    );
    expect(f.rows.find((r) => r.label === 'Motivo')?.value).toBe('Paquete prepago semanal');
    expect(f.date).toContain('2026');
  });

  it('tolera folio ausente y fecha inválida', () => {
    const f = buildRechargeReceipt({
      businessName: '',
      amount: 0,
      balance: 0,
      createdAt: 'no-fecha',
      reason: '',
      transactionId: null,
    });
    expect(f.folio).toBe('—');
    expect(f.date).toBe('—');
    expect(f.rows.find((r) => r.label === 'Comercio')?.value).toBe('—');
  });

  it('renderiza un PDF válido', async () => {
    const bytes = await renderRechargeReceiptPdf({
      businessName: 'Soda La Esquina',
      amount: 10000,
      balance: 25000,
      createdAt: '2026-10-29T18:00:00.000Z',
      reason: 'Paquete prepago semanal',
      transactionId: 'abcdef1234567890',
    });
    expect(bytes.length).toBeGreaterThan(500);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });
});
