import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// safeNavigateToUrl usa window.location.href — mockeamos el setter de href
// y window.location.origin para correr sin navegador real.
describe('safeNavigateToUrl', () => {
  const originalWindow = globalThis.window;
  const originalLocation = globalThis.location;

  const hrefSetter = vi.fn();

  beforeAll(() => {
    (globalThis as any).window = {
      location: {
        origin: 'https://kiwi-client.vercel.app',
        set href(v: string) {
          hrefSetter(v);
        },
        get href() {
          return 'https://kiwi-client.vercel.app/order/1';
        },
      },
    };
    // jsdom-like global location (algunos bundlers lo leen de ahí)
    (globalThis as any).location = (globalThis as any).window.location;
  });

  afterAll(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).location = originalLocation;
  });

  it('navega a rutas internas que empiezan con /', async () => {
    const { safeNavigateToUrl } = await import('./utils');

    hrefSetter.mockClear();
    const res = safeNavigateToUrl('/menu/abc');

    expect(res).toBe(true);
    expect(hrefSetter).toHaveBeenCalledWith('/menu/abc');
  });

  it('rechaza protocol-relative // y otros esquemas raros', async () => {
    const { safeNavigateToUrl } = await import('./utils');

    hrefSetter.mockClear();
    expect(safeNavigateToUrl('//evil.com')).toBe(false);
    expect(safeNavigateToUrl('javascript:alert(1)')).toBe(false);
    expect(hrefSetter).not.toHaveBeenCalled();
  });

  it('navega a hosts de la allow-list de checkout (https)', async () => {
    const { safeNavigateToUrl } = await import('./utils');

    hrefSetter.mockClear();
    const res = safeNavigateToUrl('https://pay.onvopay.com/checkout/123');

    expect(res).toBe(true);
    expect(hrefSetter).toHaveBeenCalledTimes(1);
  });

  it('rechaza hosts desconocidos aunque sean https', async () => {
    const { safeNavigateToUrl } = await import('./utils');

    hrefSetter.mockClear();
    expect(safeNavigateToUrl('https://evil.com/checkout')).toBe(false);
    expect(hrefSetter).not.toHaveBeenCalled();
  });

  it('rechaza http plano: externo Y downgrade same-host (el origin incluye protocolo)', async () => {
    const { safeNavigateToUrl } = await import('./utils');

    hrefSetter.mockClear();
    expect(safeNavigateToUrl('http://onvopay.com/x')).toBe(false);
    expect(safeNavigateToUrl('http://kiwi-client.vercel.app/menu/1')).toBe(false);
  });

  it('acepta URLs https same-origin', async () => {
    const { safeNavigateToUrl } = await import('./utils');

    hrefSetter.mockClear();
    const res = safeNavigateToUrl('https://kiwi-client.vercel.app/menu/1');

    expect(res).toBe(true);
    expect(hrefSetter).toHaveBeenCalledTimes(1);
  });

  it('rechaza entradas vacías, no-string y sobre-largas', async () => {
    const { safeNavigateToUrl } = await import('./utils');

    hrefSetter.mockClear();
    expect(safeNavigateToUrl('')).toBe(false);
    expect(safeNavigateToUrl(null)).toBe(false);
    expect(safeNavigateToUrl(undefined)).toBe(false);
    expect(safeNavigateToUrl('a'.repeat(3000))).toBe(false);
    expect(hrefSetter).not.toHaveBeenCalled();
  });
});
