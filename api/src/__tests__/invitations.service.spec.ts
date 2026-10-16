// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { createHash } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InvitationsService } from '../invitations/invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

const hashOf = (raw: string) => createHash('sha256').update(raw).digest('hex');
const rawFromUrl = (url: string) => new URL(url).searchParams.get('invitation') ?? '';

/**
 * Invitaciones de venta en campo: crear (comercio/repartidor), reenviar con
 * link nuevo, revocar, validar el token público y marcar aceptada al
 * registrarse. El token crudo jamás se persiste (solo su hash).
 */
describe('InvitationsService', () => {
  let service: InvitationsService;
  let prisma: any;
  let mail: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      invitation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    mail = { sendInvitation: jest.fn().mockResolvedValue(true) };
    const whatsapp = {
      sendText: jest.fn().mockResolvedValue(true),
      sendTemplate: jest.fn().mockResolvedValue(true),
      templateFor: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: WhatsappService, useValue: whatsapp },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'WEB_URL') return 'https://web.kiwi.test';
              if (key === 'DRIVER_URL') return 'https://driver.kiwi.test';
              if (key === 'CLIENT_URL') return 'https://client.kiwi.test';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
  });

  describe('create', () => {
    it('crea invitación de comercio y manda el correo con link de la web', async () => {
      prisma.invitation.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'inv-1', ...data, sentAt: null, createdAt: new Date() }),
      );
      prisma.invitation.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'inv-1', sentAt: new Date(), ...data }),
      );

      const res = await service.create(
        { email: ' Soda@Ejemplo.com ', phone: '72199768', name: 'Soda El Sabor', role: 'merchant' },
        'admin-1',
      );

      expect(prisma.invitation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'soda@ejemplo.com',
          phone: '7219-9768',
          name: 'Soda El Sabor',
          role: 'merchant',
          status: 'pending',
          createdBy: 'admin-1',
        }),
      });
      expect(res.emailSent).toBe(true);
      expect(res.inviteUrl).toContain('https://web.kiwi.test/register?');
      expect(res.inviteUrl).toContain(`email=${encodeURIComponent('soda@ejemplo.com')}`);
      // El hash no sale al cliente; el crudo solo viaja en el link.
      expect(res.invitation).not.toHaveProperty('tokenHash');
      expect(mail.sendInvitation).toHaveBeenCalledWith(
        'soda@ejemplo.com',
        'merchant',
        res.inviteUrl,
        'Soda El Sabor',
      );
    });

    it('el link de repartidor apunta a la app driver', async () => {
      prisma.invitation.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'inv-2', ...data, sentAt: null, createdAt: new Date() }),
      );
      prisma.invitation.update.mockResolvedValue({ id: 'inv-2', sentAt: new Date() });

      const res = await service.create({ email: 'repa@ejemplo.com', role: 'driver' });
      expect(res.inviteUrl.startsWith('https://driver.kiwi.test/register?')).toBe(true);
      expect(mail.sendInvitation).toHaveBeenCalledWith(
        'repa@ejemplo.com',
        'driver',
        res.inviteUrl,
        undefined,
      );
    });

    it('el link de cliente apunta a la app cliente', async () => {
      prisma.invitation.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'inv-c', ...data, sentAt: null, createdAt: new Date() }),
      );
      prisma.invitation.update.mockResolvedValue({ id: 'inv-c', sentAt: new Date() });

      const res = await service.create({ email: 'cli@ejemplo.com', role: 'customer' });
      expect(res.inviteUrl.startsWith('https://client.kiwi.test/register?')).toBe(true);
      expect(mail.sendInvitation).toHaveBeenCalledWith(
        'cli@ejemplo.com',
        'customer',
        res.inviteUrl,
        undefined,
      );
    });

    it('rechaza teléfono inválido y email inválido', async () => {
      await expect(
        service.create({ email: 'soda@ejemplo.com', phone: '123', role: 'merchant' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create({ email: 'no-es-email', role: 'merchant' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.invitation.create).not.toHaveBeenCalled();
    });

    it('renueva la pendiente existente en vez de duplicar', async () => {
      prisma.invitation.findFirst.mockResolvedValue({ id: 'inv-old', phone: '1111-1111' });
      prisma.invitation.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'inv-old', ...data }),
      );

      const res = await service.create({ email: 'soda@ejemplo.com', role: 'merchant' });
      expect(prisma.invitation.create).not.toHaveBeenCalled();
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-old' },
        data: expect.objectContaining({ tokenHash: expect.any(String) }),
      });
      expect(res.emailSent).toBe(true);
    });

    it('si el correo no sale, igual guarda la invitación (emailSent false)', async () => {
      mail.sendInvitation.mockResolvedValue(false);
      prisma.invitation.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'inv-3', ...data, sentAt: null, createdAt: new Date() }),
      );

      const res = await service.create({ email: 'soda@ejemplo.com', role: 'merchant' });
      expect(res.emailSent).toBe(false);
      expect(res.inviteUrl).toContain('invitation=');
    });
  });

  describe('resend', () => {
    it('rota el token: el link viejo muere y llega uno nuevo', async () => {
      const oldRaw = 'a'.repeat(64);
      const row = {
        id: 'inv-1',
        email: 'soda@ejemplo.com',
        role: 'merchant',
        status: 'pending',
        tokenHash: hashOf(oldRaw),
        expiresAt: new Date(Date.now() + 1000),
      };
      prisma.invitation.findUnique.mockResolvedValue(row);
      prisma.invitation.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...row, ...data }),
      );

      const res = await service.resend('inv-1');
      const newRaw = rawFromUrl(res.inviteUrl);
      expect(newRaw).not.toBe(oldRaw);
      expect(hashOf(newRaw)).not.toBe(row.tokenHash);
      expect(res.emailSent).toBe(true);
    });

    it('rechaza reenviar aceptadas o inexistentes', async () => {
      prisma.invitation.findUnique.mockResolvedValue(null);
      await expect(service.resend('nope')).rejects.toBeInstanceOf(NotFoundException);

      prisma.invitation.findUnique.mockResolvedValue({ id: 'x', status: 'accepted' });
      await expect(service.resend('x')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('sendWhatsapp', () => {
    it('manda por WhatsApp con link nuevo al teléfono anotado', async () => {
      const row = {
        id: 'inv-wa',
        email: 'soda@ejemplo.com',
        phone: '7219-9768',
        name: 'Soda',
        role: 'merchant',
        status: 'pending',
        tokenHash: 'old',
        expiresAt: new Date(Date.now() + 10000),
      };
      prisma.invitation.findUnique.mockResolvedValue(row);
      prisma.invitation.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...row, ...data }),
      );

      const res = await service.sendWhatsapp('inv-wa');
      expect(res.waSent).toBe(true);
      expect(res.inviteUrl).toContain('invitation=');
      // Rota el token igual que reenviar.
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-wa' },
        data: expect.objectContaining({ tokenHash: expect.any(String) }),
      });
    });

    it('exige teléfono y estado pendiente', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'x',
        status: 'pending',
        phone: null,
        email: 'a@x.com',
        role: 'merchant',
      });
      await expect(service.sendWhatsapp('x')).rejects.toBeInstanceOf(BadRequestException);

      prisma.invitation.findUnique.mockResolvedValue(null);
      await expect(service.sendWhatsapp('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('revoke', () => {
    it('revoca una pendiente', async () => {
      prisma.invitation.findUnique.mockResolvedValue({ id: 'inv-1', status: 'pending' });
      prisma.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'revoked' });
      const res = await service.revoke('inv-1');
      expect(res.invitation.status).toBe('revoked');
    });

    it('rechaza revocar no pendientes o inexistentes', async () => {
      prisma.invitation.findUnique.mockResolvedValue(null);
      await expect(service.revoke('nope')).rejects.toBeInstanceOf(NotFoundException);
      prisma.invitation.findUnique.mockResolvedValue({ id: 'x', status: 'revoked' });
      await expect(service.revoke('x')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('validateToken', () => {
    it('valida un token vigente y detecta email/rol distintos', async () => {
      const raw = 'b'.repeat(64);
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        email: 'soda@ejemplo.com',
        role: 'merchant',
        name: 'Soda',
        status: 'pending',
        expiresAt: new Date(Date.now() + 1000),
      });

      const ok = await service.validateToken(raw, 'soda@ejemplo.com', 'merchant');
      expect(ok).toEqual(
        expect.objectContaining({ valid: true, email: 'soda@ejemplo.com', role: 'merchant' }),
      );
      expect(await service.validateToken(raw, 'otro@x.com', 'merchant')).toEqual({ valid: false });
      expect(await service.validateToken(raw, 'soda@ejemplo.com', 'driver')).toEqual({
        valid: false,
      });
    });

    it('rechaza tokens vencidos, usados o cortos', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(await service.validateToken('c'.repeat(64))).toEqual({ valid: false });

      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'accepted',
        expiresAt: new Date(Date.now() + 10000),
      });
      expect(await service.validateToken('c'.repeat(64))).toEqual({ valid: false });
      expect(await service.validateToken('corto')).toEqual({ valid: false });
    });
  });

  describe('consumeOnRegister', () => {
    it('con token válido marca accepted; con link adulterado lanza 400', async () => {
      const raw = 'd'.repeat(64);
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        email: 'soda@ejemplo.com',
        role: 'merchant',
        status: 'pending',
        expiresAt: new Date(Date.now() + 10000),
      });
      prisma.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'accepted' });

      await service.consumeOnRegister({ token: raw, email: 'soda@ejemplo.com', role: 'merchant' });
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { tokenHash: hashOf(raw) },
        data: expect.objectContaining({ status: 'accepted' }),
      });

      await expect(
        service.consumeOnRegister({ token: raw, email: 'otro@x.com', role: 'merchant' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('sin token marca por email+rol sin bloquear (best-effort)', async () => {
      await service.consumeOnRegister({ email: 'Soda@Ejemplo.com', role: 'merchant' });
      expect(prisma.invitation.updateMany).toHaveBeenCalledWith({
        where: { email: 'soda@ejemplo.com', role: 'merchant', status: 'pending' },
        data: expect.objectContaining({ status: 'accepted' }),
      });
    });
  });

  describe('list', () => {
    it('filtra por rol y no expone el hash', async () => {
      prisma.invitation.findMany.mockResolvedValue([
        { id: '1', email: 'a@x.com', role: 'driver', status: 'pending', tokenHash: 'h' },
      ]);
      prisma.invitation.count.mockResolvedValue(1);
      const res = await service.list({ role: 'driver' });
      expect(prisma.invitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'driver' } }),
      );
      expect(res.total).toBe(1);
      expect(res.invitations[0]).not.toHaveProperty('tokenHash');
    });
  });
});
