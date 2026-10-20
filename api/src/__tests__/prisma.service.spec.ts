// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { buildDatabaseUrl } from '../prisma/prisma.service';

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
    // El setup de jest define DATABASE_URL local: cae al env y lo tunea.
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
});
