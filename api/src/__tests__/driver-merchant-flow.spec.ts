// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
// Regression tests for the merchant <-> driver order lifecycle:
// 1. Drivers must see scheduled orders (driver_proposals) via ?scheduled=true.
// 2. A no_driver order must be retryable (pending) or cancellable by merchant.
jest.mock('@nestjs/websockets', () => ({}), { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });

const mockEventsGateway = {
  sendToRole: jest.fn(),
  sendToUser: jest.fn(),
};

jest.mock('../events/events.gateway', () => ({
  EventsGateway: jest.fn().mockImplementation(() => mockEventsGateway),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { ProximityService } from '../orders/proximity.service';
import { ImageUploadService } from '../menu/image-upload.service';

describe('Driver/merchant lifecycle regressions', () => {
  let service: OrdersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
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
        {
          provide: NotificationsService,
          useValue: {
            notifyNewOrderTopic: jest.fn().mockResolvedValue({ delivered: 0, inbox: 0 }),
            notifyDriverNewOrderTargeted: jest.fn().mockResolvedValue({ delivered: true }),
            notifyScheduledOrderTopic: jest.fn().mockResolvedValue({ delivered: 0, inbox: 0 }),
            notifyDriverScheduledOrderTargeted: jest.fn().mockResolvedValue({ delivered: true }),
            notifyOrderAccepted: jest.fn().mockResolvedValue({}),
            notifyOrderStatusUpdate: jest.fn().mockResolvedValue({}),
            notifyOrderRejected: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getDriverCommissionPct: jest.fn().mockResolvedValue(15),
            getAssignmentTimeouts: jest
              .fn()
              .mockResolvedValue({ acceptanceMinutes: 5, contestMinutes: 10 }),
          },
        },
        { provide: ImageUploadService, useValue: { uploadProofImage: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('scheduled=true lista pedidos programados (driver_proposals), no inmediatos', async () => {
    prisma.order.findMany.mockResolvedValue([
      { id: 'sched-1', status: 'driver_proposals', orderType: 'scheduled' },
    ]);

    const result: any[] = await (service as any).getAvailableOrders(undefined, undefined, {
      scheduled: true,
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'driver_proposals' }),
      }),
    );
    expect(result.map((o) => o.id)).toEqual(['sched-1']);
  });

  it('sin flag scheduled sigue listando solo pending (comportamiento actual)', async () => {
    prisma.order.findMany.mockResolvedValue([{ id: 'imm-1', status: 'pending' }]);

    const result: any[] = await service.getAvailableOrders();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'pending' }) }),
    );
    expect(result.map((o) => o.id)).toEqual(['imm-1']);
  });

  it('comercio puede reintentar no_driver → pending', async () => {
    const nodriver = {
      id: 'order-1',
      status: 'no_driver',
      merchant: { userId: 'merchant-user-1' },
      driver: null,
    };
    prisma.order.findUnique
      .mockResolvedValueOnce(nodriver)
      .mockResolvedValue({ ...nodriver, status: 'pending' });

    const updated: any = await service.updateStatus(
      'order-1',
      'pending',
      'merchant-user-1',
      'merchant',
    );
    expect(updated.status).toBe('pending');
  });

  it('comercio puede cancelar no_driver → cancelled', async () => {
    const nodriver = {
      id: 'order-1',
      status: 'no_driver',
      merchant: { userId: 'merchant-user-1' },
      driver: null,
    };
    prisma.order.findUnique
      .mockResolvedValueOnce(nodriver)
      .mockResolvedValue({ ...nodriver, status: 'cancelled' });

    const updated: any = await service.updateStatus(
      'order-1',
      'cancelled',
      'merchant-user-1',
      'merchant',
    );
    expect(updated.status).toBe('cancelled');
  });

  it('findByDriver expone el teléfono del comercio al repartidor asignado', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-1', userId: 'user-d' });
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'order-1',
        status: 'assigned',
        merchant: { businessName: 'Soda Nicoya', user: { phone: '8888-1111' } },
      },
    ]);

    const result: any[] = await service.findByDriver('user-d');

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          merchant: expect.objectContaining({
            select: expect.objectContaining({ user: expect.anything() }),
          }),
        }),
      }),
    );
    expect(result[0].merchant?.user?.phone).toBe('8888-1111');
  });

  it('getAvailableOrders NO expone teléfono del comercio a la flota', async () => {
    prisma.order.findMany.mockResolvedValue([
      { id: 'imm-1', status: 'pending', merchant: { businessName: 'Soda' } },
    ]);

    const result: any[] = await service.getAvailableOrders();

    expect(result[0].merchant?.user).toBeUndefined();
  });

  it('uploadProofPhoto pickup se congela una vez recogido el pedido', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'picked_up',
      pickupProofPhotoUrl: 'https://img/old.jpg',
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });

    await expect(
      (service as any).uploadProofPhoto(
        'order-1',
        'pickup',
        'https://img/new.jpg',
        'merchant-user-1',
      ),
    ).rejects.toThrow('ya fue recogido');
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('uploadProofPhoto delivery se congela una vez entregado el pedido', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'delivered',
      deliveryProofPhotoUrl: 'https://img/old.jpg',
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });

    await expect(
      (service as any).uploadProofPhoto('order-1', 'delivery', 'https://img/new.jpg', 'user-d'),
    ).rejects.toThrow('ya fue entregado');
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('crear pedido programado alerta a la flota con order:scheduledNew (no order:new)', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({
      id: 'merchant-1',
      userId: 'merchant-user-1',
      businessName: 'Soda Nicoya',
    });
    prisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'sched-order-1',
      createdAt: new Date(),
      ...data,
    }));

    const order: any = await service.create('merchant-user-1', {
      orderType: 'scheduled',
      scheduledDate: '2026-12-01',
      scheduledTime: '18:00',
      pickupAddress: 'Parque Nicoya',
      deliveryAddress: 'Barrio San Martín',
      distanceKm: 2,
    });

    expect(order.status).toBe('driver_proposals');
    const calls = mockEventsGateway.sendToRole.mock.calls.map((c: any[]) => c.slice(0, 2));
    expect(calls).toContainEqual(['driver', 'order:scheduledNew']);
    expect(calls).not.toContainEqual(['driver', 'order:new']);
  });
});
