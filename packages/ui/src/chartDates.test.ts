// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { describe, it, expect } from 'vitest';
import { parseChartDate, fmtDayShort, fmtDayLong } from './chartDates';

/**
 * Regresión del "Invalid Date" en /admin/payments: el API manda "YYYY-MM-DD"
 * y el gráfico hacía new Date(Number(v)) → NaN.
 */
describe('parseChartDate', () => {
  it('parsea "YYYY-MM-DD" sin moverse de día por timezone', () => {
    const d = parseChartDate('2026-10-15');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(9);
    expect(d?.getDate()).toBe(15);
  });

  it('acepta epoch como number y como string numérico', () => {
    const epoch = new Date(2026, 9, 15, 12).getTime();
    expect(parseChartDate(epoch)?.getDate()).toBe(15);
    expect(parseChartDate(String(epoch))?.getDate()).toBe(15);
  });

  it('devuelve null con basura (el tick se omite, no dice Invalid Date)', () => {
    expect(parseChartDate('no-fecha')).toBeNull();
    expect(parseChartDate(undefined)).toBeNull();
    expect(parseChartDate(NaN)).toBeNull();
  });

  it('los formatters nunca devuelven "Invalid Date"', () => {
    expect(fmtDayShort('2026-10-15')).not.toContain('Invalid');
    expect(fmtDayShort('2026-10-15')).toContain('15');
    expect(fmtDayLong('2026-10-15')).not.toContain('Invalid');
    expect(fmtDayShort('basura')).toBe('');
    expect(fmtDayLong('basura')).toBe('');
  });
});
