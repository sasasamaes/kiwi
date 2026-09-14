import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
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
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('7d') } },
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

  describe('login — throttle por cuenta', () => {
    const badUser = {
      id: 'user-1',
      email: 'victim@kiwi.app',
      passwordHash: '$2a$10$hashed',
      role: 'merchant',
      status: 'active',
    };

    function mockVictim() {
      prisma.user.findUnique.mockResolvedValue(badUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    }

    it('bloquea la cuenta tras 5 intentos fallidos (429), aunque roten IPs', async () => {
      mockVictim();

      for (let i = 0; i < 5; i++) {
        await expect(
          service.login({ email: 'Victim@Kiwi.app', password: 'wrong123' }),
        ).rejects.toThrow(UnauthorizedException);
      }

      // 6º intento — ya no llega a validar credenciales: 429.
      await expect(
        service.login({ email: 'victim@kiwi.app', password: 'wrong123' }),
      ).rejects.toThrow(HttpException);

      // Ni con la contraseña correcta se cede mientras esté bloqueada.
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(
        service.login({ email: 'victim@kiwi.app', password: 'goodpass123' }),
      ).rejects.toThrow(HttpException);
    });

    it('normaliza el email (mayúsculas/espacios) para contar intentos', async () => {
      mockVictim();

      for (const email of ['a@x.com', 'A@X.com', ' a@x.com ']) {
        await expect(service.login({ email, password: 'wrong123' })).rejects.toThrow(
          UnauthorizedException,
        );
      }
      // El estado compartido ya lleva 3 intentos — no fue reiniciado por variantes.
      expect(
        // 2 intentos más alcanzan el límite de 5
        (await service['loginAttempts'].get('a@x.com'))?.count,
      ).toBe(3);
    });

    it('un login exitoso limpia el contador de la cuenta', async () => {
      mockVictim();
      await expect(service.login({ email: 'v@x.com', password: 'wrong123' })).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login({ email: 'v@x.com', password: 'wrong123' })).rejects.toThrow(
        UnauthorizedException,
      );

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({ ...badUser, email: 'v@x.com' });

      const result = await service.login({ email: 'v@x.com', password: 'good12345' });
      expect(result.accessToken).toBe('mock-token');
      expect(service['loginAttempts'].has('v@x.com')).toBe(false);
    });

    it('una cuenta bloqueada no afecta a otras cuentas', async () => {
      mockVictim();
      for (let i = 0; i < 5; i++) {
        await expect(service.login({ email: 'a@x.com', password: 'wrong123' })).rejects.toThrow(
          UnauthorizedException,
        );
      }

      // otra cuenta sigue pudiendo intentar (fallo normal, 401 — no 429)
      await expect(service.login({ email: 'b@x.com', password: 'wrong123' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
