import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$10$hashedpassword'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
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
      sign: jest.fn().mockReturnValue('mock-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new merchant successfully', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@kiwi.app',
        phone: '8888-1234',
        role: 'merchant',
        status: 'active',
        merchantProfile: { id: 'mp-1', businessName: 'Mi Negocio' },
        driverProfile: null,
      });

      const result = await service.register({
        email: 'test@kiwi.app',
        password: 'password123',
        phone: '8888-1234',
        fullName: 'Test User',
        role: 'merchant',
        businessName: 'Mi Negocio',
      });

      expect(result.user.email).toBe('test@kiwi.app');
      expect(result.accessToken).toBe('mock-token');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-user',
        email: 'test@kiwi.app',
      });

      await expect(
        service.register({
          email: 'test@kiwi.app',
          password: 'password123',
          phone: '8888-1234',
          fullName: 'Test User',
          role: 'merchant',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register a driver successfully', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'driver-1',
        email: 'driver@kiwi.app',
        phone: '8888-5678',
        role: 'driver',
        status: 'active',
        merchantProfile: null,
        driverProfile: { id: 'dp-1', fullName: 'Test Driver', vehicleType: 'motorcycle' },
      });

      const result = await service.register({
        email: 'driver@kiwi.app',
        password: 'password123',
        phone: '8888-5678',
        fullName: 'Test Driver',
        role: 'driver',
        vehicleType: 'motorcycle',
      });

      expect(result.user.role).toBe('driver');
      expect(result.user.driverProfile).toBeDefined();
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@kiwi.app',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ12',
        role: 'merchant',
        status: 'active',
        merchantProfile: { id: 'mp-1' },
        driverProfile: null,
      });

(bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@kiwi.app',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@kiwi.app');
      expect(result.accessToken).toBe('mock-token');
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'wrong@kiwi.app',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@kiwi.app',
        passwordHash: '$2a$10$incorrecthash',
        role: 'merchant',
        status: 'active',
      });

(bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@kiwi.app',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
