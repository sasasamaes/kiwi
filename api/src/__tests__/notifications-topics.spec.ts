// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { getTopic, topicsForRole, TOPIC_CATALOG } from '../notifications/topics';

describe('Topics: catálogo', () => {
  it('cada topic tiene audiencia y nombre con prefijo de rol coherentes', () => {
    for (const t of TOPIC_CATALOG) {
      expect(t.name.startsWith(`${t.audience}.`)).toBe(true);
      expect(['push', 'push+inbox']).toContain(t.delivery);
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  it('los topics locked son críticos (assigned/status) y ningún default apagable es locked', () => {
    const locked = TOPIC_CATALOG.filter((t) => t.locked).map((t) => t.name);
    expect(locked).toEqual(
      expect.arrayContaining(['driver.orders.assigned', 'merchant.orders.status']),
    );
  });

  it('topicsForRole filtra por rol', () => {
    const driver = topicsForRole('driver').map((t) => t.name);
    expect(driver).toContain('driver.orders.new');
    expect(driver).not.toContain('merchant.payments');
  });

  it('getTopic devuelve undefined para desconocidos', () => {
    expect(getTopic('nope.nothing')).toBeUndefined();
  });
});

describe('NotificationsService: preferencias y sincronización', () => {
  let service: NotificationsService;
  let prisma: any;

  const mockUser = { id: 'user-1', role: 'driver' };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      topicPreference: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('getTopicPreferences aplica defaults para topics sin preferencia', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.topicPreference.findMany.mockResolvedValue([]);

    const prefs = await service.getTopicPreferences('user-1');

    expect(prefs).toHaveLength(topicsForRole('driver').length);
    for (const p of prefs) {
      expect(p.enabled).toBe(p.defaultEnabled);
    }
  });

  it('getTopicPreferences respeta la preferencia guardada sobre el default', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.topicPreference.findMany.mockResolvedValue([
      { userId: 'user-1', topic: 'driver.traffic', enabled: true },
    ]);

    const prefs = await service.getTopicPreferences('user-1');
    const traffic = prefs.find((p) => p.name === 'driver.traffic');

    expect(traffic?.enabled).toBe(true); // default era false, el usuario lo encendió
  });

  it('getTopicPreferences devuelve [] para usuario inexistente', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await service.getTopicPreferences('ghost')).toEqual([]);
  });

  it('setTopicPreference rechaza topics desconocidos', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    await expect(service.setTopicPreference('user-1', 'fake.topic', true)).rejects.toThrow(
      /Unknown topic/,
    );
  });

  it('setTopicPreference rechaza topics de otro rol', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser); // driver
    await expect(service.setTopicPreference('user-1', 'merchant.payments', true)).rejects.toThrow(
      /no disponible para rol/,
    );
  });

  it('setTopicPreference rechaza apagar un topic locked', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    await expect(
      service.setTopicPreference('user-1', 'driver.orders.assigned', false),
    ).rejects.toThrow(/obligatorio/);
  });

  it('setTopicPreference acepta cambiar un topic del rol y persiste', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    const syncSpy = jest.spyOn(service, 'syncTopicSubscriptions').mockResolvedValue({ synced: 0 });

    const res = await service.setTopicPreference('user-1', 'driver.traffic', true);

    expect(prisma.topicPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_topic: { userId: 'user-1', topic: 'driver.traffic' } },
        create: { userId: 'user-1', topic: 'driver.traffic', enabled: true },
      }),
    );
    expect(syncSpy).toHaveBeenCalledWith('user-1');
    expect(res).toEqual({ success: true });
  });
});

describe('NotificationsService: device tokens', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', role: 'driver' }) },
      topicPreference: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      deviceToken: {
        findMany: jest.fn().mockResolvedValue([{ token: 'tok-1' }]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('registerDeviceToken persiste el token con upsert y sincroniza topics', async () => {
    const syncSpy = jest.spyOn(service, 'syncTopicSubscriptions').mockResolvedValue({ synced: 2 });

    const res = await service.registerDeviceToken('u1', 'tok-abc', 'web');

    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'tok-abc' },
        create: { userId: 'u1', token: 'tok-abc', platform: 'web' },
      }),
    );
    expect(syncSpy).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ success: true });
  });

  it('removeDeviceToken borra solo los tokens del usuario', async () => {
    await service.removeDeviceToken('u1', 'tok-abc');
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', token: 'tok-abc' },
    });
  });

  it('syncTopicSubscriptions crea defaults cuando no hay preferencias previas', async () => {
    // Sin FCM (fcmAdmin null) y sin tokens: debe crear una fila por topic del rol.
    const res = await service.syncTopicSubscriptions('u1');

    const driverTopics = topicsForRole('driver').length;
    expect(prisma.topicPreference.create).toHaveBeenCalledTimes(driverTopics);
    expect(res).toEqual({ synced: 0 });
  });
});
