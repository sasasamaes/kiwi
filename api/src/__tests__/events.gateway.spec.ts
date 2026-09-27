// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { EventsGateway } from '../events/events.gateway';

/**
 * Pins the socket-gateway payload restrictions added with the file/data
 * restriction pass. The gateway is the only channel where arbitrary client
 * JSON reaches broadcasts to other users, so each handler is pinned.
 */
describe('EventsGateway payload restrictions', () => {
  let gateway: EventsGateway;
  let emitMock: jest.Mock;
  let client: any;

  beforeEach(() => {
    emitMock = jest.fn();
    gateway = new EventsGateway(
      {} as any,
      {
        order: { findUnique: jest.fn() },
        driverProfile: {
          update: jest.fn().mockResolvedValue({}),
          findUnique: jest.fn(),
        },
      } as any,
    );
    (gateway as any).server = { to: jest.fn().mockReturnValue({ emit: emitMock }) };
    client = { id: 'sock1', join: jest.fn(), emit: jest.fn() };
  });

  const connect = (role: string, userId = 'u1') => {
    (gateway as any).connectedUsers.set('sock1', { socketId: 'sock1', role, userId });
  };

  describe('order:create broadcast', () => {
    it('accepts a well-formed payload and broadcasts bounded fields', async () => {
      connect('merchant', 'm1');
      const res = await gateway.handleOrderCreate(client, {
        orderId: 'ord-1',
        pickupAddress: 'A',
        deliveryAddress: 'B',
        totalAmount: 5000,
        distanceKm: 2.5,
      });
      expect(res).toEqual({ success: true });
      expect(emitMock).toHaveBeenCalledWith(
        'order:new',
        expect.objectContaining({ orderId: 'ord-1', totalAmount: 5000 }),
      );
    });

    it('rejects missing/invalid required fields', async () => {
      connect('merchant');
      expect(await gateway.handleOrderCreate(client, { totalAmount: 1 })).toEqual({
        error: 'orderId y totalAmount son requeridos',
      });
      expect(
        await gateway.handleOrderCreate(client, { orderId: 'x', totalAmount: 'big' } as any),
      ).toEqual({ error: 'orderId y totalAmount son requeridos' });
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('truncates oversized address strings before broadcast', async () => {
      connect('merchant');
      await gateway.handleOrderCreate(client, {
        orderId: 'ord-1',
        pickupAddress: 'x'.repeat(5000),
        totalAmount: 100,
      });
      const payload = emitMock.mock.calls[0][1];
      expect(payload.pickupAddress.length).toBe(300);
    });

    it('emits canonical shape (id + payout) when the order exists', async () => {
      connect('merchant');
      (gateway as any).prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: 'pending',
        driverId: null,
        pickupAddress: 'A',
        deliveryAddress: 'B',
        totalAmount: 5000,
        driverPayout: 2000,
        distanceKm: 2.5,
        createdAt: new Date(),
      });
      await gateway.handleOrderCreate(client, {
        orderId: 'ord-1',
        pickupAddress: 'A',
        deliveryAddress: 'B',
        totalAmount: 5000,
      });
      expect(emitMock).toHaveBeenCalledWith(
        'order:new',
        expect.objectContaining({ id: 'ord-1', orderId: 'ord-1', driverPayout: 2000 }),
      );
    });

    it('does not rebroadcast orders that are no longer pending', async () => {
      connect('merchant');
      (gateway as any).prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: 'assigned',
        driverId: 'dp-1',
      });
      const res = await gateway.handleOrderCreate(client, {
        orderId: 'ord-1',
        pickupAddress: 'A',
        deliveryAddress: 'B',
        totalAmount: 5000,
      });
      expect(res).toEqual({ success: true });
      expect(emitMock).not.toHaveBeenCalled();
    });
  });

  describe('order:accept driver spoofing', () => {
    it('ignores the client-supplied driverId and uses the token identity', async () => {
      connect('driver', 'driver-user-1');
      (gateway as any).prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        driverId: 'dp-1',
        merchant: { userId: 'merchant-user-1' },
      });
      (gateway as any).prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-1' });
      await gateway.handleOrderAccept(client, { orderId: 'ord-1', driverId: 'SPOOFED' });
      expect(emitMock).toHaveBeenCalledWith(
        'order:accepted',
        expect.objectContaining({ driverId: 'driver-user-1' }),
      );
    });

    it('no avisa al comercio si el pedido no está asignado (accept fantasma)', async () => {
      connect('driver', 'driver-user-1');
      (gateway as any).prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        driverId: null,
        merchant: { userId: 'merchant-user-1' },
      });
      const res = await gateway.handleOrderAccept(client, { orderId: 'ord-1', driverId: 'x' });
      expect(res).toEqual({ error: 'El pedido aún no fue aceptado' });
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('no avisa si emite otro driver distinto al asignado', async () => {
      connect('driver', 'intruder');
      (gateway as any).prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        driverId: 'dp-1',
        merchant: { userId: 'merchant-user-1' },
      });
      (gateway as any).prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-9' });
      const res = await gateway.handleOrderAccept(client, { orderId: 'ord-1', driverId: 'x' });
      expect(res).toEqual({ error: 'No sos el repartidor asignado' });
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('rejects malformed orderId', async () => {
      connect('driver');
      expect(await gateway.handleOrderAccept(client, { orderId: { $gt: 1 } } as any)).toEqual({
        error: 'orderId inválido',
      });
    });
  });

  describe('order:statusUpdate', () => {
    it('rejects arbitrary status strings', async () => {
      connect('merchant');
      expect(
        await gateway.handleOrderStatusUpdate(client, {
          orderId: 'o1',
          status: '🦠 garbage',
        } as any),
      ).toEqual({ error: 'status inválido' });
      expect((gateway as any).prisma.order.findUnique).not.toHaveBeenCalled();
    });

    it('accepts a real flow status', async () => {
      connect('merchant', 'merchant-user-1');
      (gateway as any).prisma.order.findUnique.mockResolvedValue({
        merchant: { userId: 'merchant-user-1' },
        driver: null,
      });
      const res = await gateway.handleOrderStatusUpdate(client, {
        orderId: 'o1',
        status: 'picked_up',
      });
      expect(res).toEqual({ success: true });
    });
  });

  describe('driver:locationUpdate', () => {
    it('rejects out-of-range coordinates', async () => {
      connect('driver');
      expect(
        await gateway.handleDriverLocationUpdate(client, { lat: 999, lng: 10 } as any),
      ).toEqual({ error: 'lat/lng inválidos' });
      expect(
        await gateway.handleDriverLocationUpdate(client, { lat: '9', lng: 10 } as any),
      ).toEqual({ error: 'lat/lng inválidos' });
    });

    it('accepts valid coordinates', async () => {
      connect('driver');
      const res = await gateway.handleDriverLocationUpdate(client, { lat: 9.93, lng: -84.05 });
      expect(res).toEqual({ success: true });
    });
  });

  describe('driver:statusChange', () => {
    it('rejects statuses outside the enum', async () => {
      connect('driver');
      expect(
        await gateway.handleDriverStatusChange(client, { status: 'rich_and_famous' } as any),
      ).toEqual({ error: 'status inválido' });
      expect((gateway as any).prisma.driverProfile.update).not.toHaveBeenCalled();
    });
  });

  describe('notification:subscribe topic allowlist', () => {
    it('refuses topics outside the allowlist', async () => {
      connect('merchant');
      expect(
        await gateway.handleNotificationSubscribe(client, { topics: ['admin', 'orders_zone'] }),
      ).toEqual({ error: 'topics inválidos' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('rejects a mixed list (invalid + valid) entirely — probing gets no partial success', async () => {
      connect('merchant');
      expect(
        await gateway.handleNotificationSubscribe(client, {
          topics: ['orders_zone', 'admin', 'promotions'],
        } as any),
      ).toEqual({ error: 'topics inválidos' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins an all-valid topic list', async () => {
      connect('merchant');
      const res = await gateway.handleNotificationSubscribe(client, {
        topics: ['orders_zone', 'promotions'],
      } as any);
      expect(res).toEqual({ success: true });
      expect(client.join.mock.calls.map((c: any) => c[0])).toEqual([
        'topic:orders_zone',
        'topic:promotions',
      ]);
    });
  });
});
