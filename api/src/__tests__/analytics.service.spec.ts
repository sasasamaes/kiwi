// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: { count: jest.fn().mockResolvedValue(0) },
      merchantProfile: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      driverProfile: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      order: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderItem: { groupBy: jest.fn().mockResolvedValue([]) },
      payment: { groupBy: jest.fn().mockResolvedValue([]) },
      rating: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('getMerchantAnalytics', () => {
    it('resuelve el perfil y no revienta con DB vacía (regresión del 500)', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'mp-1', userId: 'user-1' });

      const result = await service.getMerchantAnalytics('user-1', { period: 'week' } as any);

      expect(prisma.merchantProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(prisma.order.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ merchantId: 'mp-1' }) }),
      );
      expect(result.overview.totalOrders).toBe(0);
      expect(result.overview.totalRevenue).toBe(0);
    });

    it('404 si el usuario no tiene perfil de comercio', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.getMerchantAnalytics('user-9', { period: 'week' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDriverAnalytics', () => {
    it('404 si el usuario no tiene perfil de repartidor', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue(null);

      await expect(service.getDriverAnalytics('user-9', { period: 'week' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('breakdown real (sin propinas/bonos ficticios) y día más activo real', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-1', userId: 'user-1' });
      prisma.order.count.mockResolvedValue(0);
      prisma.order.aggregate.mockResolvedValue({});
      prisma.order.findMany.mockResolvedValue([]);
      prisma.rating.findMany.mockResolvedValue([]);
      prisma.driverSchedule = {
        findMany: jest.fn().mockResolvedValue([
          {
            dayOfWeek: 1,
            startTime: new Date('2026-01-05T07:00:00'),
            endTime: new Date('2026-01-05T15:00:00'),
            isAvailable: true,
          },
          {
            dayOfWeek: 6,
            startTime: new Date('2026-01-10T08:00:00'),
            endTime: new Date('2026-01-10T20:00:00'),
            isAvailable: true,
          },
        ]),
      };

      const result = await service.getDriverAnalytics('user-1', { period: 'week' } as any);

      expect(result.earnings.breakdown).toEqual([{ type: 'delivery_fee', amount: 0 }]);
      expect(result.schedule.mostActiveDay).toBe('Sábado');
      expect(result.schedule).not.toHaveProperty('utilizationRate');
    });
  });

  describe('getPlatformAnalytics', () => {
    it('growth de comercios y repartidores con conteos reales', async () => {
      const result = await service.getPlatformAnalytics({ period: 'week' } as any);

      expect(prisma.merchantProfile.count).toHaveBeenCalled();
      expect(prisma.driverProfile.count).toHaveBeenCalled();
      expect(result.growth.merchantGrowth).toBe(0);
      expect(result.growth.driverGrowth).toBe(0);
    });
  });
});
