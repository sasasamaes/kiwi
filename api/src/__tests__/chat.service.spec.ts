// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Chat del pedido (comercio ↔ repartidor ↔ cliente dueño): solo
 * participantes, una fila por destinatario, historial deduplicado visible
 * para quien se suma tarde, y push al offline.
 */
describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let notifications: any;

  const fullOrder = {
    id: 'order-1',
    merchant: { userId: 'merchant-1' },
    driver: { userId: 'driver-1' },
    customerId: 'customer-1',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(fullOrder) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'customer-1', status: 'active' }) },
      notification: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    notifications = { pushChatMessage: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('el cliente dueño puede escribir: llega a comercio y driver (+push)', async () => {
    prisma.notification.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `n-${data.userId}`, createdAt: new Date(), ...data }),
    );
    const emitted: any[] = [];

    const res = await service.sendMessage(
      'order-1',
      'customer-1',
      'customer',
      'Hola, ¿ya viene?',
      (uid, payload) => emitted.push([uid, payload]),
    );

    expect(res.delivered).toBe(2);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(emitted.map(([u]) => u).sort()).toEqual(['driver-1', 'merchant-1']);
    expect(notifications.pushChatMessage).toHaveBeenCalledTimes(2);
  });

  it('niega a terceros y exige texto', async () => {
    await expect(
      service.sendMessage('order-1', 'outsider-9', 'customer', 'hola'),
    ).rejects.toThrow();
    await expect(service.sendMessage('order-1', 'customer-1', 'customer', '   ')).rejects.toThrow();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('pedido inexistente → 404', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(service.sendMessage('nope', 'customer-1', 'customer', 'hola')).rejects.toThrow(
      'Pedido no encontrado',
    );
  });

  it('historial deduplica copias y marca mine (driver que se sumó tarde ve todo)', async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n-m',
        body: 'Voy en camino',
        createdAt: new Date(),
        data: {
          orderId: 'order-1',
          senderId: 'driver-1',
          senderRole: 'driver',
          messageId: 'mid-1',
        },
      },
      {
        id: 'n-c',
        body: 'Voy en camino',
        createdAt: new Date(),
        data: {
          orderId: 'order-1',
          senderId: 'driver-1',
          senderRole: 'driver',
          messageId: 'mid-1',
        },
      },
    ]);

    const res = await service.getMessages('order-1', 'driver-1');

    expect(res.messages).toHaveLength(1);
    expect(res.messages[0]).toEqual(expect.objectContaining({ text: 'Voy en camino', mine: true }));
    expect(res.participants).toEqual([
      { role: 'merchant', present: true },
      { role: 'driver', present: true },
      { role: 'customer', present: true },
    ]);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'chat' }) }),
    );
  });

  it('niega historial a terceros', async () => {
    await expect(service.getMessages('order-1', 'outsider-9')).rejects.toThrow();
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it('pedido invitado (sin cliente ni driver): el comercio escribe sin destinatarios', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      merchant: { userId: 'merchant-1' },
      driver: null,
      customerId: null,
    });
    const res = await service.sendMessage('order-1', 'merchant-1', 'merchant', 'Hola?');
    expect(res.delivered).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
