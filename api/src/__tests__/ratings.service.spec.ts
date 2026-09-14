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
});
