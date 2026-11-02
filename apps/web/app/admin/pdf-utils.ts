// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { rgb } from 'pdf-lib';

/** Helpers compartidos de los PDF con marca KiWi (recibos y facturas). */

export const KIWI = rgb(0.13, 0.5, 0.24); // kiwi-700
export const INK = rgb(0.1, 0.1, 0.1);
export const MUTED = rgb(0.42, 0.42, 0.42);
export const WHITE = rgb(1, 1, 1);

/** WinAnsi (Helvetica) no trae ₡ ni emojis: se normaliza al dibujar. */
export const pdfSafe = (s: string) => String(s ?? '').replace(/₡/g, 'CRC ');

export const moneyColones = (n: number) => `₡${Math.round(Number(n) || 0).toLocaleString('es-CR')}`;

/** Logo de marca (/public). Null si no carga: el PDF sale igual con texto. */
export async function loadLogoBytes(): Promise<Uint8Array | null> {
  try {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch('/kiwi-logo.png');
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
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
