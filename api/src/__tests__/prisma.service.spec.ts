// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { PrismaService, buildDatabaseUrl } from '../prisma/prisma.service';

const BASE = 'postgresql://user:pass@localhost:5432/kiwi';

describe('buildDatabaseUrl', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.DB_POOL_LIMIT;
    delete process.env.DB_POOL_TIMEOUT;
    delete process.env.DB_CONNECT_TIMEOUT;
    delete process.env.DB_STATEMENT_TIMEOUT_MS;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('cadena vacía pasa tal cual; sin argumento usa DATABASE_URL del env', () => {
    expect(buildDatabaseUrl('')).toBe('');
    // Hermético: no depende del .env local (que Prisma carga al importar)
    // ni del runner de CI (sin DATABASE_URL).
    process.env.DATABASE_URL = BASE;
    const fromEnv = new URL(buildDatabaseUrl(undefined));
    expect(fromEnv.searchParams.get('connection_limit')).toBe('10');
  });

  it('aplica defaults de pool y statement_timeout', () => {
    const out = new URL(buildDatabaseUrl(BASE));
    expect(out.searchParams.get('connection_limit')).toBe('10');
    expect(out.searchParams.get('pool_timeout')).toBe('20');
    expect(out.searchParams.get('connect_timeout')).toBe('10');
    expect(out.searchParams.get('options')).toContain('statement_timeout=30000');
  });

  it('lo explícito en la URL manda; el env solo rellena lo ausente', () => {
    process.env.DB_POOL_LIMIT = '5';
    const explicit = new URL(buildDatabaseUrl(`${BASE}?connection_limit=3`));
    expect(explicit.searchParams.get('connection_limit')).toBe('3');
    const fromEnv = new URL(buildDatabaseUrl(BASE));
    expect(fromEnv.searchParams.get('connection_limit')).toBe('5');
  });

  it('conserva options existentes y les suma el statement_timeout', () => {
    const out = new URL(buildDatabaseUrl(`${BASE}?options=-c%20search_path%3Dpublic`));
    expect(out.searchParams.get('options')).toContain('search_path=public');
    expect(out.searchParams.get('options')).toContain('statement_timeout=30000');
  });

  it('no duplica statement_timeout si ya viene en options', () => {
    const out = new URL(buildDatabaseUrl(`${BASE}?options=-c%20statement_timeout%3D5000`));
    const matches = (out.searchParams.get('options') ?? '').match(/statement_timeout/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('override de connectionLimit manda sobre URL y env (boot mínimo)', () => {
    const out = new URL(buildDatabaseUrl(`${BASE}?connection_limit=9`, { connectionLimit: '2' }));
    expect(out.searchParams.get('connection_limit')).toBe('2');
  });

  it('onModuleInit reintenta el $connect y conecta cuando se libera el pool', async () => {
    const svc = new PrismaService();
    const err = new Error('FATAL: max clients reached');
    const spy = jest
      .spyOn(svc as any, '$connect')
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(undefined);
    process.env.DB_CONNECT_DELAY_MS = '1';
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(3);
    delete process.env.DB_CONNECT_DELAY_MS;
    spy.mockRestore();
  });

  it('onModuleInit lanza si el pool no se libera tras los intentos', async () => {
    const svc = new PrismaService();
    const spy = jest
      .spyOn(svc as any, '$connect')
      .mockRejectedValue(new Error('FATAL: max clients'));
    process.env.DB_CONNECT_ATTEMPTS = '2';
    process.env.DB_CONNECT_DELAY_MS = '1';
    await expect(svc.onModuleInit()).rejects.toThrow('FATAL');
    expect(spy).toHaveBeenCalledTimes(2);
    delete process.env.DB_CONNECT_ATTEMPTS;
    delete process.env.DB_CONNECT_DELAY_MS;
    spy.mockRestore();
  });
});
