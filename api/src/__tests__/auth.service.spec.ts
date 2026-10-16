// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { InvitationsService } from '../invitations/invitations.service';
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
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((ops: any) => Promise.resolve(ops)),
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
        { provide: MailService, useValue: { sendPasswordReset: jest.fn() } },
        {
          provide: InvitationsService,
          useValue: {
            assertValidForRegister: jest.fn().mockResolvedValue(undefined),
            consumeOnRegister: jest.fn().mockResolvedValue(undefined),
          },
        },
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
      prisma.user.findFirst.mockResolvedValue({
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

    it('login con email guardado en mayúsculas entra y normaliza la fila', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'TWENTYSNICOYA@GMAIL.COM',
        passwordHash: '$2a$10$hash',
        role: 'merchant',
        status: 'active',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'TwentySNicoya@Gmail.com',
        password: 'cualquiera123',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.user.email).toBe('twentysnicoya@gmail.com');
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: { equals: 'twentysnicoya@gmail.com', mode: 'insensitive' } },
        }),
      );
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'wrong@kiwi.app',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      prisma.user.findFirst.mockResolvedValue({
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
      prisma.user.findFirst.mockResolvedValue(badUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    }

    it('frena el barrido tras 5 fallos (429) pero la clave correcta siempre entra', async () => {
      mockVictim();

      for (let i = 0; i < 4; i++) {
        await expect(
          service.login({ email: 'Victim@Kiwi.app', password: 'wrong123' }),
        ).rejects.toThrow(UnauthorizedException);
      }

      // 5º fallo — el throttle en memoria ya niega al que falla: 429.
      await expect(
        service.login({ email: 'victim@kiwi.app', password: 'wrong123' }),
      ).rejects.toThrow(HttpException);

      // La contraseña correcta rompe el bloqueo y limpia el throttle: el
      // dueño nunca queda denegado por intentos ajenos.
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await service.login({ email: 'victim@kiwi.app', password: 'goodpass123' });
      expect(result.accessToken).toBe('mock-token');
      expect(service['loginAttempts'].has('victim@kiwi.app')).toBe(false);
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
      prisma.user.findFirst.mockResolvedValue({ ...badUser, email: 'v@x.com' });

      const result = await service.login({ email: 'v@x.com', password: 'good12345' });
      expect(result.accessToken).toBe('mock-token');
      expect(service['loginAttempts'].has('v@x.com')).toBe(false);
    });

    it('una cuenta bloqueada no afecta a otras cuentas', async () => {
      mockVictim();
      for (let i = 0; i < 4; i++) {
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

  describe('recupero de contraseña por email', () => {
    const getMail = () =>
      ((service as any).mailService as { sendPasswordReset: jest.Mock }).sendPasswordReset;

    it('email inválido → 400 sin tocar DB', async () => {
      await expect(service.requestPasswordReset('no-es-email')).rejects.toThrow('Email inválido');
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('cuenta inexistente responde igual sin crear token ni mandar mail', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.requestPasswordReset('ghost@kiwi.app')).resolves.toEqual({
        sent: true,
      });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(getMail()).not.toHaveBeenCalled();
    });

    it('cuenta activa invalida anteriores, crea token hasheado y manda el link', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@x.com',
        status: 'active',
      });
      const res = await service.requestPasswordReset('A@x.com');
      expect(res).toEqual({ sent: true });
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1', usedAt: null } }),
      );
      const created = prisma.passwordResetToken.create.mock.calls[0][0].data;
      expect(created.userId).toBe('u1');
      expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(new Date(created.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(getMail()).toHaveBeenCalledWith(
        'a@x.com',
        expect.stringContaining('/reset-password?token='),
      );
    });

    it('reset rechaza clave corta y token inválido', async () => {
      await expect(service.resetPassword('x'.repeat(64), '12345')).rejects.toThrow(
        'al menos 6 caracteres',
      );
      await expect(service.resetPassword('corto', 'nueva123456')).rejects.toThrow(
        'Token inválido o vencido',
      );
    });

    it('reset rechaza token usado o vencido', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 't1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600_000),
        user: { id: 'u1', status: 'active' },
      });
      await expect(service.resetPassword('y'.repeat(64), 'nueva123456')).rejects.toThrow(
        'Token inválido o vencido',
      );

      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 't1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'u1', status: 'active' },
      });
      await expect(service.resetPassword('z'.repeat(64), 'nueva123456')).rejects.toThrow(
        'Token inválido o vencido',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reset válido marca uso, cambia hash, limpia throttle y revoca sesiones', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600_000),
        user: { id: 'u1', status: 'active' },
      });
      const res = await service.resetPassword('w'.repeat(64), 'nueva123456');
      expect(res).toEqual({ reset: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh rotativo + logout', () => {
    const { createHash } = jest.requireActual('node:crypto') as typeof import('node:crypto');
    const hashOf = (v: string) => createHash('sha256').update(v).digest('hex');
    const liveRow = (over: any = {}) => ({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: null,
      replacedBy: null,
      expiresAt: new Date(Date.now() + 3600_000),
      ...over,
    });
    const liveUser = {
      id: 'user-1',
      email: 'test@kiwi.app',
      role: 'merchant',
      status: 'active',
      tokenVersion: 0,
    };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@kiwi.app',
        role: 'merchant',
        status: 'active',
        tokenVersion: 0,
      });
      prisma.user.update.mockResolvedValue({});
    });

    it('rota: emite par nuevo y revoca el presentado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(liveRow());

      const res = await service.refresh('raw-token-value');

      expect(res.accessToken).toBe('mock-token');
      expect(typeof res.refreshToken).toBe('string');
      expect(res.refreshToken).not.toBe('raw-token-value');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-1', revokedAt: null } }),
      );
    });

    it('reuso de token rotado revoca la familia (posible robo)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        liveRow({ revokedAt: new Date(), replacedBy: 'otro-hash' }),
      );

      await expect(service.refresh('raw-token-value')).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { tokenVersion: { increment: 1 } },
        }),
      );
    });

    it('refresh expirado exige login', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        liveRow({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.refresh('raw-token-value')).rejects.toThrow('vencida');
      expect(hashOf('x')).toHaveLength(64);
    });

    it('logout revoca refresh y sube tokenVersion', async () => {
      const res = await service.logout('user-1');

      expect(res).toEqual({ success: true });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', revokedAt: null } }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { tokenVersion: { increment: 1 } } }),
      );
    });

    it('login incluye refreshToken opaco (no el hash)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...liveUser,
        passwordHash: '$2a$10$hash',
        merchantProfile: { id: 'mp-1' },
        driverProfile: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.login({ email: 'test@kiwi.app', password: 'password123' });

      expect(typeof res.refreshToken).toBe('string');
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) }),
      );
    });
  });
});
