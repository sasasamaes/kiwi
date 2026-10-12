// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { RateLimiterMiddleware } from '../security/rate-limiter.middleware';
import { HttpException } from '@nestjs/common';

/**
 * Pins the two-tier rate limiter: per-route buckets, a global per-IP ceiling,
 * and a memory-bounded store.
 */
describe('RateLimiterMiddleware', () => {
  // El middleware arranca un setInterval de cleanup que mantiene vivo el
  // event loop de Jest: cada instancia se destruye explícitamente.
  const instances: RateLimiterMiddleware[] = [];
  const makeMw = () => {
    const mw = new RateLimiterMiddleware();
    instances.push(mw);
    return mw;
  };
  afterEach(() => {
    instances.splice(0).forEach((mw) => mw.onModuleDestroy());
  });

  const makeRes = () => {
    const headers: Record<string, string> = {};
    return {
      setHeader: (k: string, v: string) => {
        headers[k] = String(v);
      },
      headers,
    } as any;
  };

  /**
   * Replica cómo Nest/Express presentan la ruta a un middleware montado:
   * baseUrl='/api/geocoding/search' + path='/' — req.path puro es solo '/',
   * y ese fue el bug latente (todas las rutas compartían bucket 'GET:/').
   */
  const makeReq = (method: string, fullPath: string, ip = '1.2.3.4') => {
    const clean = fullPath.split('?')[0];
    return {
      method,
      baseUrl: clean,
      path: '/',
      url: '/',
      ip,
      socket: { remoteAddress: ip },
    } as any;
  };

  it('allows requests under every limit and sets route headers', async () => {
    const mw = makeMw();
    const res = makeRes();
    let nexted = false;
    await mw.use(makeReq('GET', '/api/menu/merchant/abc'), res, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
    expect(res.headers['X-RateLimit-Limit']).toBe('30');
    expect(res.headers['X-RateLimit-Remaining']).toBe('29');
  });

  it('returns 429 with Retry-After when the per-route bucket is exceeded', async () => {
    const mw = makeMw();
    // geocoding/search: 20/min
    for (let i = 0; i < 20; i++) {
      await mw.use(makeReq('GET', '/api/geocoding/search?q=x'), makeRes(), () => {});
    }
    await expect(
      mw.use(makeReq('GET', '/api/geocoding/search?q=x'), makeRes(), () => {}),
    ).rejects.toThrow(HttpException);
    try {
      await mw.use(makeReq('GET', '/api/geocoding/search?q=x'), makeRes(), () => {});
      throw new Error('debió rechazar con 429');
    } catch (e: any) {
      expect(e.getStatus()).toBe(429);
      expect(e.response.message).toContain('búsquedas');
      expect(e.response.retryAfter).toBeGreaterThan(0);
    }
  });

  it('applies the default 100/min to unconfigured routes', async () => {
    const mw = makeMw();
    const res = makeRes();
    await mw.use(makeReq('GET', '/api/some/unlisted/route'), res, () => {});
    expect(res.headers['X-RateLimit-Limit']).toBe('100');
  });

  it('KYC write paths have dedicated tight buckets (not the 100/min default)', async () => {
    const mw = makeMw();
    const res = makeRes();
    await mw.use(makeReq('POST', '/api/kyc/submit'), res, () => {});
    expect(res.headers['X-RateLimit-Limit']).toBe('10');
    const res2 = makeRes();
    await mw.use(makeReq('POST', '/api/kyc/didit/start'), res2, () => {});
    expect(res2.headers['X-RateLimit-Limit']).toBe('5');
    const res3 = makeRes();
    await mw.use(makeReq('POST', '/api/kyc/webhook/didit'), res3, () => {});
    expect(res3.headers['X-RateLimit-Limit']).toBe('10');
  });

  it('keeps separate buckets per route and per IP', async () => {
    const mw = makeMw();
    // Saturar geocoding para la IP A no afecta a la IP B ni a otra ruta de A.
    for (let i = 0; i < 20; i++) {
      await mw.use(makeReq('GET', '/api/geocoding/search?q=x', '9.9.9.9'), makeRes(), () => {});
    }
    const resB = makeRes();
    await mw.use(makeReq('GET', '/api/geocoding/search?q=x', '8.8.8.8'), resB, () => {});
    const resOtherRoute = makeRes();
    await mw.use(makeReq('GET', '/api/geocoding/reverse?x=1', '9.9.9.9'), resOtherRoute, () => {});
  });

  it('the per-IP ceiling triggers across DIFFERENT routes (240/min)', async () => {
    const mw = makeMw();
    const ip = '7.7.7.7';
    // 100 requests a 3 rutas distintas sin límite propio = 300 > 240.
    let rejected = 0;
    for (let i = 0; i < 300; i++) {
      const path = `/api/no-limit-${i % 3}`;
      try {
        await mw.use(makeReq('GET', path, ip), makeRes(), () => {});
      } catch {
        rejected++;
      }
    }
    expect(rejected).toBe(300 - 240);
  });

  it('does not count rejected requests against other IPs', async () => {
    const mw = makeMw();
    for (let i = 0; i < 250; i++) {
      try {
        await mw.use(makeReq('GET', `/api/x${i % 5}`, '6.6.6.6'), makeRes(), () => {});
      } catch {
        /* saturado a propósito */
      }
    }
    // La IP vecina sigue navegando con su propio techo intacto.
    const res = makeRes();
    await expect(
      mw.use(makeReq('GET', '/api/x0', '5.5.5.5'), res, () => {}),
    ).resolves.toBeUndefined();
    expect(res.headers['X-RateLimit-Remaining']).toBe('99');
  });
  it('store is memory-bounded (no unbounded growth from IP rotation)', async () => {
    const mw = makeMw();
    for (let i = 0; i < 25_000; i++) {
      try {
        await mw.use(
          makeReq('GET', `/api/route-${i % 50}`, `10.0.${Math.floor(i / 255) % 255}.${i % 255}`),
          makeRes(),
          () => {},
        );
      } catch {
        /* el techo por IP puede rechazar — irrelevante aquí */
      }
    }
    expect((mw as any).store.size).toBeLessThanOrEqual(20_000);
  });

  it('REGRESIÓN: rutas distintas NO comparten bucket (req.path montado)', async () => {
    const mw = makeMw();
    // Con el bug, ambas caían en el bucket 'GET:/' y compartían contador.
    // Ahora cada ruta tiene su propio bucket y su propio límite.
    const res1 = makeRes();
    const res2 = makeRes();
    await mw.use(makeReq('GET', '/api/geocoding/search'), res1, () => {});
    await mw.use(makeReq('GET', '/api/users/me'), res2, () => {});
    expect(res1.headers['X-RateLimit-Limit']).toBe('20');
    expect(res2.headers['X-RateLimit-Limit']).toBe('100');
    expect(res1.headers['X-RateLimit-Remaining']).toBe('19');
    expect(res2.headers['X-RateLimit-Remaining']).toBe('99');
  });
});
