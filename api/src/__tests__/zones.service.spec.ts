// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test } from '@nestjs/testing';
import { ZonesService } from '../zones/zones.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { ZoneGeometry } from '../orders/zone-geometry';

const settingsMock = {
  getAll: jest.fn(async () => ({
    costing: {
      fuelPricePerLiter: 720,
      kmPerLiter: { motorcycle: 42, motorized_bike: 60, bicycle: 0, car: 13, truck: 9 },
      maintenancePerKm: { motorcycle: 45, motorized_bike: 35, bicycle: 10, car: 85, truck: 120 },
      driverPayPerHour: 2800,
      avgSpeedKmh: 27,
      fixedMinutesPerTrip: 12,
      kiwiMarginPct: 15,
    },
  })),
};

describe('ZonesService', () => {
  let svc: ZonesService;
  const store: any[] = [];
  const prisma = {
    deliveryZone: {
      findMany: jest.fn(async ({ where }: any = {}) =>
        store.filter((z) => (where?.active ? z.active : true)),
      ),
      findUnique: jest.fn(async ({ where }: any) => store.find((z) => z.id === where.id) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const z = { id: `z${store.length + 1}`, ...data };
        store.push(z);
        return z;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const z = store.find((x) => x.id === where.id);
        Object.assign(z, data);
        return z;
      }),
    },
  };

  const square: ZoneGeometry = {
    type: 'Polygon',
    coordinates: [
      [
        [-85.46, 10.13],
        [-85.44, 10.13],
        [-85.44, 10.15],
        [-85.46, 10.15],
        [-85.46, 10.13],
      ],
    ],
  };

  beforeEach(async () => {
    store.length = 0;
    jest.clearAllMocks();
    const m = await Test.createTestingModule({
      providers: [
        ZonesService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settingsMock },
      ],
    }).compile();
    svc = m.get(ZonesService);
  });

  it('create: marca referenceOnly=true cuando no hay geometría', async () => {
    const z = await svc.create({
      label: 'Centro',
      price: 1000,
      latitude: 10.14,
      longitude: -85.45,
    });
    expect(z.referenceOnly).toBe(true);
  });

  it('create: con geometría → referenceOnly=false', async () => {
    const z = await svc.create({ label: 'Barrio', price: 1500, geometry: square });
    expect(z.referenceOnly).toBe(false);
  });

  it('create: rechaza sin nombre y precio inválido', async () => {
    await expect(svc.create({ label: '', price: 1000 })).rejects.toThrow();
    await expect(svc.create({ label: 'X', price: -5 })).rejects.toThrow();
  });

  it('resolvePriceAt: cobra la zona del polígono que contiene el punto', async () => {
    await svc.create({ label: 'Barrio', price: 1500, geometry: square });
    const r = await svc.resolvePriceAt(10.14, -85.45);
    expect(r).toMatchObject({ source: 'polygon' });
    expect((r as any).zone.price).toBe(1500);
  });

  it('resolvePriceAt: sin polígono → referencia más cercana', async () => {
    await svc.create({ label: 'Cerca', price: 1000, latitude: 10.141, longitude: -85.451 });
    const r = await svc.resolvePriceAt(10.14, -85.45);
    expect(r).toMatchObject({ source: 'reference' });
    expect((r as any).zone.label).toBe('Cerca');
  });

  it('deactivate: la saca de list() pero sigue en listAll()', async () => {
    const z = await svc.create({ label: 'X', price: 1000 });
    await svc.deactivate(z.id);
    expect((await svc.list()).length).toBe(0);
    expect((await svc.listAll()).length).toBe(1);
  });

  it('priceModel: ajusta base + tarifa con zonas a distinta distancia', async () => {
    // 10.1467,-85.452 = centro (d≈0). 0.09° lat ≈ 10 km al norte.
    await svc.create({ label: 'Centro', price: 1000, latitude: 10.1467, longitude: -85.452 });
    await svc.create({ label: 'Lejos', price: 6000, latitude: 10.2367, longitude: -85.452 });
    const m = await svc.priceModel();
    expect(m.samples).toBe(2);
    expect(m.ratePerKm).toBeGreaterThan(400);
    expect(m.ratePerKm).toBeLessThan(600);
    expect(m.base).toBeGreaterThanOrEqual(0);
    expect(m.minPrice).toBe(1000);
    expect(m.maxPrice).toBe(6000);
  });

  it('priceModel: sin puntos suficientes → tarifa 0 y base = mínimo', async () => {
    await svc.create({ label: 'SinPunto', price: 1500 });
    const m = await svc.priceModel();
    expect(m).toMatchObject({ ratePerKm: 0, samples: 0, minPrice: 0, maxPrice: 0 });
  });

  it('suggestPrice: interpola, redondea a ₡500 y acota al rango', async () => {
    await svc.create({ label: 'Centro', price: 1000, latitude: 10.1467, longitude: -85.452 });
    await svc.create({ label: 'Lejos', price: 6000, latitude: 10.2367, longitude: -85.452 });
    const mid = await svc.suggestPrice(10.1917, -85.452); // ≈5 km
    expect(mid.distanceKm).toBeGreaterThan(4);
    expect(mid.distanceKm).toBeLessThan(6);
    expect(mid.price % 500).toBe(0);
    expect(mid.price).toBeGreaterThan(1000);
    expect(mid.price).toBeLessThan(6000);
    const far = await svc.suggestPrice(11.0, -85.452); // muy lejos → tope
    expect(far.price).toBe(6000);
  });

  it('suggestPrice: rechaza coordenadas inválidas', async () => {
    await expect(svc.suggestPrice(Number.NaN, -85.452)).rejects.toThrow();
    await expect(svc.suggestPrice(100, -85.452)).rejects.toThrow();
  });
});
