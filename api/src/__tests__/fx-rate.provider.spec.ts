import { FxRateProvider } from '../payments/providers/fx-rate.provider';

/**
 * Cadena de tipo de cambio CRC/USD: Hacienda CR → er-api → stale → constante.
 * Regla bajo test: nunca devolver una tasa fuera de banda de cordura y nunca
 * inventar tasas para pares que no se soportan.
 */
describe('FxRateProvider — tipo de cambio real con fallback', () => {
  // Forma REAL de la API de Hacienda: venta es un objeto {fecha, valor}.
  const haciendaOk = (venta: string) => ({
    ok: true,
    status: 200,
    json: async () => ({
      dolar: { compra: { valor: '500' }, venta: { fecha: '2026-09-25', valor: venta } },
    }),
  });
  const erApiOk = (crc: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ rates: { CRC: crc } }),
  });
  const fail = (status = 500) => ({ ok: false, status, json: async () => ({}) });

  let fetchMock: jest.SpyInstance;

  const newProvider = () => {
    process.env.FX_CACHE_TTL_MS = '0';
    return new FxRateProvider();
  };

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockReset();
  });

  afterEach(() => {
    fetchMock.mockRestore();
    delete process.env.FX_CACHE_TTL_MS;
  });

  const expectHaciendaThenErApi = () => {
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('hacienda.go.cr')) return haciendaOk('512.5');
      if (u.includes('open.er-api.com')) return erApiOk('515');
      throw new Error('unexpected ' + u);
    });
  };

  it('fuente primaria Hacienda (venta) → USD_CRC y su inverso', async () => {
    expectHaciendaThenErApi();
    const fx = newProvider();
    await expect(fx.getRate('USD', 'CRC')).resolves.toBe(512.5);
    await expect(fx.getRate('CRC', 'USD')).resolves.toBeCloseTo(1 / 512.5, 12);
    // Ambas direcciones derivan del mismo valor canónico USD_CRC.
    expect(fetchMock.mock.calls.every(([u]) => String(u).includes('hacienda.go.cr'))).toBe(true);
  });

  it('Hacienda caída → er-api', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('hacienda.go.cr')) return fail(503);
      if (u.includes('open.er-api.com')) return erApiOk('515');
      throw new Error('unexpected ' + u);
    });
    const fx = newProvider();
    await expect(fx.getRate('USD', 'CRC')).resolves.toBe(515);
  });

  it('ambas fuentes caídas sin caché → constante de emergencia (460)', async () => {
    fetchMock.mockResolvedValue(fail(500));
    const fx = newProvider();
    await expect(fx.getRate('USD', 'CRC')).resolves.toBe(460);
  });

  it('respuesta corrupta (CRC 5.1) → rechazada por banda de cordura, cae a er-api', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('hacienda.go.cr')) return haciendaOk('5.1');
      if (u.includes('open.er-api.com')) return erApiOk('515');
      throw new Error('unexpected ' + u);
    });
    const fx = newProvider();
    await expect(fx.getRate('USD', 'CRC')).resolves.toBe(515);
  });

  it('ambas fuentes con tasa fuera de banda → constante (nunca tasa corrupta)', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('hacienda.go.cr')) return haciendaOk('9999');
      if (u.includes('open.er-api.com'))
        return { ok: true, status: 200, json: async () => ({ rates: { CRC: '0' } }) };
      throw new Error('unexpected ' + u);
    });
    const fx = newProvider();
    await expect(fx.getRate('USD', 'CRC')).resolves.toBe(460);
  });

  it('stale cache: fuentes caídas tras un éxito → sirve la última tasa buena', async () => {
    expectHaciendaThenErApi();
    const fx = newProvider();
    await fx.getRate('USD', 'CRC'); // éxito, cachea 512.5

    fetchMock.mockResolvedValue(fail(503));
    await expect(fx.getRate('USD', 'CRC')).resolves.toBe(512.5);
  });

  it('cache: no re-fetch dentro del TTL (con TTL por defecto)', async () => {
    expectHaciendaThenErApi();
    delete process.env.FX_CACHE_TTL_MS; // TTL por defecto 1h
    const fx = new FxRateProvider();
    await fx.getRate('USD', 'CRC');
    await fx.getRate('CRC', 'USD');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('single-flight: N llamadas concurrentes → un solo fetch por ventana', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('hacienda.go.cr')) return haciendaOk('512.5');
      throw new Error('unexpected ' + u);
    });
    const fx = newProvider();
    const results = await Promise.all(Array.from({ length: 5 }, () => fx.getRate('USD', 'CRC')));
    expect(results).toEqual([512.5, 512.5, 512.5, 512.5, 512.5]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stablecoins pegadas a USD → 1:1 sin consultar fuentes', async () => {
    const fx = newProvider();
    await expect(fx.getRate('USD', 'USDC')).resolves.toBe(1);
    await expect(fx.getRate('USDT', 'USD')).resolves.toBe(1);
    await expect(fx.getRate('USDC', 'USDT')).resolves.toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('par no soportado (EUR_CRC) → lanza error (nunca tasa inventada)', async () => {
    const fx = newProvider();
    await expect(fx.getRate('EUR', 'CRC')).rejects.toThrow('no soportado');
  });

  it('mismo par → 1', async () => {
    const fx = newProvider();
    await expect(fx.getRate('CRC', 'CRC')).resolves.toBe(1);
  });
});
