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
 */ export function parseScheduledCR(raw: unknown): Date | null {
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

/** Día de la semana 0=dom…6=sáb en muro CR (para horarios y disponibles). */
export function crWeekday(date: Date = new Date()): number {
  return new Date(date.getTime() + CR_OFFSET_MS).getUTCDay();
}

/** HH:MM actual en muro CR (para comparar contra openingHours). */
export function crTimeHHMM(date: Date = new Date()): string {
  const cr = new Date(date.getTime() + CR_OFFSET_MS);
  return `${String(cr.getUTCHours()).padStart(2, '0')}:${String(cr.getUTCMinutes()).padStart(2, '0')}`;
}

/** Hora 0–23 en muro CR (para comparar contra horas ya calculadas en CR). */
export function crHour(date: Date = new Date()): number {
  return new Date(date.getTime() + CR_OFFSET_MS).getUTCHours();
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Valida YYYY-MM-DD calendario (sin rollover silencioso) o null. */
function parseISODateParts(raw: unknown): { y: number; m: number; d: number } | null {
  if (typeof raw !== 'string') return null;
  const m = ISO_DAY.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
  return { y, m: mo, d };
}

/** 00:00 CR de ese día, como instante absoluto (06:00 UTC). */
export function crDayStartISO(raw: unknown): Date | null {
  const p = parseISODateParts(raw);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d, 6));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** 00:00 CR del día SIGUIENTE (borde `lt` inclusivo del día). */
export function crDayEndExclusiveISO(raw: unknown): Date | null {
  const p = parseISODateParts(raw);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + 1, 6));
  return Number.isNaN(dt.getTime()) ? null : dt;
}
