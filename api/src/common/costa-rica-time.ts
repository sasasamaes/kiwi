// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Hora de Costa Rica (UTC-6 todo el año, sin horario de verano).
 *
 * El servidor corre en UTC (Render): `new Date(y, m, d)` y `toISOString()`
 * parten el "día" 6h corrido — un pedido de las 22:30 caía en el día
 * siguiente. Todo inicio de día/mes y toda llave diaria usa estas funciones,
 * que trabajan sobre tiempo absoluto (independientes del TZ del servidor).
 */

export const CR_OFFSET_MS = -6 * 60 * 60 * 1000;

/** Devuelve las partes Y/M/D del muro de CR para un instante dado. */
function crParts(now: Date): { y: number; m: number; d: number } {
  const cr = new Date(now.getTime() + CR_OFFSET_MS);
  return { y: cr.getUTCFullYear(), m: cr.getUTCMonth(), d: cr.getUTCDate() };
}

/** Medianoche CR de hoy, como Date (instante absoluto). */
export function startOfTodayCR(now: Date = new Date()): Date {
  const { y, m, d } = crParts(now);
  return new Date(Date.UTC(y, m, d) - CR_OFFSET_MS);
}

/** Medianoche CR del día 1 del mes actual menos `monthsBack`. */
export function startOfMonthCR(now: Date = new Date(), monthsBack = 0): Date {
  const { y, m } = crParts(now);
  const total = y * 12 + m - monthsBack;
  const yy = Math.floor(total / 12);
  const mm = ((total % 12) + 12) % 12;
  return new Date(Date.UTC(yy, mm, 1) - CR_OFFSET_MS);
}

/** Medianoche CR del 1° de enero del año actual. */
export function startOfYearCR(now: Date = new Date()): Date {
  const { y } = crParts(now);
  return new Date(Date.UTC(y, 0, 1) - CR_OFFSET_MS);
}

/** Llave diaria YYYY-MM-DD en muro CR (para buckets de gráficos). */
export function toCRDateKey(d: Date | string): string {
  const t = d instanceof Date ? d : new Date(d);
  const cr = new Date(t.getTime() + CR_OFFSET_MS);
  const y = cr.getUTCFullYear();
  const m = String(cr.getUTCMonth() + 1).padStart(2, '0');
  const day = String(cr.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parsea fecha de input datetime-local ("2026-09-22T18:00", sin offset)
 * como hora de Costa Rica. Si ya trae offset/Z se respeta.
 */
export function parseScheduledCR(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim();
  let d: Date;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    d = new Date(s);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    d = new Date(`${s}T00:00:00-06:00`);
  } else {
    d = new Date(`${s}-06:00`);
  }
  return isNaN(d.getTime()) ? null : d;
}
