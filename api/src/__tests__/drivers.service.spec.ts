import { Test, TestingModule } from '@nestjs/testing';
import { DriversService } from '../drivers/drivers.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

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
      providers: [DriversService, { provide: PrismaService, useValue: prisma }],
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
});
