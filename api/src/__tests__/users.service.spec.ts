// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService admin', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('listUsers', () => {
    it('pagina con tope y nunca expone passwordHash', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'a@x.com', passwordHash: 'secret', role: 'driver' },
      ]);
      prisma.user.count.mockResolvedValue(1);

      const res = await service.listUsers({ take: 500, search: 'a@x' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
      expect(res.users[0]).not.toHaveProperty('passwordHash');
      expect(res.total).toBe(1);
    });

    it('ignora filtros inválidos', async () => {
      await service.listUsers({ role: 'root', status: 'banned' } as any);

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('setStatus', () => {
    it('bloquea auto-desactivación y estados inválidos', async () => {
      await expect(service.setStatus('me', 'inactive', 'me')).rejects.toThrow(ForbiddenException);
      await expect(service.setStatus('u1', 'deleted', 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('404 si el usuario no existe y actualiza si existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.setStatus('ghost', 'inactive', 'admin')).rejects.toThrow(
        NotFoundException,
      );

      prisma.user.findUnique.mockResolvedValue({ id: 'u1', status: 'active' });
      prisma.user.findMany.mockResolvedValue([]);
      await service.setStatus('u1', 'inactive', 'admin');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'inactive' },
      });
    });
  });

  describe('setPassword', () => {
    it('rechaza claves cortas y usuarios inexistentes', async () => {
      await expect(service.setPassword('u1', '12345')).rejects.toThrow(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();

      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.setPassword('ghost', 'nueva123')).rejects.toThrow(NotFoundException);
    });

    it('hashea, desbloquea y revoca sesiones sin exponer el hash', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'u1', status: 'active' })
        .mockResolvedValueOnce({ id: 'u1', email: 'a@x.com', role: 'driver' });

      const res = await service.setPassword('u1', 'nueva123');

      const [call] = prisma.user.update.mock.calls;
      expect(call[0]).toEqual({
        where: { id: 'u1' },
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          loginLockedUntil: null,
          tokenVersion: { increment: 1 },
        }),
      });
      const hash = call[0].data.passwordHash as string;
      expect(hash).toMatch(/^\$2[aby]\$/);
      expect(hash).not.toContain('nueva123');
      expect(res).not.toHaveProperty('passwordHash');
    });
  });
});
