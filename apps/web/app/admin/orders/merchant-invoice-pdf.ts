// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  INK,
  KIWI,
  MUTED,
  WHITE,
  downloadPdf,
  loadLogoBytes,
  moneyColones,
  pdfSafe,
} from '../pdf-utils';

export { downloadPdf };

export interface MerchantInvoiceRow {
  date: string;
  merchant: string;
  customer: string;
  total: number;
}

export interface MerchantInvoiceData {
  merchantName: string;
  from: string;
  to: string;
  rows: MerchantInvoiceRow[];
}

export interface MerchantInvoiceFields {
  title: string;
  brand: string;
  folio: string;
  merchantName: string;
  period: string;
  rows: Array<{ date: string; merchant: string; customer: string; total: string }>;
  tripCount: number;
  total: string;
  footer: string;
}

/** Campos de la factura para el comercio (puro y testeable, sin PDF). */
export function buildMerchantInvoice(d: MerchantInvoiceData): MerchantInvoiceFields {
  const folio =
    'F-' + String(d.from ?? '').replace(/\D/g, '') + '-' + String(d.to ?? '').replace(/\D/g, '');
  const total = d.rows.reduce((s, r) => s + Math.round(Number(r.total) || 0), 0);
  return {
    title: 'Factura / Resumen de pedidos',
    brand: 'KiWi Express · Nicoya, Guanacaste',
    folio,
    merchantName: d.merchantName || 'Todos los comercios',
    period: `${d.from || '…'} - ${d.to || '…'}`,
    rows: d.rows.map((r) => ({
      date: r.date,
      merchant: (r.merchant || '—').slice(0, 30),
      customer: (r.customer || '—').slice(0, 30),
      total: moneyColones(r.total),
    })),
    tripCount: d.rows.length,
    total: moneyColones(total),
    footer: 'kiwicr.express · contacto@kiwicr.express',
  };
}

const ROWS_PER_PAGE = 38;

/** Renderiza la factura a PDF (bytes listos para descargar). Pagina si hay muchos pedidos. */
export async function renderMerchantInvoicePdf(data: MerchantInvoiceData): Promise<Uint8Array> {
  const f = buildMerchantInvoice(data);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await loadLogoBytes();
  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (logoBytes) {
    try {
      logo = await doc.embedPng(logoBytes);
    } catch {
      logo = null;
    }
  }

  const pages = Math.max(1, Math.ceil(f.rows.length / ROWS_PER_PAGE));
  for (let p = 0; p < pages; p++) {
    const page = doc.addPage([612, 792]);
    const { height } = page.getSize();
    const M = 56;
    let y = height - 70;

    page.drawRectangle({ x: 0, y: y - 28, width: 612, height: 92, color: KIWI });
    const tx = M + (logo && p === 0 ? 54 : 0);
    if (logo && p === 0) page.drawImage(logo, { x: M, y: y - 6, width: 44, height: 44 });
    page.drawText('KiWi', { x: tx, y: y + 8, size: 26, font: bold, color: WHITE });
    page.drawText(pdfSafe(f.brand), { x: tx, y: y - 12, size: 11, font, color: WHITE });
    y -= 76;

    if (p === 0) {
      page.drawText(pdfSafe(f.title), { x: M, y, size: 20, font: bold, color: INK });
      y -= 22;
      page.drawText(pdfSafe(`Folio ${f.folio}`), { x: M, y, size: 11, font, color: MUTED });
      y -= 18;
      page.drawText(pdfSafe(`Comercio: ${f.merchantName}`), {
        x: M,
        y,
        size: 12,
        font: bold,
        color: INK,
      });
      y -= 18;
      page.drawText(pdfSafe(`Período: ${f.period} · ${f.tripCount} pedidos`), {
        x: M,
        y,
        size: 11,
        font,
        color: MUTED,
      });
      y -= 28;
    }

    const cols = [M, M + 36, M + 110, M + 310, M + 430];
    ['N°', 'Fecha', 'Comercio', 'Cliente', 'Total'].forEach((h, i) =>
      page.drawText(h, { x: cols[i], y, size: 10, font: bold, color: MUTED }),
    );
    y -= 16;
    const slice = f.rows.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
    slice.forEach((row, i) => {
      const n = String(p * ROWS_PER_PAGE + i + 1);
      page.drawText(n, { x: cols[0], y, size: 10, font, color: INK });
      page.drawText(pdfSafe(row.date), { x: cols[1], y, size: 10, font, color: INK });
      page.drawText(pdfSafe(row.merchant), {
        x: cols[2],
        y,
        size: 10,
        font,
        color: INK,
        maxWidth: 190,
      });
      page.drawText(pdfSafe(row.customer), {
        x: cols[3],
        y,
        size: 10,
        font,
        color: INK,
        maxWidth: 110,
      });
      page.drawText(pdfSafe(row.total), { x: cols[4], y, size: 10, font, color: INK });
      y -= 15;
    });

    if (p === pages - 1) {
      y -= 8;
      page.drawText(pdfSafe(`Total a pagar: ${f.total}`), {
        x: cols[3],
        y,
        size: 13,
        font: bold,
        color: KIWI,
      });
      page.drawText(pdfSafe(f.footer), { x: M, y: 48, size: 10, font, color: MUTED });
    } else {
      page.drawText(pdfSafe(f.footer), { x: M, y: 48, size: 10, font, color: MUTED });
    }
  }

  return doc.save();
}
