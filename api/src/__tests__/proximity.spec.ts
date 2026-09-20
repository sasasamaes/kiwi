import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import {
  ProximityService,
  haversineKm,
  RADIUS_STEPS_KM,
  MIN_CANDIDATES,
  MAX_RADIUS_KM,
} from '../orders/proximity.service';

// Mock ESM problemáticos (mismo patrón que orders.integration.spec).
jest.mock('@nestjs/websockets', () => ({}), { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });

jest.mock('../events/events.gateway', () => ({
  EventsGateway: jest.fn().mockImplementation(() => ({
    sendToRole: jest.fn(),
    sendToUser: jest.fn(),
  })),
}));

describe('haversineKm', () => {
  it('distancia cero consigo mismo', () => {
    expect(haversineKm(10.1483, -85.4527, 10.1483, -85.4527)).toBeCloseTo(0, 5);
  });

  it('1 grado de latitud ≈ 111 km', () => {
    expect(haversineKm(10, -85, 11, -85)).toBeCloseTo(111.2, 0);
  });

  it('Nicoya → San José ≈ 170 km (sanity geográfico)', () => {
    const d = haversineKm(10.1483, -85.4527, 9.9281, -84.0907);
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(190);
  });
});

describe('ProximityService.findNearbyDrivers', () => {
  let service: ProximityService;
  let prisma: any;

  const driver = (id: string, lat: number | null, lng: number | null, seenMinAgo = 1) => ({
    id,
    userId: `user-${id}`,
    lastLat: lat,
    lastLng: lng,
    lastSeenAt: seenMinAgo == null ? null : new Date(Date.now() - seenMinAgo * 60_000),
  });

  beforeEach(async () => {
    prisma = { driverProfile: { findMany: jest.fn().mockResolvedValue([]) } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProximityService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ProximityService);
  });

  it('selecciona solo los drivers dentro del radio base, ordenados por distancia', async () => {
    // Pickup en Nicoya centro: cerca (0.5km), media (2km), lejos (2.8km) —
    // los tres dentro del escalón base de 3km (MIN_CANDIDATES=3 justito).
    prisma.driverProfile.findMany.mockResolvedValue([
      driver('far', 10.1735, -85.4527), // ~2.8km
      driver('mid', 10.166, -85.4527), // ~2km
      driver('near', 10.1527, -85.4527), // ~0.5km
    ]);

    const { candidates, radiusUsedKm } = await service.findNearbyDrivers(10.1483, -85.4527);
    expect(radiusUsedKm).toBe(RADIUS_STEPS_KM[0]);
    expect(candidates!.map((c) => c.driverId)).toEqual(['near', 'mid', 'far']);
  });

  it('expande el radio por escalones cuando el base no junta MIN_CANDIDATES', async () => {
    // 3 drivers entre 3 y 6 km: el escalón base (3km) no junta, el segundo sí.
    prisma.driverProfile.findMany.mockResolvedValue([
      driver('a', 10.1753, -85.4527), // ~3km
      driver('b', 10.1755, -85.4527), // ~3km
      driver('c', 10.176, -85.4527), // ~3.1km
    ]);

    const { candidates, radiusUsedKm } = await service.findNearbyDrivers(10.1483, -85.4527);
    expect(radiusUsedKm).toBeGreaterThan(RADIUS_STEPS_KM[0]);
    expect(candidates!.length).toBe(3);
  });

  it('descarta drivers con ubicación vieja (> LOCATION_FRESH_MIN)', async () => {
    prisma.driverProfile.findMany.mockResolvedValue([
      driver('fresh', 10.1527, -85.4527, 2),
      driver('stale', 10.1485, -85.4527, 90), // a 200m pero ping de hace 90min
    ]);

    const { candidates, staleSkipped } = await service.findNearbyDrivers(10.1483, -85.4527);
    expect(candidates!.map((c) => c.driverId)).toEqual(['fresh']);
    expect(staleSkipped).toBe(1);
  });

  it('incluye (fail-open) al driver que nunca reportó ping pero tiene backfill', async () => {
    prisma.driverProfile.findMany.mockResolvedValue([
      driver('backfilled', 10.1484, -85.4527, null),
    ]);

    const { candidates } = await service.findNearbyDrivers(10.1483, -85.4527);
    expect(candidates!.map((c) => c.driverId)).toEqual(['backfilled']);
  });

  it('sin nadie en MAX_RADIUS → candidates null (el caller hace broadcast)', async () => {
    prisma.driverProfile.findMany.mockResolvedValue([
      driver('lejos', 10.6, -85.4527, 1), // ~50km
    ]);

    const { candidates, radiusUsedKm } = await service.findNearbyDrivers(10.1483, -85.4527);
    expect(candidates).toBeNull();
    expect(radiusUsedKm).toBe(MAX_RADIUS_KM);
  });

  it('drivers sin coordenadas se ignoran sin romper el selector', async () => {
    prisma.driverProfile.findMany.mockResolvedValue([
      driver('sin-geo', null, null),
      driver('cerca', 10.15, -85.4527, 1),
    ]);

    const { candidates } = await service.findNearbyDrivers(10.1483, -85.4527);
    expect(candidates!.map((c) => c.driverId)).toEqual(['cerca']);
  });

  it('invariantes: MIN_CANDIDATES alcanizable en el último escalón', () => {
    expect(RADIUS_STEPS_KM[RADIUS_STEPS_KM.length - 1]).toBe(MAX_RADIUS_KM);
    expect(MIN_CANDIDATES).toBeGreaterThan(0);
  });
});

describe('OrdersService targeting de order:new', () => {
  let service: OrdersService;
  let prisma: any;
  let gateway: any;
  let notifications: any;
  let proximity: any;

  const ORDER = {
    id: 'order-9',
    merchantId: 'merchant-1',
    status: 'pending',
    pickupAddress: 'Bowl & Café',
    deliveryAddress: 'Barrio',
    totalAmount: 5000,
    distanceKm: 2,
    pickupLat: 10.1483,
    pickupLng: -85.4527,
    driverPayout: 2000,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      order: {
        create: jest.fn().mockResolvedValue(ORDER),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      merchantProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'merchant-1', userId: 'm1', businessName: 'Bowl' }),
      },
      menuItem: { findMany: jest.fn().mockResolvedValue([]) },
      orderItem: { createMany: jest.fn().mockResolvedValue({}) },
    };
    gateway = { sendToRole: jest.fn(), sendToUser: jest.fn() };
    notifications = {
      notifyNewOrderTopic: jest.fn().mockResolvedValue({}),
      notifyDriverNewOrderTargeted: jest.fn().mockResolvedValue({ delivered: true }),
    };
    proximity = { findNearbyDrivers: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: gateway },
        { provide: DriversService, useValue: { getLocation: jest.fn() } },
        { provide: ProximityService, useValue: proximity },
        { provide: GeocodingService, useValue: { searchCostaRica: jest.fn() } },
        { provide: NotificationsService, useValue: notifications },
        {
          provide: SettingsService,
          useValue: { getDriverCommissionPct: jest.fn().mockResolvedValue(15) },
        },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  it('con candidatos: order:new por socket 1:1 + push dirigido, SIN broadcast', async () => {
    proximity.findNearbyDrivers.mockResolvedValue({
      candidates: [
        { userId: 'user-a', driverId: 'a', distanceKm: 0.4 },
        { userId: 'user-b', driverId: 'b', distanceKm: 1.2 },
      ],
      radiusUsedKm: 3,
      staleSkipped: 1,
    });

    await service.create('m1', {
      pickupAddress: 'x',
      deliveryAddress: 'y',
      pickupLat: 10.1483,
      pickupLng: -85.4527,
    });

    expect(gateway.sendToUser).toHaveBeenCalledTimes(2);
    expect(gateway.sendToUser.mock.calls[0][0]).toBe('user-a');
    expect(gateway.sendToUser.mock.calls[0][1]).toBe('order:new');
    expect(gateway.sendToUser.mock.calls[0][2]).toMatchObject({
      id: 'order-9',
      distanceToPickupKm: 0.4,
    });
    expect(gateway.sendToRole).not.toHaveBeenCalled();
    expect(notifications.notifyDriverNewOrderTargeted).toHaveBeenCalledTimes(2);
    expect(notifications.notifyNewOrderTopic).not.toHaveBeenCalled();
  });

  it('sin candidatos: fail-open a broadcast por rol (socket + topic FCM)', async () => {
    proximity.findNearbyDrivers.mockResolvedValue({
      candidates: null,
      radiusUsedKm: 12,
      staleSkipped: 0,
    });

    await service.create('m1', {
      pickupAddress: 'x',
      deliveryAddress: 'y',
      pickupLat: 10.1483,
      pickupLng: -85.4527,
    });

    expect(gateway.sendToRole).toHaveBeenCalledWith(
      'driver',
      'order:new',
      expect.objectContaining({ id: 'order-9' }),
    );
    expect(notifications.notifyNewOrderTopic).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-9' }),
    );
    expect(gateway.sendToUser).not.toHaveBeenCalled();
  });

  it('pedido sin coords de pickup: broadcast directo (no llama al selector)', async () => {
    // El created order (mock) define si hay coords — sin ellas, broadcast.
    prisma.order.create.mockResolvedValue({ ...ORDER, pickupLat: null, pickupLng: null });

    await service.create('m1', { pickupAddress: 'x', deliveryAddress: 'y' });

    expect(proximity.findNearbyDrivers).not.toHaveBeenCalled();
    expect(gateway.sendToRole).toHaveBeenCalled();
  });

  it('si el targeting explota, el broadcast de emergencia mantiene viva la alerta', async () => {
    proximity.findNearbyDrivers.mockRejectedValue(new Error('DB down'));

    await service.create('m1', {
      pickupAddress: 'x',
      deliveryAddress: 'y',
      pickupLat: 10.1,
      pickupLng: -85.4,
    });

    expect(gateway.sendToRole).toHaveBeenCalledWith(
      'driver',
      'order:new',
      expect.objectContaining({ id: 'order-9' }),
    );
  });
});
