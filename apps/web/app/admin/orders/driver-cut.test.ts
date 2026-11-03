// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { describe, expect, it } from 'vitest';

import { buildDriverCutReport, payableOf } from './driver-cut';

const base = {
  driverName: 'Luis Espinoza',
  merchantName: 'Soda La Esquina',
  createdAt: '2026-11-02T20:00:00.000Z',
  basePrice: 2000,
  driverPayout: 1500,
  isTest: false,
};

const row = (over: any = {}) => ({ id: `o-${Math.random()}`, ...base, ...over });

describe('payableOf', () => {
  it('paga el payout tal cual, sin rebajar IVA ni nada', () => {
    expect(payableOf(1500)).toBe(1500);
    expect(payableOf('1500.6')).toBe(1501);
    expect(payableOf(null)).toBe(0);
    expect(payableOf(undefined)).toBe(0);
    expect(payableOf('abc')).toBe(0);
  });
});

describe('buildDriverCutReport', () => {
  it('agrupa por repartidor y no rebaja IVA', () => {
    const r = buildDriverCutReport([
      row({ id: 'o-1' }),
      row({ id: 'o-2', driverName: 'Ana', driverPayout: 850, basePrice: 1000 }),
    ]);
    expect(r.sections).toHaveLength(2);
    expect(r.sections[0].driver).toBe('Luis Espinoza');
    expect(r.sections[0].payableTotal).toBe(1500);
    expect(r.sections[0].tripTotal).toBe(2000);
    expect(r.grandPayable).toBe(2350);
    expect(r.grandCount).toBe(2);
  });

  it('separa los TEST del total pagable', () => {
    const r = buildDriverCutReport([
      row({ id: 'o-1' }),
      row({ id: 'o-t', isTest: true, driverPayout: 1275, basePrice: 1500 }),
    ]);
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].realCount).toBe(1);
    expect(r.sections[0].testCount).toBe(1);
    expect(r.sections[0].payableTotal).toBe(1500);
    expect(r.sections[0].testTotal).toBe(1275);
    expect(r.grandPayable).toBe(1500);
    expect(r.grandTest).toBe(1275);
    expect(r.grandCount).toBe(1);
  });

  it('vacío da ceros sin reventar', () => {
    const r = buildDriverCutReport([]);
    expect(r).toEqual({ sections: [], grandPayable: 0, grandTest: 0, grandCount: 0 });
  });
});
