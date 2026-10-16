// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { isOpenNow, offeredToday } from '../merchants/opening-hours';
import { crWeekday, crTimeHHMM } from '../common/costa-rica-time';

// Jueves 2026-10-08 10:00 CR = 16:00 UTC (el server corre en UTC).
const THU_10CR = new Date('2026-10-08T16:00:00Z');
// Lunes 2026-10-05 10:00 CR.
const MON_10CR = new Date('2026-10-05T16:00:00Z');

describe('costa-rica-time', () => {
  it('crWeekday usa muro CR aunque el server esté en UTC', () => {
    // 16:00 UTC del jueves = jueves en CR (no viernes).
    expect(crWeekday(THU_10CR)).toBe(4);
    expect(crWeekday(MON_10CR)).toBe(1);
  });

  it('crTimeHHMM devuelve la hora CR', () => {
    expect(crTimeHHMM(THU_10CR)).toBe('10:00');
  });
});

describe('isOpenNow', () => {
  const hours = { thursday: { open: '08:00', close: '17:00' } };

  it('sin horarios → abierto', () => {
    expect(isOpenNow(null)).toBe(true);
    expect(isOpenNow(undefined)).toBe(true);
    // Objeto vacío = comercio "por pedido" (sin días configurados) → abierto.
    expect(isOpenNow({})).toBe(true);
  });

  it('día ausente → cerrado (emprendedora "solo jueves")', () => {
    expect(isOpenNow(hours, MON_10CR)).toBe(false);
  });

  it('día presente dentro del rango → abierto', () => {
    expect(isOpenNow(hours, THU_10CR)).toBe(true);
  });

  it('día presente fuera del rango → cerrado', () => {
    // Jueves 20:00 CR = viernes 02:00 UTC.
    expect(isOpenNow(hours, new Date('2026-10-09T02:00:00Z'))).toBe(false);
  });
});

describe('offeredToday', () => {
  it('vacío/ausente = todos los días', () => {
    expect(offeredToday([], THU_10CR)).toBe(true);
    expect(offeredToday(undefined, THU_10CR)).toBe(true);
  });

  it('rollos solo jueves → [4]', () => {
    expect(offeredToday([4], THU_10CR)).toBe(true);
    expect(offeredToday([4], MON_10CR)).toBe(false);
  });
});
