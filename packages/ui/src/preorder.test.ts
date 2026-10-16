// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { describe, it, expect } from 'vitest';
import { isPreorderItem, nextDateKeyCR, preorderDeliveryLabel } from './preorder';

const wd = (key: string) =>
  new Date(`${key}T12:00:00-06:00`).toLocaleDateString('es-CR', {
    weekday: 'long',
    timeZone: 'America/Costa_Rica',
  });

describe('isPreorderItem', () => {
  it('marca preventa: solo-mañana, nota de entrega o días restringidos con stock', () => {
    expect(isPreorderItem({ offeredTomorrow: true })).toBe(true);
    expect(isPreorderItem({ fulfillNote: 'Se entrega el jueves' })).toBe(true);
    expect(isPreorderItem({ availableDays: [4] })).toBe(true);
    expect(isPreorderItem({ availableDays: [4], stockQty: 5 })).toBe(true);
  });

  it('marca preventa si controla stock del día aunque sea todos los días', () => {
    expect(isPreorderItem({ availableDays: [], stockQty: 20, dailyQty: 50 })).toBe(true);
    expect(isPreorderItem({ stockQty: 3 })).toBe(true);
  });

  it('no marca: menú de todos los días ni items agotados', () => {
    expect(isPreorderItem({ availableDays: [] })).toBe(false);
    expect(isPreorderItem({})).toBe(false);
    expect(isPreorderItem({ offeredTomorrow: true, stockQty: 0 })).toBe(false);
    expect(isPreorderItem({ availableDays: [4], stockQty: 0 })).toBe(false);
    expect(isPreorderItem({ availableDays: [], stockQty: 0, dailyQty: 50 })).toBe(false);
  });
});

describe('preorderDeliveryLabel', () => {
  it('prioriza mañana, después la nota, después el próximo día', () => {
    expect(
      preorderDeliveryLabel([{ offeredTomorrow: true }, { availableDays: [4] }], '2026-10-17', wd),
    ).toContain('mañana');
    expect(preorderDeliveryLabel([{ fulfillNote: 'Se entrega el jueves' }], '2026-10-17', wd)).toBe(
      'Se entrega el jueves',
    );
    expect(preorderDeliveryLabel([{ availableDays: [4] }], '2026-10-17', wd)).toContain('Entrega');
  });

  it('null sin preventa; si es por stock de todos los días, propone mañana', () => {
    expect(preorderDeliveryLabel([{ availableDays: [] }], '2026-10-17', wd)).toBeNull();
    expect(preorderDeliveryLabel([], '2026-10-17', wd)).toBeNull();
    expect(
      preorderDeliveryLabel([{ availableDays: [], stockQty: 20 }], '2026-10-17', wd),
    ).toContain('mañana');
  });
});

describe('nextDateKeyCR', () => {
  it('encuentra el próximo día de la lista (hora CR fija)', () => {
    // Miércoles 2026-10-14 18:00 UTC = 12:00 CR.
    const wed = new Date('2026-10-14T18:00:00Z').getTime();
    // Solo jueves [4] → 2026-10-15.
    expect(nextDateKeyCR([4], wed)).toBe('2026-10-15');
    // Hoy incluido → hoy mismo.
    expect(nextDateKeyCR([3, 4], wed)).toBe('2026-10-14');
  });
});
