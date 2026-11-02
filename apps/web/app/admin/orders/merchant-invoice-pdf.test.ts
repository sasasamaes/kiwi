// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { describe, expect, it } from 'vitest';

import { buildMerchantInvoice, renderMerchantInvoicePdf } from './merchant-invoice-pdf';

const base = {
  merchantName: 'Soda La Esquina',
  from: '2026-10-26',
  to: '2026-11-02',
  rows: [
    { date: '02/11/2026', merchant: 'Soda', customer: 'Ana', total: 1500 },
    { date: '01/11/2026', merchant: 'Soda', customer: 'Luis', total: 2500 },
  ],
};

describe('buildMerchantInvoice', () => {
  it('arma encabezado, folio y total sin comisión ni neto', () => {
    const f = buildMerchantInvoice(base);
    expect(f.title).toBe('Factura / Resumen de pedidos');
    expect(f.folio).toBe('F-20261026-20261102');
    expect(f.merchantName).toBe('Soda La Esquina');
    expect(f.tripCount).toBe(2);
    expect(f.total.replace(/\D/g, '')).toBe('4000');
    expect(f.rows).toHaveLength(2);
    expect(JSON.stringify(f)).not.toMatch(/comisi|neto/i);
  });

  it('renderiza un PDF válido y pagina con muchos pedidos', async () => {
    const rows = Array.from({ length: 45 }, (_, i) => ({
      date: '02/11/2026',
      merchant: 'Soda',
      customer: `Cliente ${i + 1}`,
      total: 1000,
    }));
    const bytes = await renderMerchantInvoicePdf({ ...base, rows });
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });
});
