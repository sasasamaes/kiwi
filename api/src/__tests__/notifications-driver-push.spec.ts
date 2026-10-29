// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService: driver push silencioso salvo entrega', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([{ token: 'tok-1' }]) },
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
});
