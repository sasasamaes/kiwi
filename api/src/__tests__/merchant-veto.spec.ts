// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { ZonesService } from '../zones/zones.service';
import { CoverageService } from '../service-area/coverage.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { ProximityService } from '../orders/proximity.service';

// Mock ESM problemáticos (mismo patrón que otros specs).
jest.mock('@nestjs/websockets', () => ({}), { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });

jest.mock('../events/events.gateway', () => ({
  EventsGateway: jest.fn().mockImplementation(() => ({
    sendToRole: jest.fn(),
    sendToUser: jest.fn(),
  })),
}));

/**
 * Veto por comercio: el comercio no quiere a un repartidor en sus pedidos.
 * El vetado no recibe alertas, no ve esos pedidos en disponibles y no puede
 * aceptarlos ni ser asignado — pero sigue recibiendo de los demás comercios.
 */
describe('MerchantDriverVeto', () => {
  let service: OrdersService;
  let prisma: any;
  let gateway: any;
  let notifications: any;
  let proximity: any;

  const ORDER: any = {
    id: 'order-v1',
    merchantId: 'merchant-guanacaste',
    status: 'pending',
    pickupAddress: 'Farmacia Guanacaste',
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
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      driverProfile: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      merchantDriverVeto: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
      $executeRaw: jest.fn().mockResolvedValue([]),
    };
    gateway = { sendToRole: jest.fn(), sendToUser: jest.fn() };
    notifications = {
      notifyNewOrderTopic: jest.fn().mockResolvedValue({}),
      notifyDriverNewOrderTargeted: jest.fn().mockResolvedValue({ delivered: true }),
      notifyScheduledOrderTopic: jest.fn().mockResolvedValue({}),
      notifyDriverScheduledOrderTargeted: jest.fn().mockResolvedValue({ delivered: true }),
    };
    proximity = { findNearbyDrivers: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: ZonesService, useValue: { resolvePriceAt: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: gateway },
        { provide: DriversService, useValue: {} },
        { provide: GeocodingService, useValue: {} },
        { provide: ProximityService, useValue: proximity },
        { provide: NotificationsService, useValue: notifications },
        {
          provide: SettingsService,
          useValue: { getTestDriverEmails: jest.fn().mockResolvedValue([]) },
        },
        { provide: CoverageService, useValue: {} },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  const flush = () => new Promise((r) => setImmediate(r));

  it('targeted: filtra al vetado, el resto recibe igual', async () => {
    prisma.merchantDriverVeto.findMany.mockResolvedValue([{ driverId: 'fran' }]);
    proximity.findNearbyDrivers.mockResolvedValue({
      candidates: [
        { userId: 'user-fran', driverId: 'fran', distanceKm: 0.4 },
        { userId: 'user-juan', driverId: 'juan', distanceKm: 1.2 },
      ],
      radiusUsedKm: 3,
      staleSkipped: 0,
    });

    await (service as any).alertNearbyDrivers(ORDER, { id: ORDER.id });
    await flush();

    const toUsers = gateway.sendToUser.mock.calls.map((c: any[]) => c[0]);
    expect(toUsers).toContain('user-juan');
    expect(toUsers).not.toContain('user-fran');
    expect(notifications.notifyDriverNewOrderTargeted).toHaveBeenCalledTimes(1);
    expect(gateway.sendToRole.mock.calls.filter((c: any[]) => c[0] === 'driver')).toHaveLength(0);
  });

  it('broadcast con vetoes: fan-out por usuario, sin ciego ni topic', async () => {
    prisma.merchantDriverVeto.findMany.mockResolvedValue([{ driverId: 'fran' }]);
    proximity.findNearbyDrivers.mockResolvedValue({
      candidates: null,
      radiusUsedKm: 12,
      staleSkipped: 0,
    });
    prisma.driverProfile.findMany.mockResolvedValue([
      { id: 'fran', userId: 'user-fran' },
      { id: 'juan', userId: 'user-juan' },
    ]);

    await (service as any).alertNearbyDrivers(ORDER, { id: ORDER.id });
    await flush();

    const toUsers = gateway.sendToUser.mock.calls.map((c: any[]) => c[0]);
    expect(toUsers).toContain('user-juan');
    expect(toUsers).not.toContain('user-fran');
    expect(gateway.sendToRole.mock.calls.filter((c: any[]) => c[0] === 'driver')).toHaveLength(0);
    expect(notifications.notifyNewOrderTopic).not.toHaveBeenCalled();
    expect(notifications.notifyDriverNewOrderTargeted).toHaveBeenCalledTimes(1);
  });

  it('sin vetoes: broadcast ciego igual que antes', async () => {
    proximity.findNearbyDrivers.mockResolvedValue({
      candidates: null,
      radiusUsedKm: 12,
      staleSkipped: 0,
    });

    await (service as any).alertNearbyDrivers(ORDER, { id: ORDER.id });
    await flush();

    expect(gateway.sendToRole).toHaveBeenCalledWith('driver', 'order:new', { id: ORDER.id });
    expect(notifications.notifyNewOrderTopic).toHaveBeenCalledTimes(1);
  });

  it('disponibles: oculta pedidos de comercios que vetaron al driver', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'fran' });
    prisma.merchantDriverVeto.findMany.mockResolvedValue([{ merchantId: 'merchant-guanacaste' }]);
    prisma.order.findMany.mockResolvedValue([{ id: 'o1' }]);

    await service.getAvailableOrders(undefined, undefined, { driverUserId: 'user-fran' });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ merchantId: { notIn: ['merchant-guanacaste'] } }),
      }),
    );
  });

  it('disponibles: sin vetoes no filtra por comercio', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'juan' });
    prisma.order.findMany.mockResolvedValue([{ id: 'o1' }]);

    await service.getAvailableOrders(undefined, undefined, { driverUserId: 'user-juan' });

    const where = prisma.order.findMany.mock.calls[0][0].where;
    expect(where.merchantId).toBeUndefined();
  });

  it('accept: el vetado no puede tomar el pedido', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...ORDER, driverId: null });
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'fran', userId: 'user-fran' });
    prisma.merchantDriverVeto.findUnique.mockResolvedValue({
      id: 'v1',
      merchantId: 'merchant-guanacaste',
      driverId: 'fran',
    });

    await expect(service.acceptOrderAsDriver(ORDER.id, 'user-fran')).rejects.toThrow(
      'no trabaja con tu cuenta',
    );
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('propuesta: el vetado no puede proponer en programados', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...ORDER,
      orderType: 'scheduled',
      status: 'driver_proposals',
    });
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'fran', userId: 'user-fran' });
    prisma.merchantDriverVeto.findUnique.mockResolvedValue({ id: 'v1' });

    await expect(service.submitProposal(ORDER.id, 'user-fran', {})).rejects.toThrow(
      'no trabaja con tu cuenta',
    );
  });
});
