// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.

/**
 * Fechas de gráficos: el API manda "YYYY-MM-DD" (daily30 de pagos) pero otros
 * callers mandan epoch (number o string numérico). `new Date(Number(v))` sobre
 * "2026-10-15" da NaN → "Invalid Date" en ejes y tooltips. Esto acepta ambas
 * formas y nunca devuelve fecha inválida (null = no mostrar tick).
 */
export function parseChartDate(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const d = new Date(Number(trimmed));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    // "YYYY-MM-DD": mediodía local para que el timezone no lo mueva de día.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export const fmtDayShort = (value: unknown): string => {
  const d = parseChartDate(value);
  return d ? d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }) : '';
};

export const fmtDayLong = (value: unknown): string => {
  const d = parseChartDate(value);
  return d ? d.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
};
