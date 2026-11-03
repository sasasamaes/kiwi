// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { describe, expect, it } from 'vitest';

import { zoneAutofillPrice } from './manual-order';

describe('zoneAutofillPrice', () => {
  it('devuelve el precio redondeado de la zona', () => {
    expect(zoneAutofillPrice({ price: 1500 })).toBe('1500');
    expect(zoneAutofillPrice({ price: '2275.4' })).toBe('2275');
  });

  it('null sin zona o sin precio válido', () => {
    expect(zoneAutofillPrice(null)).toBeNull();
    expect(zoneAutofillPrice(undefined)).toBeNull();
    expect(zoneAutofillPrice({})).toBeNull();
    expect(zoneAutofillPrice({ price: 0 })).toBeNull();
    expect(zoneAutofillPrice({ price: 'abc' })).toBeNull();
  });
});
