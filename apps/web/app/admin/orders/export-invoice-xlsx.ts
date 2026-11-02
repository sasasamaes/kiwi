// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import ExcelJS from 'exceljs';

/**
 * Factura para el comercio (versión sin Comisión Kiwi): el IVA lo PAGA el
 * comercio (factura B2B: base + impuesto desglosado). Base gravada = Total,
 * IVA 13% = Base × 0.13, Total a pagar = Base + IVA. Todo con fórmulas: si
 * cambia un total, base/IVA/total se recalculan solos.
 */

export interface InvoiceXlsxRow {
  date: string;
  merchant: string;
  customer: string;
  total: number;
}

export interface InvoiceXlsxInput {
  titleRows: Array<[string, string]>;
  rows: InvoiceXlsxRow[];
}

const colLetter = (n: number): string => {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
};

export async function buildInvoiceWorkbook(input: InvoiceXlsxInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Factura');

  for (const [a, b] of input.titleRows) {
    const row = ws.addRow([a, b]);
    row.getCell(1).font = { bold: true };
  }
  ws.addRow([]);
  const header = ws.addRow([
    'N°',
    'Fecha',
    'Comercio',
    'Cliente',
    'Total (₡)',
    'Base gravada (₡)',
    'IVA 13% (₡)',
    'Total a pagar (₡)',
  ]);
  header.font = { bold: true };
  const firstDataRow = ws.rowCount + 1;

  // E:H = Total, F = Base (= Total), G = IVA (13% de la base), H = Total a pagar (Base + IVA).
  const T = colLetter(5);
  const B = colLetter(6);
  const V = colLetter(7);
  const N = colLetter(8);

  input.rows.forEach((o, i) => {
    const r = firstDataRow + i;
    const row = ws.addRow([
      i + 1,
      o.date,
      o.merchant,
      o.customer,
      Math.round(Number(o.total) || 0),
      { formula: `${T}${r}` },
      { formula: `ROUND(${T}${r}*0.13,0)` },
      { formula: `${B}${r}+${V}${r}` },
    ]);
    row.eachCell((c) => {
      c.numFmt = '#,##0';
    });
  });

  const lastDataRow = firstDataRow + input.rows.length - 1;
  const totalRow = ws.addRow(['TOTAL', '', '', '', '', '', '', '']);
  const tr = totalRow.number;
  (
    [
      [5, `SUM(${T}${firstDataRow}:${T}${lastDataRow})`],
      [6, `SUM(${B}${firstDataRow}:${B}${lastDataRow})`],
      [7, `SUM(${V}${firstDataRow}:${V}${lastDataRow})`],
      [8, `SUM(${N}${firstDataRow}:${N}${lastDataRow})`],
    ] as Array<[number, string]>
  ).forEach(([c, formula]) => {
    const cell = ws.getRow(tr).getCell(c);
    cell.value = { formula } as ExcelJS.CellValue;
    cell.numFmt = '#,##0';
    cell.font = { bold: true };
  });

  ws.columns.forEach((c) => {
    c.width = 20;
  });
  const buf: any = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
