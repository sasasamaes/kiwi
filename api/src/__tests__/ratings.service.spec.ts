// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RatingsService } from '../ratings/ratings.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

describe('RatingsService', () => {
  let service: RatingsService;
  let prisma: {
    order: { findUnique: jest.Mock };
    rating: { findFirst: jest.Mock; create: jest.Mock; aggregate: jest.Mock };
    driverProfile: { update: jest.Mock };
  };
  let events: { sendToUser: jest.Mock };

  const merchantUser = { id: 'user-merchant' };
  const driverUser = { id: 'user-driver' };

  const buildOrder = (overrides: Record<string, any> = {}) => ({
    id: 'order-1',
    status: 'delivered',
    // Prisma include: DriverProfile.userId ES el id del User (FK); igual para merchant
    driver: { id: 'driver-1', userId: 'user-driver', user: driverUser },
    merchant: { id: 'merchant-1', userId: 'user-merchant', user: merchantUser },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn() },
      rating: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        aggregate: jest.fn(),
      },
      driverProfile: { update: jest.fn().mockResolvedValue({}) },
    };
    events = { sendToUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: events },
        {
          provide: NotificationsService,
          useValue: { notifyNewRating: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get(RatingsService);
  });

  it('creates a rating, recalculates driver average and notifies the driver', async () => {
    prisma.order.findUnique.mockResolvedValue(buildOrder());
    prisma.rating.create.mockResolvedValue({ id: 'rating-1', rating: 5, comment: null });
    prisma.rating.aggregate.mockResolvedValue({ _avg: { rating: 4.3333333 } });

    const result = await service.create('user-merchant', {
      orderId: 'order-1',
      rating: 5,
      onTime: true,
      carefulWithOrder: true,
    });

    expect(result.rating).toBe(5);
    expect(prisma.rating.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        driverId: 'driver-1',
        merchantId: 'merchant-1',
        rating: 5,
      }),
    });
    // promedio redondeado a 2 decimales
    expect(prisma.driverProfile.update).toHaveBeenCalledWith({
      where: { id: 'driver-1' },
      data: { rating: 4.33 },
    });
    expect(events.sendToUser).toHaveBeenCalledWith('user-driver', 'rating:new', expect.any(Object));
  });

  it('rejects a merchant that does not own the order', async () => {
    prisma.order.findUnique.mockResolvedValue(buildOrder());

    await expect(service.create('user-otro', { orderId: 'order-1', rating: 5 })).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.rating.create).not.toHaveBeenCalled();
  });

  it('rejects rating a non-delivered order', async () => {
    prisma.order.findUnique.mockResolvedValue(buildOrder({ status: 'in_transit_to_delivery' }));

    await expect(
      service.create('user-merchant', { orderId: 'order-1', rating: 5 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a second rating for the same order', async () => {
    prisma.order.findUnique.mockResolvedValue(buildOrder());
    prisma.rating.findFirst.mockResolvedValue({ id: 'rating-viejo' });

    await expect(
      service.create('user-merchant', { orderId: 'order-1', rating: 5 }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when order does not exist', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(service.create('user-merchant', { orderId: 'nope', rating: 5 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects delivered orders without a driver', async () => {
    prisma.order.findUnique.mockResolvedValue(buildOrder({ driver: null }));

    await expect(
      service.create('user-merchant', { orderId: 'order-1', rating: 5 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('findByOrder lets the driver see the rating but not rate', async () => {
    prisma.order.findUnique.mockResolvedValue(buildOrder());
    prisma.rating.findFirst.mockResolvedValue({ id: 'rating-1', rating: 4 });

    const result = await service.findByOrder('order-1', 'user-driver');

    expect(result.rating).toMatchObject({ id: 'rating-1' });
    expect(result.canRate).toBe(false);
  });

  it('findByOrder flags canRate for the owning merchant of a delivered unrated order', async () => {
    prisma.order.findUnique.mockResolvedValue(buildOrder());

    const result = await service.findByOrder('order-1', 'user-merchant');

    expect(result.rating).toBeNull();
    expect(result.canRate).toBe(true);
  });

  it('findByOrder blocks strangers', async () => {
    prisma.order.findUnique.mockResolvedValue(buildOrder());

    await expect(service.findByOrder('order-1', 'user-desconocido')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('listForAdmin returns paginated ratings with summary', async () => {
    (prisma.rating as any).count = jest.fn().mockResolvedValue(2);
    (prisma.rating as any).findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'r1', rating: 5, comment: 'Excelente', createdAt: new Date() }]);
    prisma.rating.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 2 } });

    const result = await service.listForAdmin({ take: 20, onlyWithComment: true });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.summary.average).toBe(4.5);
    expect((prisma.rating as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ comment: { not: null } }) }),
    );
  });

  it('listForAdmin filters by maxRating', async () => {
    (prisma.rating as any).count = jest.fn().mockResolvedValue(1);
    (prisma.rating as any).findMany = jest.fn().mockResolvedValue([]);
    prisma.rating.aggregate.mockResolvedValue({ _avg: { rating: 2 }, _count: { rating: 1 } });

    await service.listForAdmin({ maxRating: 3 });

    expect((prisma.rating as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ rating: { lte: 3 } }) }),
    );
  });

  it('findByOrderPublic devuelve datos mínimos + canRate sin login', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'delivered',
      driverId: 'driver-1',
      merchant: { businessName: 'Soda' },
      driver: { id: 'driver-1', fullName: 'Juan', rating: 4.5, vehicleType: 'motorcycle' },
    });
    prisma.rating.findFirst.mockResolvedValue(null);

    const res = await service.findByOrderPublic('order-1');

    expect(res.order).toMatchObject({ id: 'order-1', status: 'delivered' });
    expect(res.order.driver).toMatchObject({ fullName: 'Juan' });
    expect(res.order).not.toHaveProperty('pickupLat');
    expect(res.canRate).toBe(true);
  });

  it('findByOrderPublic 404 si no existe', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(service.findByOrderPublic('nope')).rejects.toThrow(NotFoundException);
  });

  it('createPublic califica sin dueño pero con todos los guards', async () => {
    prisma.order.findUnique.mockResolvedValue(buildOrder());
    prisma.rating.create.mockResolvedValue({ id: 'rating-1', rating: 5, comment: null });
    prisma.rating.aggregate.mockResolvedValue({ _avg: { rating: 5 } });

    const res = await service.createPublic({ orderId: 'order-1', rating: 5 });
    expect(res.rating).toBe(5);
    expect(events.sendToUser).toHaveBeenCalledWith('user-driver', 'rating:new', expect.any(Object));
  });

  it('createPublic rechaza no-entregado, sin driver y duplicado', async () => {
    prisma.order.findUnique.mockResolvedValue(buildOrder({ status: 'picked_up' }));
    await expect(service.createPublic({ orderId: 'order-1', rating: 5 })).rejects.toThrow(
      BadRequestException,
    );

    prisma.order.findUnique.mockResolvedValue(buildOrder({ driver: null, driverId: null }));
    await expect(service.createPublic({ orderId: 'order-1', rating: 5 })).rejects.toThrow(
      BadRequestException,
    );

    prisma.order.findUnique.mockResolvedValue(buildOrder());
    prisma.rating.findFirst.mockResolvedValue({ id: 'rating-viejo' });
    await expect(service.createPublic({ orderId: 'order-1', rating: 5 })).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.rating.create).not.toHaveBeenCalled();
  });
});
