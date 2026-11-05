// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService: driver push silencioso salvo entrega', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'n1' }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      deviceToken: {
        findMany: jest.fn().mockResolvedValue([{ token: 'tok-1' }]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      driverProfile: { findMany: jest.fn().mockResolvedValue([]) },
      topicPreference: { count: jest.fn().mockResolvedValue(0) },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(NotificationsService);
    (service as any).fcmAdmin = { send: jest.fn().mockResolvedValue('ok') };
  });

  it('push:false guarda inbox pero no manda FCM', async () => {
    await service.sendToUser('u1', { title: 't', body: 'b', push: false });
    expect(prisma.notification.create).toHaveBeenCalled();
    expect((service as any).fcmAdmin.send).not.toHaveBeenCalled();
  });

  it('driver intermedio (picked_up) queda solo en inbox', async () => {
    await service.notifyOrderStatusUpdate('order-1', 'driver-1', 'picked_up', 'driver', {});
    expect(prisma.notification.create).toHaveBeenCalled();
    expect((service as any).fcmAdmin.send).not.toHaveBeenCalled();
  });

  it('driver delivered sí suena con la ganancia', async () => {
    await service.notifyOrderStatusUpdate('order-1', 'driver-1', 'delivered', 'driver', {
      payout: 1500,
    });
    expect((service as any).fcmAdmin.send).toHaveBeenCalled();
  });

  it('driver assigned directo sí suena (es entrante para él)', async () => {
    (service as any).fcmAdmin.send.mockClear();
    prisma.order = { findUnique: jest.fn().mockResolvedValue({ isTest: false }) };
    await service.notifyOrderStatusUpdate('order-1', 'driver-1', 'assigned', 'driver', {});
    expect((service as any).fcmAdmin.send).toHaveBeenCalled();
  });

  it('merchant sigue sonando en intermedios', async () => {
    await service.notifyOrderStatusUpdate('order-1', 'm-1', 'picked_up', 'merchant', {});
    expect((service as any).fcmAdmin.send).toHaveBeenCalled();
  });

  it('pedido de prueba: el push lleva prefijo TEST', async () => {
    prisma.order = { findUnique: jest.fn().mockResolvedValue({ isTest: true }) };
    await service.notifyOrderStatusUpdate('order-1', 'driver-1', 'delivered', 'driver', {
      payout: 1275,
    });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: expect.stringMatching(/^🧪 TEST/),
        }),
      }),
    );
  });

  it('oferta a piloto de un test: el título avisa que es prueba', async () => {
    prisma.order = { findUnique: jest.fn().mockResolvedValue({ isTest: true }) };
    await service.notifyAssignmentOffered('order-1', 'driver-1', 5);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: expect.stringMatching(/prueba/i),
        }),
      }),
    );
  });

  it('pedido real: sin prefijo TEST', async () => {
    prisma.order = { findUnique: jest.fn().mockResolvedValue({ isTest: false }) };
    await service.notifyOrderStatusUpdate('order-1', 'driver-1', 'delivered', 'driver', {
      payout: 1275,
    });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: expect.not.stringMatching(/TEST/),
        }),
      }),
    );
  });

  it('pushHealth agrega el pipeline sin PII', async () => {
    prisma.deviceToken.count.mockResolvedValue(12);
    prisma.deviceToken.groupBy.mockResolvedValue([
      { platform: 'android', _count: 9 },
      { platform: 'web', _count: 3 },
    ]);
    prisma.driverProfile.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    prisma.topicPreference.count.mockResolvedValue(2);
    prisma.order.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);
    prisma.notification.groupBy.mockResolvedValue([
      { type: 'push:order_status', _count: { type: 4 } },
    ]);

    const h: any = await service.pushHealth();
    expect(h.fcmConfigured).toBe(true);
    expect(h.tokens.total).toBe(12);
    expect(h.tokens.byPlatform).toEqual({ android: 9, web: 3 });
    expect(h.drivers.availableNow).toBe(2);
    expect(h.prefsDriverOrdersNew).toBe(2);
    expect(h.orders24h).toEqual({ total: 5, test: 1, real: 4 });
    expect(h.inboxPushes24h).toEqual({ 'push:order_status': 4 });
    expect(JSON.stringify(h)).not.toMatch(/8888|@|\.com/);
  });

  it('token nativo (android/ios) lleva bloque notification + sonido', async () => {
    (service as any).fcmAdmin.send.mockClear();
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'tok-a', platform: 'android' }]);
    await service.sendToUser('u1', { title: 't', body: 'b' });
    const msg = (service as any).fcmAdmin.send.mock.calls[0][0];
    expect(msg.token).toBe('tok-a');
    expect(msg.notification).toEqual({ title: 't', body: 'b' });
    expect(msg.android?.notification?.channelId).toBe('kiwi-default');
    expect(msg.android?.notification?.sound).toBe('default');
    expect(msg.apns?.payload?.aps?.sound).toBe('default');
    expect(msg.data?.title).toBe('t');
  });

  it('token web sigue data-only (el SW muestra el banner, sin duplicar)', async () => {
    (service as any).fcmAdmin.send.mockClear();
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'tok-w', platform: 'web' }]);
    await service.sendToUser('u1', { title: 't', body: 'b', data: { orderId: 'o1' } });
    const msg = (service as any).fcmAdmin.send.mock.calls[0][0];
    expect(msg.notification).toBeUndefined();
    expect(msg.data?.title).toBe('t');
    expect(msg.webpush?.fcmOptions?.link).toBe('/tracking/o1');
  });

  it('register marca la plataforma primaria (última app abierta gana)', async () => {
    prisma.deviceToken.upsert = jest.fn().mockResolvedValue({});
    prisma.deviceToken.deleteMany = jest.fn().mockResolvedValue({});
    await service.registerDeviceToken('u1', 'tok-x', 'ios');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { primaryPushPlatform: 'ios' },
    });
  });

  it('con primaria ios y tokens ios+web, solo suena el ios', async () => {
    (service as any).fcmAdmin.send.mockClear();
    prisma.deviceToken.findMany.mockResolvedValue([
      { token: 'tok-ios', platform: 'ios' },
      { token: 'tok-web', platform: 'web' },
    ]);
    prisma.user.findUnique.mockResolvedValue({ primaryPushPlatform: 'ios' });
    await service.sendToUser('u1', { title: 't', body: 'b' });
    const sent = (service as any).fcmAdmin.send.mock.calls.map((c: any[]) => c[0].token);
    expect(sent).toEqual(['tok-ios']);
  });

  it('sin primaria suena en todas (comportamiento legacy)', async () => {
    (service as any).fcmAdmin.send.mockClear();
    prisma.deviceToken.findMany.mockResolvedValue([
      { token: 'tok-ios', platform: 'ios' },
      { token: 'tok-web', platform: 'web' },
    ]);
    prisma.user.findUnique.mockResolvedValue({ primaryPushPlatform: null });
    await service.sendToUser('u1', { title: 't', body: 'b' });
    const sent = (service as any).fcmAdmin.send.mock.calls.map((c: any[]) => c[0].token);
    expect(sent).toEqual(expect.arrayContaining(['tok-ios', 'tok-web']));
  });

  it('primaria sin tokens hace fallback a todas', async () => {
    (service as any).fcmAdmin.send.mockClear();
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'tok-web', platform: 'web' }]);
    prisma.user.findUnique.mockResolvedValue({ primaryPushPlatform: 'ios' });
    await service.sendToUser('u1', { title: 't', body: 'b' });
    const sent = (service as any).fcmAdmin.send.mock.calls.map((c: any[]) => c[0].token);
    expect(sent).toEqual(['tok-web']);
  });
});
