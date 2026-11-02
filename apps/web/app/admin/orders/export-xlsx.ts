// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import ExcelJS from 'exceljs';

/**
 * Exportación a Excel con FÓRMULAS (no valores fijos): si el admin cambia un
 * precio, comisión/IVA/neto y totales se recalculan solos. Las fórmulas se
 * guardan en forma canónica (comas, punto decimal) y cada app las muestra
 * en su locale — por eso no sirve un CSV con texto.
 */

export interface ExportXlsxRow {
  merchant: string;
  customer: string;
  driver: string;
  date: string;
  time: string;
  status: string;
  isTest: boolean;
  total: number;
}

export interface ExportXlsxInput {
  /** Filas de título arriba: [[etiqueta, valor], ...]. */
  titleRows: Array<[string, string]>;
  /** Encabezados de columnas de datos (sin la col TEST, la pone el módulo). */
  headers: string[];
  testHeader: string;
  totalRealLabel: string;
  totalTestLabel: string;
  moneyHeaders: { total: string; fee: string; iva: string; net: string };
  rows: ExportXlsxRow[];
  includeTest: boolean;
  includeIva: boolean;
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

export async function buildOrdersWorkbook(input: ExportXlsxInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Pedidos');

  for (const [a, b] of input.titleRows) {
    const row = ws.addRow([a, b]);
    row.getCell(1).font = { bold: true };
  }
  ws.addRow([]);

  // Columnas base + TEST opcional + dinero.
  const baseCount = input.headers.length;
  const testCol = input.includeTest ? baseCount + 1 : 0;
  const totalCol = baseCount + (input.includeTest ? 1 : 0) + 1;
  const feeCol = totalCol + 1;
  const ivaCol = input.includeIva ? feeCol + 1 : 0;
  const netCol = feeCol + (input.includeIva ? 2 : 1);

  const headerLabels = [...input.headers];
  if (input.includeTest) headerLabels.push(input.testHeader);
  headerLabels.push(input.moneyHeaders.total);
  headerLabels.push(input.moneyHeaders.fee);
  if (input.includeIva) headerLabels.push(input.moneyHeaders.iva);
  headerLabels.push(input.moneyHeaders.net);
  const header = ws.addRow(headerLabels);
  header.font = { bold: true };
  const firstDataRow = ws.rowCount + 1;

  const T = colLetter(totalCol);
  const F = colLetter(feeCol);
  const V = ivaCol ? colLetter(ivaCol) : '';
  const N = colLetter(netCol);

  input.rows.forEach((o, i) => {
    const r = firstDataRow + i;
    ws.addRow([]);
    const row = ws.getRow(r);
    const vals: unknown[] = [i + 1, o.merchant, o.customer, o.driver, o.date, o.time, o.status];
    if (input.includeTest) vals.push(o.isTest ? 'TEST' : '');
    vals.push(Math.round(Number(o.total) || 0));
    // OJO: exceljs guarda la fórmula SIN '=' inicial. Con '=' el XML queda
    // inválido y Sheets muestra #ERROR! (le pasó a la columna Neto).
    vals.push({ formula: `ROUND(${T}${r}*0.15,0)` });
    if (input.includeIva) vals.push({ formula: `ROUND(${T}${r}*0.13,0)` });
    vals.push({ formula: input.includeIva ? `${T}${r}-${F}${r}-${V}${r}` : `${T}${r}-${F}${r}` });
    vals.forEach((v, ci) => {
      row.getCell(ci + 1).value = v as ExcelJS.CellValue;
    });
  });

  const lastDataRow = firstDataRow + input.rows.length - 1;
  const moneyFmt = '#,##0';
  for (let r = firstDataRow; r <= lastDataRow; r++) {
    for (const c of [totalCol, feeCol, ...(ivaCol ? [ivaCol] : []), netCol]) {
      ws.getRow(r).getCell(c).numFmt = moneyFmt;
    }
  }

  const sumOr = (col: string, crit: string | null) =>
    crit == null
      ? `SUM(${col}${firstDataRow}:${col}${lastDataRow})`
      : `SUMIF(${colLetter(testCol)}$${firstDataRow}:${colLetter(testCol)}$${lastDataRow},"${crit}",${col}$${firstDataRow}:${col}${lastDataRow})`;

  const totalRow = ws.addRow([]);
  const setTotal = (rowNum: number, label: string, crit: string | null) => {
    const row = ws.getRow(rowNum);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    const targets: Array<[number, string]> = [
      [totalCol, sumOr(T, crit)],
      [feeCol, sumOr(F, crit)],
    ];
    if (ivaCol) targets.push([ivaCol, sumOr(V, crit)]);
    targets.push([netCol, sumOr(N, crit)]);
    for (const [c, formula] of targets) {
      const cell = row.getCell(c);
      cell.value = { formula } as ExcelJS.CellValue;
      cell.numFmt = moneyFmt;
      cell.font = { bold: true };
    }
  };
  setTotal(totalRow.number, input.totalRealLabel, input.includeTest ? '' : null);
  if (input.includeTest && input.rows.some((o) => o.isTest)) {
    const row2 = ws.addRow([]);
    setTotal(row2.number, input.totalTestLabel, 'TEST');
  }

  ws.columns.forEach((c) => {
    c.width = 18;
  });
  const buf: any = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
