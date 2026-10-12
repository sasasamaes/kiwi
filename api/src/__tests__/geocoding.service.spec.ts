// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { GeocodingService } from '../geocoding/geocoding.service';

describe('GeocodingService respeto a Nominatim (1 req/s + cooldown)', () => {
  let service: GeocodingService;
  let fetchSpy: jest.SpyInstance;

  const okSearch = (q: string) => ({
    ok: true,
    status: 200,
    json: async () => [
      {
        place_id: '1',
        display_name: `${q}, Nicoya`,
        lat: '10.1',
        lon: '-85.4',
        type: 'road',
        importance: 0.5,
        address: {},
      },
    ],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeocodingService],
    }).compile();
    service = module.get(GeocodingService);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it('llamadas idénticas en vuelo comparten un solo fetch', async () => {
    fetchSpy.mockImplementation(
      () => new Promise((r) => setTimeout(() => r(okSearch('x') as any), 50)),
    );
    const [a, b] = await Promise.all([
      (service as any).nominatimFetch('https://u/1'),
      (service as any).nominatimFetch('https://u/1'),
    ]);
    expect(a).toBe(b);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('en 429 entra en cooldown y no vuelve a llamar por 60s', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 429 } as any);

    const r1 = await (service as any).nominatimFetch('https://u/2');
    expect(r1).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Dentro del cooldown: ni siquiera intenta
    const r2 = await (service as any).nominatimFetch('https://u/3');
    expect(r2).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('search devuelve [] en cooldown en vez de reventar', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 429 } as any);
    await expect(service.search('Matabuey')).resolves.toEqual([]);
    // Segunda búsqueda distinta: bloqueada por cooldown, sin fetch nuevo
    await expect(service.search('Centro')).resolves.toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('espacia llamadas seguidas ~1.1s (política de Nominatim)', async () => {
    jest.useFakeTimers();
    fetchSpy.mockResolvedValue(okSearch('x') as any);
    const t0 = Date.now();
    const p1 = (service as any).nominatimFetch('https://u/a');
    const p2 = (service as any).nominatimFetch('https://u/b');
    await jest.advanceTimersByTimeAsync(1500);
    await Promise.all([p1, p2]);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1100);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('GeocodingService.resolveMapLink (allowlist por hop)', () => {
  let service: GeocodingService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeocodingService],
    }).compile();
    service = module.get(GeocodingService);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const redirect = (location: string) =>
    ({
      status: 302,
      headers: { get: (k: string) => (k.toLowerCase() === 'location' ? location : null) },
      arrayBuffer: async () => new ArrayBuffer(0),
    }) as any;

  it('redirect fuera del allowlist → null sin seguir (SSRF)', async () => {
    fetchSpy.mockResolvedValueOnce(redirect('http://169.254.169.254/latest/meta-data/'));
    const res = await service.resolveMapLink('https://maps.app.goo.gl/corto123');
    expect(res).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('downgrade a http en el redirect → null', async () => {
    fetchSpy.mockResolvedValueOnce(redirect('http://www.google.com/maps?q=x'));
    const res = await service.resolveMapLink('https://maps.app.goo.gl/corto123');
    expect(res).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('redirect dentro del allowlist con coords → resuelve', async () => {
    fetchSpy
      .mockResolvedValueOnce(redirect('https://www.google.com/maps?q=10.1,-85.4'))
      .mockResolvedValueOnce({
        status: 200,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => '',
      } as any);
    const res = await service.resolveMapLink('https://maps.app.goo.gl/corto123');
    expect(res).not.toBeNull();
    expect(res!.lat).toBeCloseTo(10.1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
