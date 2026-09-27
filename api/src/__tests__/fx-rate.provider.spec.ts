// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
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

  describe('healthCheck (admin)', () => {
    const bothSourcesUp = () => {
      fetchMock.mockImplementation(async (url: any) => {
        const u = String(url);
        if (u.includes('hacienda.go.cr')) return haciendaOk('512.5');
        if (u.includes('open.er-api.com')) return erApiOk('515');
        throw new Error('unexpected ' + u);
      });
    };

    it('ambas fuentes vivas → ok:true con tasa y latencia por fuente', async () => {
      bothSourcesUp();
      const fx = newProvider();
      const health = await fx.healthCheck();

      expect(health.sources).toHaveLength(2);
      const [hacienda, erApi] = health.sources;
      expect(hacienda).toMatchObject({ name: 'hacienda', ok: true, rate: 512.5 });
      expect(erApi).toMatchObject({ name: 'er-api', ok: true, rate: 515 });
      expect(hacienda.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.cache).toBeNull(); // instancia fresca, nadie pidió tasa aún
      expect(health.sanityBand).toMatchObject({ min: 400, max: 700 });
    });

    it('Hacienda caída y er-api viva → estados independientes con error textual', async () => {
      fetchMock.mockImplementation(async (url: any) => {
        const u = String(url);
        if (u.includes('hacienda.go.cr')) return fail(503);
        if (u.includes('open.er-api.com')) return erApiOk('515');
        throw new Error('unexpected ' + u);
      });
      const fx = newProvider();
      const health = await fx.healthCheck();

      const [hacienda, erApi] = health.sources;
      expect(hacienda.ok).toBe(false);
      expect(hacienda.error).toContain('503');
      expect(hacienda.rate).toBeNull();
      expect(erApi.ok).toBe(true);
      expect(erApi.rate).toBe(515);
    });

    it('los probes NO mutan estado: caché, fuente servida y contadores intactos', async () => {
      bothSourcesUp();
      delete process.env.FX_CACHE_TTL_MS;
      process.env.FX_CACHE_TTL_MS = '3600000';
      const fx = new FxRateProvider();

      await fx.healthCheck(); // probe inicial
      const healthBefore = await fx.healthCheck();
      expect(healthBefore.lastSourceServed).toBeNull();
      expect(healthBefore.cache).toBeNull();

      await fx.getRate('USD', 'CRC'); // esto SÍ escribe caché y contadores

      const healthAfter = await fx.healthCheck();
      expect(healthAfter.cache).toMatchObject({ usdCrc: 512.5, source: 'hacienda' });
      expect(healthAfter.cache.isStale).toBe(false);
      expect(healthAfter.lastSourceServed).toBe('hacienda');
      expect(healthAfter.sources[0].stats).toMatchObject({ ok: 1, fail: 0 });
      // fetches: 2 probes + 2 probes + 1 getRate + 2 probes del health final = 7
      expect(fetchMock).toHaveBeenCalledTimes(7);
    });

    it('cache stale reportado como stale con edad en minutos', async () => {
      bothSourcesUp();
      delete process.env.FX_CACHE_TTL_MS;
      process.env.FX_CACHE_TTL_MS = '1'; // TTL casi cero → stale inmediato
      const fx = new FxRateProvider();
      await fx.getRate('USD', 'CRC');
      await new Promise((r) => setTimeout(r, 5)); // envejece la entrada

      const health = await fx.healthCheck();
      expect(health.cache.isStale).toBe(true);
      expect(health.cache.ageMinutes).toBeGreaterThanOrEqual(0);
    });
  });

  it('getRateInfo expone tasa, fuente y momento (transparencia checkout)', async () => {
    expectHaciendaThenErApi();
    // Instancia con caché real (TTL 1h fijado ANTES de construir: el TTL se lee
    // en el constructor a propósito).
    delete process.env.FX_CACHE_TTL_MS;
    process.env.FX_CACHE_TTL_MS = '3600000';
    const fx = new FxRateProvider();
    const info = await fx.getRateInfo();
    expect(info.usdCrc).toBe(512.5);
    expect(info.source).toBe('hacienda');
    expect(new Date(info.fetchedAt).getTime()).toBeGreaterThan(0);

    // Con fuentes caídas y caché vivo, la tasa servida conserva su fuente original.
    fetchMock.mockResolvedValue(fail(503));
    const info2 = await fx.getRateInfo();
    expect(info2.usdCrc).toBe(512.5);
    expect(info2.source).toBe('hacienda');
    expect(fetchMock).toHaveBeenCalledTimes(1); // sirvió del caché, sin re-fetch
  });
});
