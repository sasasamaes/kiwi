// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { INK, KIWI, MUTED, downloadPdf, loadLogoBytes, pdfSafe } from '../pdf-utils';

export { downloadPdf };

export interface RechargeReceiptData {
  businessName: string;
  amount: number;
  balance: number;
  createdAt: Date | string;
  reason: string;
  transactionId: string | null;
}

/** Campos ya formateados del recibo (puro y testeable, sin PDF). */
export function buildRechargeReceipt(d: RechargeReceiptData) {
  const at = d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt);
  const date = Number.isNaN(at.getTime())
    ? '—'
    : at.toLocaleString('es-CR', {
        timeZone: 'America/Costa_Rica',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  const money = (n: number) => `₡${Math.round(Number(n) || 0).toLocaleString('es-CR')}`;
  return {
    title: 'Recibo de recarga de crédito',
    brand: 'KiWi Express · Nicoya, Guanacaste',
    folio: d.transactionId ? String(d.transactionId).slice(0, 8).toUpperCase() : '—',
    date,
    rows: [
      { label: 'Comercio', value: d.businessName || '—' },
      { label: 'Monto recargado', value: money(d.amount), big: true },
      { label: 'Saldo posterior', value: money(d.balance) },
      { label: 'Motivo', value: d.reason || 'Recarga prepago' },
    ],
    footer: 'kiwicr.express · contacto@kiwicr.express',
  };
}

export type ReceiptFields = ReturnType<typeof buildRechargeReceipt>;

/** Renderiza el recibo a PDF (bytes listos para descargar). */
export async function renderRechargeReceiptPdf(data: RechargeReceiptData): Promise<Uint8Array> {
  const f = buildRechargeReceipt(data);
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const { height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 56;
  let y = height - 70;

  // Franja de marca.
  page.drawRectangle({ x: 0, y: y - 28, width: 612, height: 92, color: KIWI });
  const logoBytes = await loadLogoBytes();
  const tx = M + (logoBytes ? 54 : 0);
  if (logoBytes) {
    try {
      const logo = await doc.embedPng(logoBytes);
      page.drawImage(logo, { x: M, y: y - 6, width: 44, height: 44 });
    } catch {
      // Sin logo: el recibo sale igual con la marca en texto.
    }
  }
  page.drawText('KiWi', { x: tx, y: y + 8, size: 26, font: bold, color: rgb(1, 1, 1) });
  page.drawText(pdfSafe(f.brand), { x: tx, y: y - 12, size: 11, font, color: rgb(1, 1, 1) });
  y -= 76;

  page.drawText(pdfSafe(f.title), { x: M, y, size: 20, font: bold, color: INK });
  y -= 22;
  page.drawText(pdfSafe(`Folio ${f.folio} - ${f.date}`), { x: M, y, size: 11, font, color: MUTED });
  y -= 34;

  for (const row of f.rows) {
    page.drawText(pdfSafe(row.label), { x: M, y, size: 11, font, color: MUTED });
    const size = (row as any).big ? 20 : 13;
    page.drawText(pdfSafe(row.value), {
      x: M,
      y: y - ((row as any).big ? 26 : 20),
      size,
      font: (row as any).big ? bold : font,
      color: (row as any).big ? KIWI : INK,
      maxWidth: 612 - M * 2,
    });
    y -= (row as any).big ? 52 : 42;
  }

  page.drawText(pdfSafe(f.footer), { x: M, y: 64, size: 10, font, color: MUTED });
  page.drawText(pdfSafe('Este recibo es constancia de recarga de crédito prepago KiWi.'), {
    x: M,
    y: 48,
    size: 10,
    font,
    color: MUTED,
  });

  return doc.save();
}
