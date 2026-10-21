// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const DEFAULT_POOL_LIMIT = '10';
const DEFAULT_POOL_TIMEOUT = '20';
const DEFAULT_CONNECT_TIMEOUT = '10';
const DEFAULT_STATEMENT_TIMEOUT_MS = '30000';

/**
 * DATABASE_URL + tuning del pool. Sin esto, Prisma usa sus defaults
 * (connection_limit según CPUs) y ninguna query tiene tope: un agregado
 * pesado en hora pico puede acaparar conexiones y voltear el resto.
 *
 * Precedencia: parámetro explícito en la URL > variable de entorno > default.
 * Vars: DB_POOL_LIMIT, DB_POOL_TIMEOUT, DB_CONNECT_TIMEOUT,
 * DB_STATEMENT_TIMEOUT_MS. Se documentan en api/.env.example.
 */
export function buildDatabaseUrl(raw?: string, overrides?: { connectionLimit?: string }): string {
  const base = raw ?? process.env.DATABASE_URL ?? '';
  if (!base) return base;
  const url = new URL(base);
  const params = url.searchParams;
  // Override explícito (ej. boot: migrate/sonda con pool mínimo) > URL > env > default.
  const forced = overrides?.connectionLimit;
  if (forced != null && forced !== '') {
    params.set('connection_limit', forced);
  } else if (!params.has('connection_limit')) {
    params.set('connection_limit', process.env.DB_POOL_LIMIT ?? DEFAULT_POOL_LIMIT);
  }
  if (!params.has('pool_timeout')) {
    params.set('pool_timeout', process.env.DB_POOL_TIMEOUT ?? DEFAULT_POOL_TIMEOUT);
  }
  if (!params.has('connect_timeout')) {
    params.set('connect_timeout', process.env.DB_CONNECT_TIMEOUT ?? DEFAULT_CONNECT_TIMEOUT);
  }
  const options = params.get('options') ?? '';
  if (!/statement_timeout/.test(options)) {
    const ms = process.env.DB_STATEMENT_TIMEOUT_MS ?? DEFAULT_STATEMENT_TIMEOUT_MS;
    params.set(
      'options',
      options ? `${options} -c statement_timeout=${ms}` : `-c statement_timeout=${ms}`,
    );
  }
  return url.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const slowQueryMs = Number(process.env.SLOW_QUERY_MS ?? 500);
    super({
      datasourceUrl: buildDatabaseUrl(),
      // Eventos de query solo si se mide: el listener filtra por duración.
      // Se apagan en tests para no meter ruido.
      ...(Number.isFinite(slowQueryMs) && slowQueryMs > 0 && process.env.NODE_ENV !== 'test'
        ? { log: [{ emit: 'event' as const, level: 'query' as const }] }
        : {}),
    });
    if (Number.isFinite(slowQueryMs) && slowQueryMs > 0 && process.env.NODE_ENV !== 'test') {
      (this as unknown as { $on: (ev: string, cb: (e: any) => void) => void }).$on(
        'query',
        (e: { query: string; duration: number; target?: string }) => {
          if (e.duration >= slowQueryMs) {
            // Sin params: el query puede llevar PII en los valores.
            this.logger.warn(
              `slow query ${e.duration}ms [${e.target ?? '?'}] ${(e.query ?? '').slice(0, 500)}`,
            );
          }
        },
      );
    }
  }

  async onModuleInit() {
    // El pooler (Supabase, modo sesión, 15 clientes) se llena en deploys con
    // 2 instancias vivas + migrate: en vez de morir al primer EMAXCONNSESSION,
    // se reintenta con backoff mientras se liberan las sesiones colgadas.
    const attempts = Math.max(1, Number(process.env.DB_CONNECT_ATTEMPTS ?? 6) || 6);
    const baseDelayMs = Math.max(0, Number(process.env.DB_CONNECT_DELAY_MS ?? 2000) || 2000);
    let lastError: unknown = null;
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.$connect();
        if (i > 1) this.logger.log(`DB conectada al intento ${i}/${attempts}`);
        return;
      } catch (error) {
        lastError = error;
        if (i >= attempts) break;
        this.logger.warn(
          `DB no disponible (intento ${i}/${attempts}): ${(error as any)?.message?.split('\n')[0] ?? error}. Reintentando...`,
        );
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * i));
      }
    }
    throw lastError;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
