// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { describe, expect, it } from 'vitest';

import { normalizeExportRange } from './export-range';

describe('normalizeExportRange', () => {
  it('intercambia el rango invertido', () => {
    expect(normalizeExportRange('2026-11-26', '2026-11-01')).toEqual(['2026-11-01', '2026-11-26']);
  });

  it('deja el rango válido y los vacíos como están', () => {
    expect(normalizeExportRange('2026-11-01', '2026-11-26')).toEqual(['2026-11-01', '2026-11-26']);
    expect(normalizeExportRange('', '2026-11-26')).toEqual(['', '2026-11-26']);
    expect(normalizeExportRange('2026-11-01', '')).toEqual(['2026-11-01', '']);
  });
});
