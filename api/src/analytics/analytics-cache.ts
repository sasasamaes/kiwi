// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.

/**
 * Caché en memoria con TTL + singleflight para agregados caros
 * (analytics del dashboard). Los dashboards re-piden los mismos números
 * en cada foco/recarga; sin esto cada visita corre N agregados sobre orders.
 *
 * Staleness acotada por TTL (default 45s): aceptable para tableros, NUNCA
 * para datos vivos (el pulso /live no usa esto). Por instancia: con 2+
 * instancias cada una cachea lo suyo — correcto igual, solo menos hits.
 */
export class TTLCache {
  private readonly store = new Map<string, { exp: number; value: unknown }>();
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(
    private readonly ttlMs: number = Number(process.env.ANALYTICS_CACHE_TTL_MS ?? 45_000),
    private readonly clock: () => number = Date.now,
  ) {}

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.exp > this.clock()) return hit.value as T;
    const ongoing = this.pending.get(key);
    if (ongoing) return ongoing as Promise<T>;
    const run = fetcher().then(
      (value) => {
        this.store.set(key, { exp: this.clock() + this.ttlMs, value });
        this.pending.delete(key);
        return value;
      },
      (err) => {
        // El error no se cachea: el próximo llamado reintenta.
        this.pending.delete(key);
        throw err;
      },
    );
    this.pending.set(key, run);
    return run;
  }

  invalidate(key?: string): void {
    if (key) {
      this.store.delete(key);
      this.pending.delete(key);
      return;
    }
    this.store.clear();
    this.pending.clear();
  }
}
