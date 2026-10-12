// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { HttpsEnforcerMiddleware } from '../security/https-enforcer.middleware';

describe('HttpsEnforcerMiddleware', () => {
  const makeReq = (proto?: string) =>
    ({
      headers: proto
        ? { 'x-forwarded-proto': proto, host: 'kiwi-api.onrender.com' }
        : { host: 'kiwi-api.onrender.com' },
      originalUrl: '/api/orders/my',
      url: '/api/orders/my',
    }) as any;

  const makeRes = () => {
    const r: any = { statusCode: null, location: null };
    r.redirect = (code: number, url: string) => {
      r.statusCode = code;
      r.location = url;
    };
    return r;
  };

  const ORIGINAL_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
  });

  it('in production: x-forwarded-proto http → 308 redirect to https', () => {
    process.env.NODE_ENV = 'production';
    const mw = new HttpsEnforcerMiddleware();
    const res = makeRes();
    let nexted = false;
    mw.use(makeReq('http'), res, () => {
      nexted = true;
    });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(308);
    expect(res.location).toBe('https://kiwi-api.onrender.com/api/orders/my');
  });

  it('in production: x-forwarded-proto https passes through', () => {
    process.env.NODE_ENV = 'production';
    const mw = new HttpsEnforcerMiddleware();
    const res = makeRes();
    let nexted = false;
    mw.use(makeReq('https'), res, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('in production: absent header (proxy-internal traffic) passes through', () => {
    process.env.NODE_ENV = 'production';
    const mw = new HttpsEnforcerMiddleware();
    const res = makeRes();
    let nexted = false;
    mw.use(makeReq(undefined), res, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
  });

  it('comma-list proto picks the first hop (http,https → redirect)', () => {
    process.env.NODE_ENV = 'production';
    const mw = new HttpsEnforcerMiddleware();
    const req = makeReq('http,https');
    const res = makeRes();
    mw.use(req, res, () => {});
    expect(res.statusCode).toBe(308);
  });

  it('outside production: never redirects (dev/local + health probes)', () => {
    process.env.NODE_ENV = 'development';
    const mw = new HttpsEnforcerMiddleware();
    const res = makeRes();
    let nexted = false;
    mw.use(makeReq('http'), res, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
  });

  it('308 preserves method semantics (no 301/302 GET-degradation risk)', () => {
    process.env.NODE_ENV = 'production';
    const mw = new HttpsEnforcerMiddleware();
    const res = makeRes();
    mw.use(makeReq('http'), res, () => {});
    // 308 = Permanent + method/body preserved (RFC 9110 §15.4.9)
    expect(res.statusCode).not.toBe(301);
    expect(res.statusCode).not.toBe(302);
    expect(res.statusCode).toBe(308);
  });

  it('ignores spoofed x-forwarded-host (uses the routed Host)', () => {
    process.env.NODE_ENV = 'production';
    const mw = new HttpsEnforcerMiddleware();
    const req: any = {
      headers: {
        'x-forwarded-proto': 'http',
        'x-forwarded-host': 'evil.example',
        host: 'kiwi-api.onrender.com',
      },
      originalUrl: '/api/orders/my',
      url: '/api/orders/my',
    };
    const res = makeRes();
    mw.use(req, res, () => {});
    expect(res.location).toBe('https://kiwi-api.onrender.com/api/orders/my');
  });

  it('invalid host or URL falls back to a safe relative target', () => {
    process.env.NODE_ENV = 'production';
    const mw = new HttpsEnforcerMiddleware();
    const badHost: any = {
      headers: { 'x-forwarded-proto': 'http', host: 'evil.example/x' },
      originalUrl: '/api/orders/my',
      url: '/api/orders/my',
    };
    const res1 = makeRes();
    mw.use(badHost, res1, () => {});
    expect(res1.location).toBe('/api/orders/my');
    const badUrl: any = {
      headers: { 'x-forwarded-proto': 'http', host: 'kiwi-api.onrender.com' },
      originalUrl: '/api/x\r\nSet-Cookie: a=b',
      url: '/api/x',
    };
    const res2 = makeRes();
    mw.use(badUrl, res2, () => {});
    expect(res2.location).toBe('/');
  });
});
