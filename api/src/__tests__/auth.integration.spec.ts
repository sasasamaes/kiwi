import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$10$hashedpassword'),
  compare: jest.fn(),
}));

/**
 * Integration Test: Authentication & Registration Flow
 *
 * Tests the complete auth lifecycle:
 * 1. Merchant registration → profile created → JWT issued
 * 2. Driver registration → profile created → JWT issued
 * 3. Login → JWT issued with correct role
 * 4. Duplicate email rejection
 * 5. Wrong password rejection
 * 6. Multiple role registrations
 */
describe('Auth Integration: Registration & Login Flow', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('7d') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('🟢 Happy Path: Complete Registration & Login', () => {
    it('Step 1: Register a merchant → profile created → JWT issued', async () => {
      prisma.user.findFirst.mockResolvedValue(null); // No duplicate

      const mockCreatedUser = {
        id: 'user-merchant-1',
        email: 'luis@kiwi.app',
        phone: '8888-5678',
        role: 'MERCHANT',
        status: 'active',
        createdAt: new Date(),
        merchantProfile: {
          id: 'mp-1',
          businessName: 'Bowl & Café Luis Alfredo',
          address: 'Nicoya Centro',
        },
        driverProfile: null,
      };

      prisma.user.create.mockResolvedValue(mockCreatedUser);

      const result = await service.register({
        email: 'luis@kiwi.app',
        password: 'Nicoya2026!',
        phone: '8888-5678',
        fullName: 'Luis Alfredo Chavarria',
        role: 'MERCHANT',
        businessName: 'Bowl & Café Luis Alfredo',
      });

      expect(result.user.email).toBe('luis@kiwi.app');
      expect(result.user.role).toBe('MERCHANT');
      expect(result.user.merchantProfile).toBeDefined();
      expect(result.user.merchantProfile.businessName).toBe('Bowl & Café Luis Alfredo');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(bcrypt.hash).toHaveBeenCalledWith('Nicoya2026!', 10);
    });

    it('Step 2: Register a driver → profile created → JWT issued', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const mockDriver = {
        id: 'user-driver-1',
        email: 'juan@kiwi.app',
        phone: '8888-1234',
        role: 'DRIVER',
        status: 'active',
        merchantProfile: null,
        driverProfile: {
          id: 'dp-1',
          fullName: 'Juan Carlos Rodríguez',
          vehicleType: 'motorcycle',
          status: 'available',
        },
      };

      prisma.user.create.mockResolvedValue(mockDriver);

      const result = await service.register({
        email: 'juan@kiwi.app',
        password: 'Motovida2026!',
        phone: '8888-1234',
        fullName: 'Juan Carlos Rodríguez',
        role: 'DRIVER',
        vehicleType: 'motorcycle',
      });

      expect(result.user.role).toBe('DRIVER');
      expect(result.user.driverProfile).toBeDefined();
      expect(result.user.driverProfile.vehicleType).toBe('motorcycle');
    });

    it('Step 3: Login with correct credentials → JWT with role', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-merchant-1',
        email: 'luis@kiwi.app',
        passwordHash: '$2a$10$realhash',
        role: 'MERCHANT',
        status: 'active',
        merchantProfile: { id: 'mp-1' },
        driverProfile: null,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'luis@kiwi.app',
        password: 'Nicoya2026!',
      });

      expect(result.user.email).toBe('luis@kiwi.app');
      expect(result.accessToken).toBe('mock-jwt-token');

      // JWT should contain user info
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-merchant-1',
          email: 'luis@kiwi.app',
          role: 'MERCHANT',
        }),
      );
    });

    it('Step 4: Login as driver → different role in JWT', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-driver-1',
        email: 'juan@kiwi.app',
        passwordHash: '$2a$10$realhash',
        role: 'DRIVER',
        status: 'active',
        merchantProfile: null,
        driverProfile: { id: 'dp-1' },
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'juan@kiwi.app',
        password: 'Motovida2026!',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'DRIVER',
        }),
      );
    });
  });

  describe('🔴 Error Cases', () => {
    it('Should reject duplicate email (merchant)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-user',
        email: 'luis@kiwi.app',
      });

      await expect(
        service.register({
          email: 'luis@kiwi.app',
          password: 'test',
          phone: '8888-5678',
          fullName: 'Duplicate User',
          role: 'MERCHANT',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('Should reject duplicate email (driver)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-driver',
        email: 'juan@kiwi.app',
      });

      await expect(
        service.register({
          email: 'juan@kiwi.app',
          password: 'test',
          phone: '8888-1234',
          fullName: 'Duplicate Driver',
          role: 'DRIVER',
          vehicleType: 'car',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('Should reject login with wrong email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nobody@kiwi.app',
          password: 'password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('Should reject login with wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'luis@kiwi.app',
        passwordHash: '$2a$10$correcthash',
        role: 'MERCHANT',
        status: 'active',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'luis@kiwi.app',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('Should handle multiple registrations from different users', async () => {
      const users = [
        { email: 'luis@kiwi.app', role: 'MERCHANT', name: 'Luis Alfredo' },
        { email: 'juan@kiwi.app', role: 'DRIVER', name: 'Juan Carlos' },
        { email: 'fran@kiwi.app', role: 'DRIVER', name: 'Fran Chen' },
        { email: 'maria@test.com', role: 'CUSTOMER', name: 'María' },
      ];

      for (const user of users) {
        prisma.user.findFirst.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue({
          id: `user-${user.email}`,
          email: user.email,
          role: user.role,
          merchantProfile: user.role === 'MERCHANT' ? { id: 'mp-new' } : null,
          driverProfile: user.role === 'DRIVER' ? { id: 'dp-new' } : null,
        });

        const result = await service.register({
          email: user.email,
          password: 'SecurePass123!',
          phone: '8888-0000',
          fullName: user.name,
          role: user.role,
          businessName: user.role === 'MERCHANT' ? 'Mi Negocio' : undefined,
          vehicleType: user.role === 'DRIVER' ? 'motorcycle' : undefined,
        });

        expect(result.user.email).toBe(user.email);
      }
    });
  });
});
