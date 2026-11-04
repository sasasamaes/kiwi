// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { DriversService } from '../drivers/drivers.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags';
import { SettingsService } from '../settings/settings.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('DriversService', () => {
  let service: DriversService;
  let prisma: any;

  beforeEach(async () => {
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
        findFirst: jest.fn(),
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

  describe('findByUserId', () => {
    it('should return driver profile with schedules', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: 'dp-1',
        userId: 'user-1',
        fullName: 'Juan Carlos',
        vehicleType: 'motorcycle',
        rating: 4.8,
        totalTrips: 150,
        status: 'available',
        schedules: [],
        incentives: [],
        _count: { orders: 150 },
      });

      const result = await service.findByUserId('user-1');
      expect(result.fullName).toBe('Juan Carlos');
      expect(result.totalTrips).toBe(150);
    });

    it('should throw NotFoundException if driver not found', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue(null);

      await expect(service.findByUserId('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update driver status to available', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: 'dp-1',
        userId: 'user-1',
      });
      prisma.driverProfile.update.mockResolvedValue({
        id: 'dp-1',
        status: 'available',
      });

      const result = await service.updateStatus('user-1', 'available');
      expect(result.status).toBe('available');
    });

    it('rechaza ponerse en línea sin KYC aprobado cuando el flag lo exige', async () => {
      process.env.KYC_REQUIRED = 'true';
      try {
        prisma.driverProfile.findUnique.mockResolvedValue({
          id: 'dp-1',
          userId: 'user-1',
          kycStatus: 'pending',
        });

        await expect(service.updateStatus('user-1', 'available')).rejects.toThrow(
          'verificación de identidad',
        );
        expect(prisma.driverProfile.update).not.toHaveBeenCalled();

        // Apagarse sí se puede.
        prisma.driverProfile.update.mockResolvedValue({ id: 'dp-1', status: 'offline' });
        const off = await service.updateStatus('user-1', 'offline');
        expect(off.status).toBe('offline');
      } finally {
        delete process.env.KYC_REQUIRED;
      }
    });

    it('permite en línea con KYC aprobado aunque el flag lo exija', async () => {
      process.env.KYC_REQUIRED = 'true';
      try {
        prisma.driverProfile.findUnique.mockResolvedValue({
          id: 'dp-1',
          userId: 'user-1',
          kycStatus: 'approved',
        });
        prisma.driverProfile.update.mockResolvedValue({ id: 'dp-1', status: 'available' });

        const result = await service.updateStatus('user-1', 'available');
        expect(result.status).toBe('available');
      } finally {
        delete process.env.KYC_REQUIRED;
      }
    });

    it('conectarse fuera de horario da 2 h de gracia; dentro de horario la limpia', async () => {
      // Sin bloques hoy: fuera de horario → gracia.
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: 'dp-1',
        userId: 'user-1',
        kycStatus: 'approved',
        schedules: [],
      });
      prisma.driverProfile.update.mockResolvedValue({ id: 'dp-1', status: 'available' });
      await service.updateStatus('user-1', 'available');
      const data = prisma.driverProfile.update.mock.calls[0][0].data;
      expect(data.status).toBe('available');
      expect(new Date(data.manualOnlineUntil).getTime()).toBeGreaterThan(Date.now());

      // Bloque que cubre ahora: sin gracia.
      const now = new Date();
      const cr = new Date(now.getTime() - 6 * 3600 * 1000);
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: 'dp-1',
        userId: 'user-1',
        kycStatus: 'approved',
        schedules: [
          {
            dayOfWeek: cr.getUTCDay(),
            startTime: new Date(now.getTime() - 3600 * 1000).toISOString(),
            endTime: new Date(now.getTime() + 3600 * 1000).toISOString(),
          },
        ],
      });
      await service.updateStatus('user-1', 'available');
      expect(prisma.driverProfile.update.mock.calls[1][0].data).toEqual({
        status: 'available',
        manualOnlineUntil: null,
      });

      // Apagarse siempre limpia la gracia.
      await service.updateStatus('user-1', 'offline');
      expect(prisma.driverProfile.update.mock.calls[2][0].data).toEqual({
        status: 'offline',
        manualOnlineUntil: null,
      });
    });
  });

  describe('getAvailableDrivers', () => {
    it('should return available drivers', async () => {
      prisma.driverProfile.findMany.mockResolvedValue([
        { id: 'dp-1', fullName: 'Juan Carlos', status: 'available', rating: 4.8 },
        { id: 'dp-2', fullName: 'Fran', status: 'available', rating: 4.9 },
      ]);

      const result = await service.getAvailableDrivers(10.0, -85.0);
      expect(result).toHaveLength(2);
    });

    it('should return the FULL directory: offline and pending-KYC drivers included', async () => {
      // A merchant must see the driver they just recruited even if he has
      // never connected. The service must not filter by status or KYC.
      prisma.driverProfile.findMany.mockResolvedValue([
        { id: 'dp-1', fullName: 'Juan', status: 'available' },
        { id: 'dp-2', fullName: 'Nuevo', status: 'offline' },
        { id: 'dp-3', fullName: 'Ocupado', status: 'busy' },
      ]);

      const result = await service.getAvailableDrivers();
      expect(result).toHaveLength(3);
      // No status/kyc filter in the where clause.
      const arg = prisma.driverProfile.findMany.mock.calls[0][0];
      expect(arg.where).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should return driver by id with user info', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: 'dp-1',
        fullName: 'Juan Carlos',
        user: { id: 'user-1', email: 'juan@kiwi.app', phone: '8888-1234', role: 'driver' },
        schedules: [],
        incentives: [],
        _count: { orders: 150, ratings: 12 },
      });

      const result = await service.findById('dp-1');
      expect(result.fullName).toBe('Juan Carlos');
      expect(result.user.email).toBe('juan@kiwi.app');
    });

    it('should throw NotFoundException if driver not found', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLiveDrivers', () => {
    it('devuelve ficha del repartidor para el popup del mapa (foto, placa, rating)', async () => {
      prisma.driverProfile.findMany.mockResolvedValue([
        {
          id: 'dp-1',
          fullName: 'Francisco Campos Diaz',
          photoUrl: null,
          vehicleType: 'motorized_bike',
          vehiclePlate: 'M-123',
          rating: 5.0,
          totalTrips: 10,
          status: 'available',
          lastLat: 10.1467,
          lastLng: -85.452,
          lastSeenAt: new Date(),
        },
      ]);

      const result = await service.getLiveDrivers();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Francisco Campos Diaz',
        vehicle: 'motorized_bike',
        vehiclePlate: 'M-123',
        rating: 5,
        totalTrips: 10,
      });
    });

    it('filtra filas sin coords válidas', async () => {
      prisma.driverProfile.findMany.mockResolvedValue([
        { id: 'dp-x', fullName: 'Sin GPS', lastLat: null, lastLng: null, rating: 5 },
      ]);

      await expect(service.getLiveDrivers()).resolves.toHaveLength(0);
    });
  });

  describe('getLocationForUser (row-level GPS guard)', () => {
    it('permite al propio repartidor ver su ubicación', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-1' });

      await expect(
        service.getLocationForUser('dp-1', { sub: 'u-1', role: 'driver' }),
      ).resolves.toMatchObject({ driverId: 'dp-1' });
    });

    it('permite al comercio con pedido activo de ese repartidor', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-otro' });
      prisma.order.findFirst.mockResolvedValue({ id: 'o-1' });

      await expect(
        service.getLocationForUser('dp-1', { sub: 'u-merch', role: 'merchant' }),
      ).resolves.toMatchObject({ known: expect.any(Boolean) });
    });

    it('bloquea a un usuario autenticado sin relación con el repartidor', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-otro' });
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.getLocationForUser('dp-1', { sub: 'u-raro', role: 'merchant' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('admin siempre puede', async () => {
      await expect(
        service.getLocationForUser('dp-1', { sub: 'u-admin', role: 'admin' }),
      ).resolves.toMatchObject({ driverId: 'dp-1' });
    });
  });

  describe('driverOrders', () => {
    it('devuelve el historial con total y mapea montos', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-1' });
      prisma.order.count.mockResolvedValue(3);
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'o1',
          status: 'delivered',
          orderType: 'immediate',
          merchant: { businessName: 'Soda' },
          pickupAddress: 'A',
          deliveryAddress: 'B',
          driverPayout: 1275,
          totalAmount: 1500,
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
      ]);
      const res = await service.driverOrders('u-1', { status: 'delivered', take: 20 });
      expect(res.total).toBe(3);
      expect(res.items[0]).toMatchObject({ id: 'o1', merchantName: 'Soda', driverPayout: 1275 });
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { driverId: 'dp-1', status: 'delivered' },
          take: 20,
          skip: 0,
        }),
      );
    });

    it('sin perfil lanza 404 y con estado inválido lanza 400', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue(null);
      await expect(service.driverOrders('u-x', {})).rejects.toThrow(NotFoundException);
      prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-1' });
      await expect(service.driverOrders('u-1', { status: 'volando' })).rejects.toThrow(
        'Estado inválido',
      );
    });

    it('adminList devuelve id y nombre ordenados', async () => {
      prisma.driverProfile.findMany.mockResolvedValue([{ id: 'dp-1', fullName: 'Luis Espinoza' }]);
      const res = await service.adminList();
      expect(res).toEqual([{ id: 'dp-1', fullName: 'Luis Espinoza' }]);
      expect(prisma.driverProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { fullName: 'asc' } }),
      );
    });
  });

  describe('getEarnings', () => {
    beforeEach(() => {
      prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-1', userId: 'u-1' });
      prisma.order.findMany.mockResolvedValue([]);
    });

    it('yesterday filtra el día tico completo (gte ayer 00:00, lt hoy 00:00)', async () => {
      await service.getEarnings('u-1', 'yesterday');
      const where = prisma.order.findMany.mock.calls[0][0].where;
      const { gte, lt } = where.deliveredAt;
      // Ventana exacta de 24h y el tope es medianoche CR (= 06:00 UTC).
      expect(lt.getTime() - gte.getTime()).toBe(24 * 3600 * 1000);
      expect(lt.getUTCHours()).toBe(6);
    });

    it('custom usa from/to inclusivos en muro CR', async () => {
      await service.getEarnings('u-1', 'custom', '2026-11-02', '2026-11-03');
      const where = prisma.order.findMany.mock.calls[0][0].where;
      expect(where.deliveredAt).toEqual({
        gte: new Date(Date.UTC(2026, 10, 2, 6)),
        lt: new Date(Date.UTC(2026, 10, 4, 6)),
      });
    });

    it('custom sin to rechaza (rango completo obligatorio)', async () => {
      await expect(service.getEarnings('u-1', 'custom', '2026-11-02')).rejects.toThrow(
        'Rango de fechas inválido',
      );
    });
  });
});
