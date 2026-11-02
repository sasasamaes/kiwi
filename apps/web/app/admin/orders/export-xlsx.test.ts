// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';

import { buildOrdersWorkbook } from './export-xlsx';

const base = {
  titleRows: [
    ['Comercio', 'Soda'],
    ['Rango', '2026-11-01 → 2026-11-02'],
  ] as Array<[string, string]>,
  headers: ['N°', 'Comercio', 'Cliente', 'Repartidor', 'Fecha', 'Hora', 'Estado'],
  testHeader: 'Test',
  totalRealLabel: 'TOTAL REALES',
  totalTestLabel: 'TOTAL TEST (no pagable)',
  moneyHeaders: { fee: 'Comisión Kiwi 15% (₡)', iva: 'IVA 13% (₡)', net: 'Neto comercio (₡)' },
};

const row = (over: any = {}) => ({
  merchant: 'Soda',
  customer: 'Ana',
  driver: 'Luis',
  date: '02/11/2026',
  time: '10:00',
  status: 'Entregado',
  isTest: false,
  total: 1500,
  ...over,
});

async function load(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await (wb.xlsx as any).load(buf);
  return wb.getWorksheet(1)!;
}

describe('buildOrdersWorkbook', () => {
  it('calculadas con fórmulas (comisión, iva, neto)', async () => {
    const buf = await buildOrdersWorkbook({
      ...base,
      rows: [row(), row({ total: 1000 })],
      includeTest: true,
      includeIva: true,
    });
    expect(buf.slice(0, 2).toString()).toBe('PK');
    const ws = await load(buf);
    // Fila 5 = primer pedido: Total I5=1500, fee J5, iva K5, neto L5.
    const fee = ws.getCell('J5').value as any;
    const iva = ws.getCell('K5').value as any;
    const neto = ws.getCell('L5').value as any;
    expect(fee.formula).toBe('ROUND(I5*0.15,0)');
    expect(iva.formula).toBe('ROUND(I5*0.13,0)');
    expect(neto.formula).toBe('I5-J5-K5');
    expect(ws.getCell('I5').value).toBe(1500);
  });

  it('ninguna fórmula lleva = inicial (rompe el XML en Sheets)', async () => {
    const buf = await buildOrdersWorkbook({
      ...base,
      rows: [row(), row({ isTest: true, total: 1000 })],
      includeTest: true,
      includeIva: true,
    });
    const ws = await load(buf);
    ws.eachRow((r) => {
      r.eachCell((c) => {
        const v = c.value as any;
        if (v && typeof v === 'object' && 'formula' in v) {
          expect(v.formula.startsWith('=')).toBe(false);
        }
      });
    });
  });

  it('totales con SUMIF separando reales y test', async () => {
    const buf = await buildOrdersWorkbook({
      ...base,
      rows: [row(), row({ isTest: true, total: 1000 })],
      includeTest: true,
      includeIva: false,
    });
    const ws = await load(buf);
    // Sin IVA: Total I, Comisión J, Neto K. Totales en fila 7 y 8.
    const realNet = ws.getCell('K7').value as any;
    const testNet = ws.getCell('K8').value as any;
    expect(realNet.formula).toContain('SUMIF');
    expect(realNet.formula).toContain('"",');
    expect(testNet.formula).toContain('"TEST"');
    expect(ws.getCell('A7').value).toBe('TOTAL REALES');
    expect(ws.getCell('A8').value).toBe('TOTAL TEST (no pagable)');
  });

  it('sin tests ni iva usa SUM simple', async () => {
    const buf = await buildOrdersWorkbook({
      ...base,
      rows: [row()],
      includeTest: false,
      includeIva: false,
    });
    const ws = await load(buf);
    const netoTotal = ws.getCell('J6').value as any;
    expect(netoTotal.formula).toBe('SUM(J5:J5)');
  });
});
