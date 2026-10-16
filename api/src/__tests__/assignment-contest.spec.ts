// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
jest.mock('@nestjs/websockets', () => ({}), { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });

const mockEventsGateway = {
  notifyNewOrder: jest.fn(),
  notifyOrderUpdate: jest.fn(),
  broadcast: jest.fn(),
  sendToRole: jest.fn(),
  sendToUser: jest.fn(),
  handleConnection: jest.fn(),
  handleDisconnect: jest.fn(),
};

jest.mock('../events/events.gateway', () => ({
  EventsGateway: jest.fn().mockImplementation(() => mockEventsGateway),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { ZonesService } from '../zones/zones.service';
import { AssignmentSweeper } from '../orders/assignment-sweeper.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { ProximityService } from '../orders/proximity.service';
import { ImageUploadService } from '../menu/image-upload.service';

describe('Assignment contest (Task 6): 10 criterios', () => {
  let service: OrdersService;
  let sweeper: AssignmentSweeper;
  let prisma: any;
  let notifications: any;
  let settings: any;
  let ordersMock: any;

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      driverProfile: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      merchantProfile: { findUnique: jest.fn() },
      driverProposal: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      orderEvent: { create: jest.fn().mockResolvedValue({}) },
      notification: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    jest.clearAllMocks();

    notifications = {
      notifyOrderStatusUpdate: jest.fn().mockResolvedValue({}),
      notifyOrderAccepted: jest.fn().mockResolvedValue({}),
      notifyOrderRejected: jest.fn().mockResolvedValue({}),
      notifyAssignmentOffered: jest.fn().mockResolvedValue({}),
      notifyContestStarted: jest.fn().mockResolvedValue({}),
      notifyNoDriverAvailable: jest.fn().mockResolvedValue({}),
      notifyNewOrderTopic: jest.fn().mockResolvedValue({ delivered: 0, inbox: 0 }),
      notifyDriverNewOrderTargeted: jest.fn().mockResolvedValue({ delivered: true }),
    };
    settings = {
      getDriverCommissionPct: jest.fn().mockResolvedValue(15),
      getAssignmentTimeouts: jest
        .fn()
        .mockResolvedValue({ acceptanceMinutes: 5, contestMinutes: 10 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: ZonesService,
          useValue: {
            list: jest.fn().mockResolvedValue([]),
            listAll: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
            update: jest.fn(),
            deactivate: jest.fn(),
            resolvePriceAt: jest.fn().mockResolvedValue(null),
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: DriversService, useValue: { getLocation: jest.fn() } },
        {
          provide: ProximityService,
          useValue: {
            findNearbyDrivers: jest
              .fn()
              .mockResolvedValue({ candidates: null, radiusUsedKm: 12, staleSkipped: 0 }),
          },
        },
        {
          provide: GeocodingService,
          useValue: { searchCostaRica: jest.fn().mockResolvedValue([]) },
        },
        { provide: NotificationsService, useValue: notifications },
        { provide: SettingsService, useValue: settings },
        { provide: ImageUploadService, useValue: { uploadProofImage: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrdersService);
    ordersMock = { alertNearbyDrivers: jest.fn().mockResolvedValue(undefined) };
    sweeper = new AssignmentSweeper(
      prisma as any,
      settings as any,
      mockEventsGateway as any,
      notifications as any,
      ordersMock as any,
    );
  });

  it('1. acceptAssignment dentro del plazo → assigned (claim con acceptanceExpiresAt > ahora)', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'dp-1',
      fullName: 'Juan',
      userId: 'user-d',
    });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'assigned',
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });

    const res: any = await service.acceptAssignment('order-1', 'user-d');

    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-1',
          driverId: 'dp-1',
          status: 'pending_acceptance',
          acceptanceExpiresAt: expect.objectContaining({ gt: expect.any(Date) }),
        }),
        data: expect.objectContaining({ status: 'assigned', acceptanceExpiresAt: null }),
      }),
    );
    expect(prisma.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: 'order-1', type: 'accepted' }),
      }),
    );
    expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
      'merchant-user-1',
      'order:accepted',
      expect.objectContaining({ orderId: 'order-1' }),
    );
    expect(res.status).toBe('assigned');
  });

  it('2. rejectOrderAsDriver en pending_acceptance → pending con contestEndsAt ≈ +10 min y eventos rejected+contest_started', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'dp-1',
      fullName: 'Juan',
      userId: 'user-d',
    });
    // Claim único con guarda completa (driver + estado + ventana de concurso).
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'pending',
      merchant: { userId: 'merchant-user-1' },
      pickupAddress: 'A',
      deliveryAddress: 'B',
      totalAmount: 5000,
      driverPayout: 4000,
      distanceKm: 2,
      createdAt: new Date(),
    });

    const before = Date.now();
    await service.rejectOrderAsDriver('order-1', 'user-d');

    expect(prisma.order.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-1',
          driverId: 'dp-1',
          status: { in: ['assigned', 'pending_acceptance', 'in_transit_to_pickup'] },
        }),
        data: expect.objectContaining({ driverId: null, status: 'pending' }),
      }),
    );
    const contestData = prisma.order.updateMany.mock.calls[0][0].data;
    const endsIn = new Date(contestData.contestEndsAt).getTime() - before;
    expect(contestData.contestStartedAt).toBeInstanceOf(Date);
    expect(endsIn).toBeGreaterThan(9 * 60_000);
    expect(endsIn).toBeLessThan(11 * 60_000);
    const types = prisma.orderEvent.create.mock.calls.map((c: any) => c[0].data.type);
    expect(types).toContain('rejected');
    expect(types).toContain('contest_started');
    expect(types.filter((t: string) => t === 'contest_started')[0]).toBeDefined();
    expect(
      prisma.orderEvent.create.mock.calls.find((c: any) => c[0].data.type === 'contest_started')[0]
        .data.meta,
    ).toEqual({ reason: 'rejected' });
  });

  it('3. sweepOnce con pending_acceptance vencida → pending en concurso + notifyContestStarted 1 vez', async () => {
    prisma.order.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.status === 'pending_acceptance') {
        return [{ id: 'order-1', driverId: 'dp-1', merchantId: 'mp-1' }];
      }
      return [];
    });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      pickupAddress: 'A',
      deliveryAddress: 'B',
      deliveryZone: null,
      totalAmount: 5000,
      driverPayout: 4000,
      distanceKm: 2,
      createdAt: new Date(),
      merchant: { userId: 'merchant-user-1', businessName: 'Soda' },
    });

    const res = await sweeper.sweepOnce();

    expect(res).toEqual({ acceptanceExpired: 1, contestsExpired: 0 });
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'order-1', status: 'pending_acceptance' }),
        data: expect.objectContaining({ status: 'pending' }),
      }),
    );
    expect(notifications.notifyContestStarted).toHaveBeenCalledTimes(1);
    expect(notifications.notifyContestStarted).toHaveBeenCalledWith('order-1', 'merchant-user-1');
    expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
      'merchant-user-1',
      'order:contestStarted',
      expect.objectContaining({ orderId: 'order-1' }),
    );
    expect(ordersMock.alertNearbyDrivers).toHaveBeenCalledTimes(1);
  });

  it('4. acceptOrderAsDriver en pending de concurso → assigned y limpia contestEndsAt', async () => {
    const future = new Date(Date.now() + 5 * 60_000);
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 'order-1',
        status: 'pending',
        driverId: null,
        orderType: 'immediate',
        contestStartedAt: new Date(Date.now() - 60_000),
        contestEndsAt: future,
      })
      .mockResolvedValueOnce({
        id: 'order-1',
        status: 'assigned',
        driverId: 'dp-2',
        merchant: { userId: 'merchant-user-1' },
        driver: { userId: 'user-d2' },
      });
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'dp-2',
      fullName: 'Fran',
      userId: 'user-d2',
    });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });

    const res: any = await service.acceptOrderAsDriver('order-1', 'user-d2');

    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'order-1', status: 'pending', driverId: null }),
        data: expect.objectContaining({
          status: 'assigned',
          contestStartedAt: null,
          contestEndsAt: null,
        }),
      }),
    );
    expect(res.status).toBe('assigned');
    expect(prisma.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: 'order-1', type: 'accepted' }),
      }),
    );
  });

  it('5. doble claim: primero count 1, segundo count 0 → el segundo lanza "ya tomó"', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce({ id: 'order-1', status: 'pending', driverId: null })
      .mockResolvedValueOnce({
        id: 'order-1',
        status: 'assigned',
        driverId: 'dp-1',
        merchant: { userId: 'merchant-user-1' },
        driver: { userId: 'user-d1' },
      })
      .mockResolvedValueOnce({ id: 'order-1', status: 'pending', driverId: null })
      .mockResolvedValueOnce({
        id: 'order-1',
        status: 'assigned',
        driverId: 'dp-1',
        driver: { fullName: 'Juan' },
      });
    prisma.driverProfile.findUnique
      .mockResolvedValueOnce({ id: 'dp-1', fullName: 'Juan', userId: 'user-d1' })
      .mockResolvedValueOnce({ id: 'dp-2', fullName: 'Fran', userId: 'user-d2' });
    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const first: any = await service.acceptOrderAsDriver('order-1', 'user-d1');
    expect(first.status).toBe('assigned');

    await expect(service.acceptOrderAsDriver('order-1', 'user-d2')).rejects.toThrow(/ya tomó/);
  });

  it('6. sweepOnce con pending + contestEndsAt pasada + driverId null → no_driver + notifyNoDriverAvailable', async () => {
    prisma.order.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.status === 'pending') {
        return [{ id: 'order-2' }];
      }
      return [];
    });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-2',
      merchant: { userId: 'merchant-user-9' },
    });

    const res = await sweeper.sweepOnce();

    expect(res).toEqual({ acceptanceExpired: 0, contestsExpired: 1 });
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'order-2', status: 'pending', driverId: null }),
        data: expect.objectContaining({ status: 'no_driver' }),
      }),
    );
    const types = prisma.orderEvent.create.mock.calls.map((c: any) => c[0].data.type);
    expect(types).toContain('contest_expired');
    expect(types).toContain('no_driver');
    expect(notifications.notifyNoDriverAvailable).toHaveBeenCalledTimes(1);
    expect(notifications.notifyNoDriverAvailable).toHaveBeenCalledWith(
      'order-2',
      'merchant-user-9',
    );
    expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
      'merchant-user-9',
      'order:noDriver',
      expect.objectContaining({
        orderId: 'order-2',
        message: 'No hay repartidores disponibles para aceptar este pedido en este momento.',
      }),
    );
  });

  it('7. sweepOnce ignora cancelled/delivered aunque tengan deadlines viejas', async () => {
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });

    const res = await sweeper.sweepOnce();

    expect(res).toEqual({ acceptanceExpired: 0, contestsExpired: 0 });
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(notifications.notifyContestStarted).not.toHaveBeenCalled();
    expect(notifications.notifyNoDriverAvailable).not.toHaveBeenCalled();
    // El filtro por estado es lo que deja fuera a cancelled/delivered.
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'pending_acceptance' }) }),
    );
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'pending' }) }),
    );
  });

  it('8. sweepOnce procesa vencidos de antes del reinicio (fechas pasadas) → transiciona igual', async () => {
    prisma.order.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.status === 'pending_acceptance') {
        return [{ id: 'old-accept', driverId: 'dp-9', merchantId: 'mp-9' }];
      }
      if (args?.where?.status === 'pending') {
        return [{ id: 'old-contest' }];
      }
      return [];
    });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findUnique.mockImplementation(async (args: any) => ({
      id: args.where.id,
      pickupAddress: 'A',
      deliveryAddress: 'B',
      deliveryZone: null,
      totalAmount: 3000,
      driverPayout: 2500,
      distanceKm: 1,
      createdAt: new Date(Date.now() - 2 * 3600_000),
      merchant: { userId: 'merchant-old', businessName: 'Soda Vieja' },
    }));

    const res = await sweeper.sweepOnce();

    expect(res).toEqual({ acceptanceExpired: 1, contestsExpired: 1 });
    expect(notifications.notifyContestStarted).toHaveBeenCalledTimes(1);
    expect(notifications.notifyNoDriverAvailable).toHaveBeenCalledTimes(1);
  });

  it('9. sweepOnce con el mismo vencido dos veces → segunda 0 cambios y sin notificar', async () => {
    prisma.order.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.status === 'pending_acceptance') {
        return [{ id: 'order-1', driverId: 'dp-1', merchantId: 'mp-1' }];
      }
      return [];
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      pickupAddress: 'A',
      deliveryAddress: 'B',
      deliveryZone: null,
      totalAmount: 5000,
      driverPayout: 4000,
      distanceKm: 2,
      createdAt: new Date(),
      merchant: { userId: 'merchant-user-1', businessName: 'Soda' },
    });

    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });
    const first = await sweeper.sweepOnce();
    expect(first).toEqual({ acceptanceExpired: 1, contestsExpired: 0 });
    expect(notifications.notifyContestStarted).toHaveBeenCalledTimes(1);

    // El claim ya no matchea: segunda barrida sin cambios ni avisos.
    prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });
    notifications.notifyContestStarted.mockClear();
    mockEventsGateway.sendToUser.mockClear();
    ordersMock.alertNearbyDrivers.mockClear();

    const second = await sweeper.sweepOnce();
    expect(second).toEqual({ acceptanceExpired: 0, contestsExpired: 0 });
    expect(notifications.notifyContestStarted).not.toHaveBeenCalled();
    expect(ordersMock.alertNearbyDrivers).not.toHaveBeenCalled();
  });

  it('10. acceptOrderAsDriver en pending clásico sin contestEndsAt → assigned', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 'order-1',
        status: 'pending',
        driverId: null,
        orderType: 'immediate',
        contestStartedAt: null,
        contestEndsAt: null,
      })
      .mockResolvedValueOnce({
        id: 'order-1',
        status: 'assigned',
        driverId: 'dp-1',
        merchant: { userId: 'merchant-user-1' },
        driver: { userId: 'user-d' },
      });
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'dp-1',
      fullName: 'Juan',
      userId: 'user-d',
    });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });

    const res: any = await service.acceptOrderAsDriver('order-1', 'user-d');

    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'assigned', driverId: 'dp-1' }),
      }),
    );
    expect(res.status).toBe('assigned');
  });

  it('11. asignación directa avisa solo al elegido; la flota solo saca el pedido en silencio', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'dp-1',
      fullName: 'Juan',
      userId: 'user-d',
      status: 'available',
    });
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1', merchantId: 'mp-1' });
    prisma.order.findUnique
      .mockResolvedValueOnce({ id: 'order-1', orderType: 'immediate' })
      .mockResolvedValueOnce({
        id: 'order-1',
        status: 'pending_acceptance',
        merchant: { userId: 'merchant-user-1' },
        driver: { userId: 'user-d', fullName: 'Juan' },
      });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });

    await service.assignDriver('order-1', 'dp-1', 'merchant-user-1');

    // Al elegido: oferta + asignación dirigidas a su userId.
    expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
      'user-d',
      'order:assignmentOffered',
      expect.anything(),
    );
    expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
      'user-d',
      'order:assigned',
      expect.anything(),
    );
    // A la flota: solo remoción silenciosa, sin ruido de "ya lo tomó".
    expect(mockEventsGateway.sendToRole).toHaveBeenCalledWith(
      'driver',
      'order:taken',
      expect.objectContaining({ orderId: 'order-1', silent: true }),
    );
  });
});
