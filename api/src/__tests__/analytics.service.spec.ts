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
      merchantProfile: { findUnique: jest.fn() },
      driverProfile: { findUnique: jest.fn() },
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
  });
});
