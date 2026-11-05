// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';

// pdf-lib no se usa acá, pero fetch sí existe en node; el módulo solo lo usa al renderizar.
import { buildInvoiceWorkbook } from './export-invoice-xlsx';

const base = {
  titleRows: [
    ['Comercio', 'Soda'],
    ['Rango', '2026-11-01 → 2026-11-02'],
  ] as Array<[string, string]>,
  rows: [
    { date: '02/11/2026', merchant: 'Soda', customer: 'Ana', total: 1500 },
    { date: '01/11/2026', merchant: 'Soda', customer: 'Luis', total: 1000 },
  ],
};

async function load(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  return wb.getWorksheet(1)!;
}

describe('buildInvoiceWorkbook', () => {
  it('IVA encima del total: base = total, IVA = 13%, neto = base + IVA', async () => {
    const buf = await buildInvoiceWorkbook(base);
    expect(buf.slice(0, 2).toString()).toBe('PK');
    const ws = await load(buf);
    // Encabezados fila 4: N° A, Fecha B, Comercio C, Cliente D, Total E, Base F, IVA G, Total a pagar H.
    expect(ws.getCell('A4').value).toBe('N°');
    expect(ws.getCell('E4').value).toBe('Total (₡)');
    expect(ws.getCell('F4').value).toBe('Base gravada (₡)');
    expect(ws.getCell('G4').value).toBe('IVA 13% (₡)');
    expect(ws.getCell('H4').value).toBe('Total a pagar (₡)');
    // Fila 5: Total E5=1500, Base F5=E5, IVA G5=13%, Neto H5=F5+G5.
    expect(ws.getCell('E5').value).toBe(1500);
    const baseCell = ws.getCell('F5').value as any;
    const iva = ws.getCell('G5').value as any;
    const neto = ws.getCell('H5').value as any;
    expect(baseCell.formula).toBe('E5');
    expect(iva.formula).toBe('ROUND(E5*0.13,0)');
    expect(neto.formula).toBe('F5+G5');
    // Total fila 7: SUM de cada columna.
    const totalNeto = ws.getCell('H7').value as any;
    expect(totalNeto.formula).toBe('SUM(H5:H6)');
    expect(ws.getCell('A7').value).toBe('TOTAL');
  });

  it('el comercio paga el IVA encima: 1500 + 195 = 1695', () => {
    const base = Math.round(1500);
    const iva = Math.round(1500 * 0.13);
    expect(base).toBe(1500);
    expect(iva).toBe(195);
    expect(base + iva).toBe(1695);
  });

  it('ninguna fórmula lleva = inicial', async () => {
    const buf = await buildInvoiceWorkbook(base);
    const ws = await load(buf);
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const v = cell.value as any;
        if (v && typeof v === 'object' && 'formula' in v) {
          expect(v.formula.startsWith('=')).toBe(false);
        }
      });
    });
  });

  it('withPhone: columna Teléfono tras Cliente y fórmulas corridas', async () => {
    const buf = await buildInvoiceWorkbook({
      ...base,
      withPhone: true,
      rows: [
        {
          date: '02/11/2026',
          merchant: 'Soda',
          customer: 'Ana',
          customerPhone: '8888-1234',
          total: 1500,
        },
      ],
    });
    const ws = await load(buf);
    // Encabezados: Teléfono E, Total F, Base G, IVA H, Total a pagar I.
    expect(ws.getCell('D4').value).toBe('Cliente');
    expect(ws.getCell('E4').value).toBe('Teléfono');
    expect(ws.getCell('F4').value).toBe('Total (₡)');
    expect(ws.getCell('I4').value).toBe('Total a pagar (₡)');
    // Fila 5: teléfono plano, Total F5=1500, Base G5=F5, IVA H5, Neto I5=G5+H5.
    expect(ws.getCell('E5').value).toBe('8888-1234');
    expect(ws.getCell('F5').value).toBe(1500);
    expect((ws.getCell('G5').value as any).formula).toBe('F5');
    expect((ws.getCell('H5').value as any).formula).toBe('ROUND(F5*0.13,0)');
    expect((ws.getCell('I5').value as any).formula).toBe('G5+H5');
    const totalNeto = ws.getCell('I6').value as any;
    expect(totalNeto.formula).toBe('SUM(I5:I5)');
  });
});
