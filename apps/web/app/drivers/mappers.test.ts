import { describe, expect, it } from 'vitest';

import { toDriverList } from './mappers';

describe('toDriverList photoUrl passthrough', () => {
  it('keeps the https photoUrl of a direct profile', () => {
    const out = toDriverList([
      { id: 'd1', fullName: 'Juan', photoUrl: 'https://cdn.example/foto.jpg', status: 'available' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].photoUrl).toBe('https://cdn.example/foto.jpg');
  });

  it('keeps an emoji avatar', () => {
    const out = toDriverList([{ id: 'd2', fullName: 'Ana', photoUrl: '🛵' }]);
    expect(out[0].photoUrl).toBe('🛵');
  });

  it('unwraps {favorites: [{driver}]} keeping photoUrl', () => {
    const out = toDriverList({
      favorites: [
        { id: 'f1', driver: { id: 'd3', fullName: 'Luis', photoUrl: 'https://x/y.png' } },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('d3');
    expect(out[0].photoUrl).toBe('https://x/y.png');
  });

  it('leaves photoUrl undefined when the backend sends none', () => {
    const out = toDriverList([{ id: 'd4', fullName: 'Sin foto' }]);
    expect(out[0].photoUrl).toBeUndefined();
  });

  it('filters out entries without id', () => {
    const out = toDriverList([{ fullName: 'Fantasma', photoUrl: 'https://x/z.png' } as any]);
    expect(out).toHaveLength(0);
  });
});
