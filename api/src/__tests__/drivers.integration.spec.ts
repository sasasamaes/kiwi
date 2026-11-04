// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { DriversService } from '../drivers/drivers.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags';
import { SettingsService } from '../settings/settings.service';
import { NotFoundException } from '@nestjs/common';

/**
 * Integration Test: Driver Profile, Earnings & Schedules
 *
 * Tests the complete driver lifecycle:
 * 1. Driver profile lookup
 * 2. Status toggle (online/offline)
 * 3. Earnings calculation
 * 4. Schedule CRUD
 * 5. Error handling
 */
describe('Drivers Integration: Profile, Earnings & Schedules', () => {
  let service: DriversService;
  let prisma: any;

  const DRIVER_USER_ID = 'user-driver-1';
  const DRIVER_PROFILE_ID = 'dp-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      driverProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      order: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      driverSchedule: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      withdrawal: {
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: PrismaService, useValue: prisma },
        { provide: FeatureFlagsService, useValue: { kycRequired: false } },
        {
          provide: SettingsService,
          useValue: { getTestDriverEmails: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    service = module.get<DriversService>(DriversService);
  });

  describe('🟢 Happy Path: Complete Driver Experience', () => {
    it('Step 1: Load driver profile with stats', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
        fullName: 'Juan Carlos Rodríguez',
        phone: '8888-1234',
        vehicleType: 'motorcycle',
        vehiclePlate: 'CR-1234',
        rating: 4.8,
        totalTrips: 156,
        totalEarnings: 156000,
        status: 'available',
        latitude: 10.0,
        longitude: -85.0,
        isOnline: true,
        schedules: [
          { dayOfWeek: 1, startTime: '08:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 2, startTime: '08:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 3, startTime: '08:00', endTime: '17:00', isActive: true },
        ],
        incentives: [],
        _count: { orders: 156 },
      });

      const result = await service.findByUserId(DRIVER_USER_ID);

      expect(result.fullName).toBe('Juan Carlos Rodríguez');
      expect(result.vehicleType).toBe('motorcycle');
      expect(result.rating).toBe(4.8);
      expect(result.totalTrips).toBe(156);
      expect(result.schedules).toHaveLength(3);
    });

    it('Step 2: Toggle driver online/offline', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
      });

      prisma.driverProfile.update.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        status: 'offline',
        isOnline: false,
      });

      const result = await service.updateStatus(DRIVER_USER_ID, 'offline');
      expect(result.status).toBe('offline');

      // Go back online
      prisma.driverProfile.update.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        status: 'available',
        isOnline: true,
      });

      const result2 = await service.updateStatus(DRIVER_USER_ID, 'available');
      expect(result2.status).toBe('available');
    });

    it('Step 3: Calculate earnings for a specific period', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
      });

      const now = new Date();
      const deliveredOrders = Array.from({ length: 5 }, (_, i) => ({
        id: `order-${i + 1}`,
        driverPayout: 1500 + i * 200,
        status: 'delivered',
        pickupAddress: 'Bowl & Café',
        deliveryAddress: `Barrio ${i}`,
        deliveredAt: new Date(now.getTime() - i * 3600000),
        createdAt: new Date(now.getTime() - i * 3600000 - 1800000),
        orderType: 'immediate',
      }));

      prisma.order.findMany.mockResolvedValue(deliveredOrders);

      const result = await service.getEarnings(DRIVER_USER_ID, 'all');

      // Actual return shape from the service
      expect(result.period).toBe('all');
      expect(result.totalEarnings).toBe(deliveredOrders.reduce((s, o) => s + o.driverPayout, 0));
      expect(result.totalTrips).toBe(5);
      expect(result.averagePerTrip).toBeGreaterThan(0);
      expect(result.earningsPerHour).toBeGreaterThan(0);
      expect(result.daily).toBeInstanceOf(Array);
      expect(result.transactions).toHaveLength(5);
      expect(result.summary).toBeDefined();
      expect(result.summary.allTime).toBe(result.totalEarnings);
    });

    it('Step 4: CRUD schedules for working hours', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
      });

      // Delete existing schedules
      prisma.driverSchedule.deleteMany.mockResolvedValue({ count: 0 });

      // Create new schedules
      prisma.driverSchedule.createMany.mockResolvedValue({ count: 5 });
      (prisma as any).$transaction = jest.fn(async (cb: any) =>
        cb({ driverSchedule: prisma.driverSchedule }),
      );

      const schedules = [
        { dayOfWeek: 1, startTime: '2026-09-07T07:00:00', endTime: '2026-09-07T18:00:00' },
        { dayOfWeek: 2, startTime: '2026-09-08T07:00:00', endTime: '2026-09-08T18:00:00' },
        { dayOfWeek: 3, startTime: '2026-09-09T07:00:00', endTime: '2026-09-09T18:00:00' },
        { dayOfWeek: 4, startTime: '2026-09-10T07:00:00', endTime: '2026-09-10T18:00:00' },
        { dayOfWeek: 5, startTime: '2026-09-11T07:00:00', endTime: '2026-09-11T18:00:00' },
      ];

      await service.updateSchedule(DRIVER_USER_ID, schedules);

      expect(prisma.driverSchedule.deleteMany).toHaveBeenCalledWith({
        where: { driverId: DRIVER_PROFILE_ID },
      });

      // The service converts startTime/endTime to Date objects and uses isAvailable
      const createManyCall = prisma.driverSchedule.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(5);
      createManyCall.data.forEach((entry: any, i: number) => {
        expect(entry.driverId).toBe(DRIVER_PROFILE_ID);
        expect(entry.dayOfWeek).toBe(schedules[i].dayOfWeek);
        expect(entry.startTime).toBeInstanceOf(Date);
        expect(entry.endTime).toBeInstanceOf(Date);
        expect(entry.isAvailable).toBe(true);
      });
    });

    it('Step 5: Find available drivers for a location', async () => {
      prisma.driverProfile.findMany.mockResolvedValue([
        {
          id: DRIVER_PROFILE_ID,
          fullName: 'Juan Carlos',
          status: 'available',
          rating: 4.8,
          latitude: 10.0,
          longitude: -85.0,
          vehicleType: 'motorcycle',
        },
        {
          id: 'dp-2',
          fullName: 'Fran Chen',
          status: 'available',
          rating: 4.9,
          latitude: 10.005,
          longitude: -84.995,
          vehicleType: 'car',
        },
      ]);

      const result = await service.getAvailableDrivers(10.0, -85.0);
      expect(result).toHaveLength(2);
    });
  });

  describe('🔴 Error Cases', () => {
    it('Should reject if driver profile not found', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue(null);

      await expect(service.findByUserId('non-existent-user')).rejects.toThrow(
        'Perfil de repartidor no encontrado',
      );
    });

    it('Should reject updating status for non-existent driver', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus('non-existent', 'available')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Should handle empty schedules gracefully', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
        schedules: [],
      });

      const result = await service.findByUserId(DRIVER_USER_ID);
      expect(result.schedules).toHaveLength(0);
    });

    it('Should handle driver with no orders (new driver)', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
      });

      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.getEarnings(DRIVER_USER_ID, 'all');
      expect(result.totalEarnings).toBe(0);
      expect(result.totalTrips).toBe(0);
      expect(result.averagePerTrip).toBe(0);
      expect(result.earningsPerHour).toBe(0);
      expect(result.transactions).toHaveLength(0);
    });

    it('Should handle earnings for different periods', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
      });

      prisma.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          driverPayout: 1500,
          status: 'delivered',
          deliveredAt: new Date(),
          createdAt: new Date(),
          pickupAddress: 'A',
          deliveryAddress: 'B',
          orderType: 'immediate',
        },
      ]);

      for (const period of ['today', 'week', 'month', 'all']) {
        const result = await service.getEarnings(DRIVER_USER_ID, period);
        expect(result.period).toBe(period);
        expect(result.totalEarnings).toBe(1500);
      }
    });
    it('Should support yesterday and custom ranges (CR wall)', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
      });
      prisma.order.findMany.mockResolvedValue([]);

      await service.getEarnings(DRIVER_USER_ID, 'yesterday');
      const yWhere = prisma.order.findMany.mock.calls[0][0].where;
      expect(yWhere.deliveredAt.gte).toBeInstanceOf(Date);
      expect(yWhere.deliveredAt.lt).toBeInstanceOf(Date);
      expect(yWhere.deliveredAt.lt.getTime() - yWhere.deliveredAt.gte.getTime()).toBe(
        24 * 60 * 60 * 1000,
      );

      await service.getEarnings(DRIVER_USER_ID, 'custom', '2026-01-05', '2026-01-11');
      const cWhere = prisma.order.findMany.mock.calls[1][0].where;
      expect(cWhere.deliveredAt.gte).toEqual(new Date(Date.UTC(2026, 0, 5, 6)));
      expect(cWhere.deliveredAt.lt).toEqual(new Date(Date.UTC(2026, 0, 12, 6)));

      await expect(
        service.getEarnings(DRIVER_USER_ID, 'custom', '2026-01-11', '2026-01-05'),
      ).rejects.toThrow();
      await expect(service.getEarnings(DRIVER_USER_ID, 'custom')).rejects.toThrow();
    });
  });
});
