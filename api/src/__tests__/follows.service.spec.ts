// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { FollowsService } from '../follows/follows.service';
import { MerchantsService } from '../merchants/merchants.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaMock() {
  return {
    merchantProfile: { findUnique: jest.fn() },
    merchantFollow: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    notification: { create: jest.fn(), count: jest.fn() },
    deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
    topicPreference: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('FollowsService', () => {
  let service: FollowsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = prismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [FollowsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<FollowsService>(FollowsService);
  });

  it('follow crea la relación (idempotente si ya sigue)', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.merchantFollow.upsert.mockResolvedValue({});

    await expect(service.follow('u1', 'm1')).resolves.toEqual({ following: true });
    expect(prisma.merchantFollow.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_merchantId: { userId: 'u1', merchantId: 'm1' } } }),
    );
  });

  it('follow a comercio inexistente → 404', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue(null);
    await expect(service.follow('u1', 'nope')).rejects.toThrow('Comercio no encontrado');
  });

  it('unfollow borra y myFollows mapea comercios', async () => {
    prisma.merchantFollow.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.unfollow('u1', 'm1')).resolves.toEqual({ following: false });

    prisma.merchantFollow.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-01-01'),
        merchant: { id: 'm1', businessName: 'Casa' },
      },
    ]);
    const mine = await service.myFollows('u1');
    expect(mine).toEqual([{ id: 'm1', businessName: 'Casa', followedAt: expect.any(Date) }]);
  });
});

describe('NotificationsService.notifyFollowers', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = prismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('respeta opt-out y solo avisa a activos', async () => {
    prisma.merchantFollow.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    prisma.topicPreference.findMany.mockResolvedValue([{ userId: 'u2' }]); // u2 apagó
    prisma.notification.create.mockImplementation((args: any) =>
      Promise.resolve({ id: `n-${args.data.userId}`, ...args.data }),
    );

    const res = await service.notifyFollowers('m1', { title: 'T', body: 'B' });
    expect(res).toEqual({ reached: 1 });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1' }) }),
    );
  });

  it('sin seguidores no escribe nada', async () => {
    prisma.merchantFollow.findMany.mockResolvedValue([]);
    const res = await service.notifyFollowers('m1', { title: 'T', body: 'B' });
    expect(res).toEqual({ reached: 0 });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('MerchantsService.announceToFollowers', () => {
  let service: MerchantsService;
  let prisma: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = prismaMock();
    notifications = { notifyFollowers: jest.fn().mockResolvedValue({ reached: 4 }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = module.get<MerchantsService>(MerchantsService);
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm1', businessName: 'Casa' });
  });

  it('valida título y cuerpo', async () => {
    await expect(service.announceToFollowers('u1', { title: '', body: '' })).rejects.toThrow(
      'requeridos',
    );
  });

  it('tope 3 avisos por día', async () => {
    prisma.notification.count.mockResolvedValue(3);
    await expect(
      service.announceToFollowers('u1', { title: 'Mañana hay', body: 'Rollos' }),
    ).rejects.toThrow('Límite de 3 avisos');
    expect(notifications.notifyFollowers).not.toHaveBeenCalled();
  });

  it('envía y devuelve alcanzados', async () => {
    prisma.notification.count.mockResolvedValue(0);
    const res = await service.announceToFollowers('u1', {
      title: 'Mañana hay rollos',
      body: 'Se entregan el jueves a las 2:00 p. m.',
    });
    expect(res).toEqual({ reached: 4 });
    expect(notifications.notifyFollowers).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ data: { kind: 'announce' } }),
    );
  });
});
