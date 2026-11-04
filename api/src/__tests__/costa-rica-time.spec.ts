// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  CR_OFFSET_MS,
  crHour,
  crDayStartISO,
  crDayEndExclusiveISO,
  startOfTodayCR,
  toCRDateKey,
} from '../common/costa-rica-time';

// Todo en UTC absoluto: este spec pasa en cualquier TZ del runner.
describe('costa-rica-time (UTC-6 fijo)', () => {
  it('rango de día: 00:00 CR = 06:00 UTC', () => {
    expect(crDayStartISO('2026-11-02')).toEqual(new Date(Date.UTC(2026, 10, 2, 6)));
    expect(crDayEndExclusiveISO('2026-11-02')).toEqual(new Date(Date.UTC(2026, 10, 3, 6)));
  });

  it('rechaza fechas inválidas sin rollover silencioso', () => {
    for (const bad of ['hola', '', '2026-13-01', '2026-02-30', '2026-11-2', null, undefined]) {
      expect(crDayStartISO(bad)).toBeNull();
      expect(crDayEndExclusiveISO(bad)).toBeNull();
    }
  });

  it('crHour en muro CR (borde 18:00–24:00)', () => {
    // 2 nov 06:59 p. m. CR = 3 nov 00:59 UTC → hora 18, no 0 del día siguiente.
    expect(crHour(new Date(Date.UTC(2026, 10, 3, 0, 59)))).toBe(18);
    expect(crHour(new Date(Date.UTC(2026, 10, 3, 6, 0)))).toBe(0);
    expect(crHour(new Date(Date.UTC(2026, 10, 3, 5, 59)))).toBe(23);
  });

  it('caso real del corte: pedido 18:59 CR entra en Hasta=02/11', () => {
    const created = new Date(Date.UTC(2026, 10, 3, 0, 59)); // 2 nov 18:59 CR
    const cutoff = crDayEndExclusiveISO('2026-11-02')!;
    expect(created.getTime()).toBeLessThan(cutoff.getTime());
  });

  it('startOfTodayCR y toCRDateKey en muro CR', () => {
    // 2 nov 20:00 CR = 3 nov 02:00 UTC → el "hoy" tico sigue siendo el 2.
    const now = new Date(Date.UTC(2026, 10, 3, 2, 0));
    expect(startOfTodayCR(now)).toEqual(new Date(Date.UTC(2026, 10, 2, 6)));
    expect(toCRDateKey(now)).toBe('2026-11-02');
  });

  it('offset constante documentado', () => {
    expect(CR_OFFSET_MS).toBe(-6 * 3600 * 1000);
  });
});
