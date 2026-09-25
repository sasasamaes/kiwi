import { Injectable, Logger } from '@nestjs/common';

/**
 * Tipo de cambio CRC/USD con fuentes reales, caché y fallback.
 *
 * Cadena (para USD_CRC):
 *   1. Hacienda Costa Rica (indicador oficial de venta)
 *   2. open.er-api.com (tipo de cambio de mercado, sin API key)
 *   3. Última tasa buena en caché (aunque esté vieja)
 *   4. Constante de emergencia (510)
 *
 * Reglas de dinero:
 *   - Toda tasa pasa por una banda de cordura antes de usarse o cachearse:
 *     una respuesta corrupta (p. ej. CRC: 5.1) no entra al sistema.
 *   - Un par desconocido LANZA error (antes se devolvía 1 silenciosamente,
 *     lo que convertía montos sin convertir).
 *   - Las stablecoins se tratan 1:1 con USD (peg de diseño); la deriva del
 *     peg es menor que el error de tipo de cambio que este provider corrige.
 */
@Injectable()
export class FxRateProvider {
  private readonly logger = new Logger(FxRateProvider.name);

  /** Última tasa buena por par, para servir stale si todas las fuentes fallan. */
  private readonly cache = new Map<string, { rate: number; fetchedAt: number }>();

  /** Single-flight: una sola petición por par aunque N pedidos concurran. */
  private readonly inflight = new Map<string, Promise<number>>();

  private readonly ttlMs: number;
  private static readonly USD_CRC_MIN = 400;
  private static readonly USD_CRC_MAX = 700;
  // Válvula de emergencia (ambas fuentes caídas y sin caché). Verificada
  // contra el indicador real de Hacienda (~454 en sep-2026): el hardcode
  // anterior (510) estaba ~12% desactualizado y sobre-cobraba. Revisar anual.
  private static readonly EMERGENCY_USD_CRC = 460;
  private static readonly PEGGED = new Set(['USD', 'USDC', 'USDT']);

  constructor() {
    // TTL configurable (tests usan 0 para forzar refetch). Refresco horario por defecto.
    const v = Number(process.env.FX_CACHE_TTL_MS);
    this.ttlMs = Number.isFinite(v) && v >= 0 ? v : 60 * 60 * 1000;
  }

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    // Las stablecoins se tratan como USD (peg de diseño): la deriva del peg
    // es menor que el error de tipo de cambio que este provider corrige.
    const F = FxRateProvider.PEGGED.has(from) ? 'USD' : from;
    const T = FxRateProvider.PEGGED.has(to) ? 'USD' : to;

    if (F === T) return 1; // USD ↔ USDC/USDT

    // Solo soportamos CRC↔USD (y equivalentes pegged). Cualquier otro par
    // lanza error: inventar una tasa silenciosa convertiría montos mal
    // (la versión anterior devolvía 1 — contrato peligroso para dinero).
    if (!((F === 'CRC' && T === 'USD') || (F === 'USD' && T === 'CRC'))) {
      throw new Error(`Par de divisas no soportado: ${from}_${to}`);
    }

    const usdCrc = await this.getUsdCrc();
    return F === 'CRC' ? 1 / usdCrc : usdCrc;
  }

  /**
   * USD_CRC canónico: un único valor del que se deriva el inverso. Cache +
   * single-flight: N pedidos concurrentes comparten una sola cadena de fuentes.
   */
  private getUsdCrc(): Promise<number> {
    const cached = this.cache.get('USD_CRC');
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) {
      return Promise.resolve(cached.rate);
    }

    const existing = this.inflight.get('USD_CRC');
    if (existing) return existing;

    const promise = this.fetchUsdCrc()
      .then((rate) => {
        this.cache.set('USD_CRC', { rate, fetchedAt: Date.now() });
        return rate;
      })
      .finally(() => this.inflight.delete('USD_CRC'));
    this.inflight.set('USD_CRC', promise);
    return promise;
  }

  /**
   * Obtiene USD_CRC con la cadena de fallback. Si Hacienda y er-api fallan,
   * sirve la última tasa buena (stale) y, en último caso, la constante.
   */
  private async fetchUsdCrc(): Promise<number> {
    try {
      const rate = await this.fromHacienda();
      this.logger.log(`FX USD_CRC (Hacienda CR): ${rate}`);
      return rate;
    } catch (e: any) {
      this.logger.warn(`Hacienda CR falló (${e?.message ?? e}) — probando er-api`);
    }

    try {
      const rate = await this.fromErApi();
      this.logger.log(`FX USD_CRC (er-api): ${rate}`);
      return rate;
    } catch (e: any) {
      this.logger.warn(`er-api falló (${e?.message ?? e}) — usando respaldo`);
    }

    const cached = this.cache.get('USD_CRC');
    if (cached) {
      const ageH = Math.round((Date.now() - cached.fetchedAt) / 3600000);
      this.logger.warn(`FX stale: usando caché de hace ~${ageH}h para USD_CRC (${cached.rate})`);
      return cached.rate;
    }

    this.logger.error(
      `FX sin fuentes vivas ni caché — usando constante de emergencia (${FxRateProvider.EMERGENCY_USD_CRC})`,
    );
    return FxRateProvider.EMERGENCY_USD_CRC;
  }

  /** Indicador oficial. Se usa VENTA: es lo que un banco cobraría al comprador en USD. */
  private async fromHacienda(): Promise<number> {
    const json = await this.getJson('https://api.hacienda.go.cr/indicadores/tc');
    // La API real devuelve { dolar: { venta: { fecha, valor } } } — y de
    // respaldo acepta número plano por si Hacienda simplifica el formato.
    const raw = json?.dolar?.venta;
    const venta = Number(typeof raw === 'object' && raw !== null ? raw.valor : raw);
    return this.sanity(venta, 'Hacienda');
  }

  /** Tipo de cambio de mercado (mid). Sin API key y límites amplios. */
  private async fromErApi(): Promise<number> {
    const json = await this.getJson('https://open.er-api.com/v6/latest/USD');
    const crc = Number(json?.rates?.CRC);
    return this.sanity(crc, 'er-api');
  }

  /** Banda de cordura: una tasa fuera de rango no se usa ni se cachea. */
  private sanity(rate: number, source: string): number {
    if (!Number.isFinite(rate)) {
      throw new Error(`${source}: tasa no numérica`);
    }
    if (rate < FxRateProvider.USD_CRC_MIN || rate > FxRateProvider.USD_CRC_MAX) {
      throw new Error(`${source}: tasa fuera de banda de cordura (${rate})`);
    }
    return rate;
  }

  private async getJson(url: string): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} de ${url}`);
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}
