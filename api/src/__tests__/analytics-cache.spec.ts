// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { TTLCache } from '../analytics/analytics-cache';

describe('TTLCache', () => {
  it('el segundo get dentro del TTL no vuelve a llamar al fetcher', async () => {
    let now = 1_000;
    const cache = new TTLCache(45_000, () => now);
    const fetcher = jest.fn().mockResolvedValue({ total: 1 });

    await expect(cache.get('k', fetcher)).resolves.toEqual({ total: 1 });
    await expect(cache.get('k', fetcher)).resolves.toEqual({ total: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('vencido el TTL vuelve a fetchear', async () => {
    let now = 1_000;
    const cache = new TTLCache(1_000, () => now);
    const fetcher = jest.fn().mockResolvedValue('v');

    await cache.get('k', fetcher);
    now += 1_001;
    await cache.get('k', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('llamados concurrentes comparten un solo fetch (singleflight)', async () => {
    const cache = new TTLCache(45_000);
    let calls = 0;
    const fetcher = jest.fn().mockImplementation(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return calls;
    });

    const [a, b, c] = await Promise.all([
      cache.get('k', fetcher),
      cache.get('k', fetcher),
      cache.get('k', fetcher),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect([a, b, c]).toEqual([1, 1, 1]);
  });

  it('el error no envenena la caché: el próximo llamado reintenta', async () => {
    const cache = new TTLCache(45_000);
    const fetcher = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');

    await expect(cache.get('k', fetcher)).rejects.toThrow('boom');
    await expect(cache.get('k', fetcher)).resolves.toBe('ok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
