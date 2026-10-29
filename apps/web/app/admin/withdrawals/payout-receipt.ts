// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface PayoutTrip {
  orderId: string;
  deliveredAt?: string | null;
  merchant?: string | null;
  trip?: number | null;
  payout: number;
}

export interface PayoutReceiptData {
  id: string;
  amount: number;
  status?: string;
  paymentMethod?: string | null;
  sinpePhone?: string | null;
  sinpeName?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  transactionId?: string | null;
  createdAt?: string | null;
  driver?: { fullName?: string | null; phone?: string | null; email?: string | null };
  trips: PayoutTrip[];
  tripsTotal: number;
  tripCount: number;
}

const crDate = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CR', {
    timeZone: 'America/Costa_Rica',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const money = (n: number) => `₡${Math.round(Number(n) || 0).toLocaleString('es-CR')}`;

/** Campos del recibo de pago de corte (puro y testeable, sin PDF). */
export function buildPayoutReceipt(r: PayoutReceiptData) {
  const method = (() => {
    if (r.paymentMethod === 'sinpe')
      return `SINPE ${r.sinpePhone ?? '—'}${r.sinpeName ? ` (${r.sinpeName})` : ''}`;
    if (r.paymentMethod === 'bank_transfer')
      return `${r.bankName ?? 'Banco'} ${r.accountNumber ?? '—'}${r.accountHolder ? ` (${r.accountHolder})` : ''}`;
    return r.paymentMethod ?? '—';
  })();
  return {
    title: 'Recibo de pago de corte',
    brand: 'KiWi Express · Nicoya, Guanacaste',
    folio:
      String(r.id ?? '')
        .slice(0, 8)
        .toUpperCase() || '—',
    driver: r.driver?.fullName ?? '—',
    phone: r.driver?.phone ?? '—',
    period: `${crDate(r.periodStart)} – ${crDate(r.periodEnd)}`,
    method,
    voucher: r.transactionId ?? '—',
    issued: crDate(r.createdAt),
    rows: (r.trips ?? []).map((t) => ({
      date: crDate(t.deliveredAt),
      merchant: (t.merchant ?? `#${String(t.orderId ?? '').slice(0, 8)}`).slice(0, 34),
      payout: money(t.payout),
    })),
    tripCount: r.tripCount ?? (r.trips ?? []).length,
    tripsTotal: money(r.tripsTotal),
    amount: money(r.amount),
    footer: 'kiwicr.express · contacto@kiwicr.express',
  };
}

export type PayoutReceiptFields = ReturnType<typeof buildPayoutReceipt>;

/** WinAnsi (Helvetica) no trae ₡ ni emojis: se normaliza al dibujar. */
const pdfSafe = (s: string) => String(s ?? '').replace(/₡/g, 'CRC ');

const KIWI = rgb(0.13, 0.5, 0.24); // kiwi-700
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.42, 0.42);

async function loadLogoBytes(): Promise<Uint8Array | null> {
  try {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch('/kiwi-logo.png');
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const ROWS_PER_PAGE = 38;

/** Renderiza el recibo a PDF (bytes listos para descargar). Pagina si hay muchos viajes. */
export async function renderPayoutReceiptPdf(data: PayoutReceiptData): Promise<Uint8Array> {
  const f = buildPayoutReceipt(data);
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

    // Franja de marca (solo primera página lleva título completo).
    page.drawRectangle({ x: 0, y: y - 28, width: 612, height: 92, color: KIWI });
    const tx = M + (logo && p === 0 ? 54 : 0);
    if (logo && p === 0) page.drawImage(logo, { x: M, y: y - 6, width: 44, height: 44 });
    page.drawText('KiWi', { x: tx, y: y + 8, size: 26, font: bold, color: rgb(1, 1, 1) });
    page.drawText(pdfSafe(f.brand), { x: tx, y: y - 12, size: 11, font, color: rgb(1, 1, 1) });
    y -= 76;

    if (p === 0) {
      page.drawText(pdfSafe(f.title), { x: M, y, size: 20, font: bold, color: INK });
      y -= 22;
      page.drawText(pdfSafe(`Folio ${f.folio} · Emitido ${f.issued}`), {
        x: M,
        y,
        size: 11,
        font,
        color: MUTED,
      });
      y -= 20;
      page.drawText(pdfSafe(`Repartidor: ${f.driver} · ${f.phone}`), {
        x: M,
        y,
        size: 11,
        font,
        color: INK,
      });
      y -= 18;
      page.drawText(pdfSafe(`Período: ${f.period}`), { x: M, y, size: 11, font, color: INK });
      y -= 18;
      page.drawText(pdfSafe(`Método: ${f.method}`), { x: M, y, size: 11, font, color: INK });
      y -= 18;
      page.drawText(pdfSafe(`Comprobante: ${f.voucher}`), { x: M, y, size: 11, font, color: INK });
      y -= 28;
    }

    // Tabla de viajes.
    const cols = [M, M + 130, M + 380];
    const head = ['Fecha', 'Comercio', 'Ganancia'];
    head.forEach((h, i) => page.drawText(h, { x: cols[i], y, size: 10, font: bold, color: MUTED }));
    y -= 16;
    const slice = f.rows.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
    for (const row of slice) {
      page.drawText(pdfSafe(row.date), { x: cols[0], y, size: 10, font, color: INK });
      page.drawText(pdfSafe(row.merchant), {
        x: cols[1],
        y,
        size: 10,
        font,
        color: INK,
        maxWidth: 230,
      });
      page.drawText(pdfSafe(row.payout), { x: cols[2], y, size: 10, font, color: INK });
      y -= 15;
    }

    // Totales solo en la última página.
    if (p === pages - 1) {
      y -= 8;
      page.drawText(pdfSafe(`Viajes: ${f.tripCount}`), {
        x: cols[0],
        y,
        size: 11,
        font: bold,
        color: INK,
      });
      page.drawText(pdfSafe(`Total viajes: ${f.tripsTotal}`), {
        x: cols[1],
        y,
        size: 11,
        font: bold,
        color: INK,
      });
      y -= 20;
      page.drawText(pdfSafe(`Monto pagado: ${f.amount}`), {
        x: cols[0],
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

/** Descarga bytes como archivo (solo navegador). */
export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
