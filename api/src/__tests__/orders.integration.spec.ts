// Mock the problematic ESM modules before anything else
jest.mock('@nestjs/websockets', () => ({}), { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });

const mockEventsGateway = {
  sendToRole: jest.fn(),
  sendToUser: jest.fn(),
  broadcast: jest.fn(),
  notifyNewOrder: jest.fn(),
  notifyOrderUpdate: jest.fn(),
  handleConnection: jest.fn(),
  handleDisconnect: jest.fn(),
};

jest.mock('../events/events.gateway', () => ({
  EventsGateway: jest.fn().mockImplementation(() => mockEventsGateway),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';

/**
 * Integration Test: Full Order Lifecycle
 *
 * Tests the complete happy path:
 * 1. Merchant creates an order
 * 2. Driver sees available orders
 * 3. Driver accepts the order
 * 4. Driver picks up the order
 * 5. Driver delivers the order
 *
 * Also tests the scheduled order proposal flow:
 * 1. Merchant creates a scheduled order
 * 2. Multiple drivers submit proposals
 * 3. Merchant picks the best one
 * 4. Other drivers get rejected
 */
describe('Orders Integration: Full Lifecycle', () => {
  let ordersService: OrdersService;
  let prisma: any;

  // Test data
  const MERCHANT_USER_ID = 'user-merchant-1';
  const MERCHANT_PROFILE_ID = 'mp-1';
  const DRIVER_USER_ID = 'user-driver-1';
  const DRIVER_PROFILE_ID = 'dp-1';
  const DRIVER_2_USER_ID = 'user-driver-2';
  const DRIVER_2_PROFILE_ID = 'dp-2';
  const ORDER_ID = 'order-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    // Shared mock state that simulates a database
    const mockDb: Record<string, any> = {};
    const idCounter = 1;

    prisma = {
      merchantProfile: {
        findUnique: jest.fn(),
      },
      driverProfile: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      orderItem: {
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      driverProposal: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      menuItem: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: DriversService, useValue: { getLocation: jest.fn() } },
        {
          provide: GeocodingService,
          useValue: { searchCostaRica: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    ordersService = module.get(OrdersService);
  });

  describe('🟢 Happy Path: Immediate Order (Create → Accept → Pickup → Deliver)', () => {
    it('Step 1: Merchant creates an order', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: MERCHANT_PROFILE_ID,
        userId: MERCHANT_USER_ID,
        businessName: 'Bowl & Café Luis Alfredo',
        latitude: 10.0,
        longitude: -85.0,
      });

      const expectedOrder = {
        id: ORDER_ID,
        merchantId: MERCHANT_PROFILE_ID,
        status: 'pending',
        orderType: 'immediate',
        pickupAddress: 'Bowl & Café, Nicoya Centro',
        pickupLat: 10.0,
        pickupLng: -85.0,
        deliveryAddress: 'Barrio Los Ángeles, 200m sur',
        deliveryLat: 10.005,
        deliveryLng: -84.998,
        distanceKm: 2.5,
        basePrice: 1500,
        commission: 75,
        driverPayout: 1425,
        totalAmount: 1500,
        specialInstructions: 'Sin cebolla',
        createdAt: new Date(),
        merchant: { businessName: 'Bowl & Café Luis Alfredo' },
      };

      prisma.order.create.mockResolvedValue(expectedOrder);

      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Bowl Tropikal', price: 4500, merchantId: MERCHANT_PROFILE_ID },
      ]);

      const result = await ordersService.create(MERCHANT_USER_ID, {
        pickupAddress: 'Bowl & Café, Nicoya Centro',
        pickupLat: 10.0,
        pickupLng: -85.0,
        deliveryAddress: 'Barrio Los Ángeles, 200m sur',
        deliveryLat: 10.005,
        deliveryLng: -84.998,
        distanceKm: 2.5,
        items: [{ menuItemId: 'item-1', quantity: 1 }],
        specialInstructions: 'Sin cebolla',
      });

      expect(result.id).toBe(ORDER_ID);
      expect(result.status).toBe('pending');
      expect(result.basePrice).toBe(1500);
      expect(result.commission).toBe(75);
      expect(result.driverPayout).toBe(1425);

      // Socket.io should notify available drivers
      expect(mockEventsGateway.sendToRole).toHaveBeenCalledWith(
        'driver',
        'order:new',
        expect.objectContaining({
          orderId: ORDER_ID,
          merchantName: 'Bowl & Café Luis Alfredo',
        }),
      );
    });

    it('Step 2: Driver sees available orders', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: ORDER_ID,
          status: 'pending',
          driverId: null,
          totalAmount: 1500,
          pickupAddress: 'Bowl & Café, Nicoya Centro',
          deliveryAddress: 'Barrio Los Ángeles, 200m sur',
          merchant: { businessName: 'Bowl & Café Luis Alfredo' },
        },
      ]);

      const result = await ordersService.getAvailableOrders(10.0, -85.0);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ORDER_ID);
      expect(result[0].status).toBe('pending');
    });

    it('Step 3: Driver accepts the order', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce({
          id: ORDER_ID,
          status: 'pending',
          merchantId: MERCHANT_PROFILE_ID,
        })
        .mockResolvedValueOnce({
          id: ORDER_ID,
          status: 'assigned',
          driverId: DRIVER_PROFILE_ID,
          assignedAt: new Date(),
          merchant: { userId: MERCHANT_USER_ID },
          driver: { userId: DRIVER_USER_ID, fullName: 'Juan Carlos Rodríguez' },
        });

      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
        fullName: 'Juan Carlos Rodríguez',
        vehicleType: 'motorcycle',
      });

      prisma.order.updateMany.mockResolvedValue({ count: 1 });

      prisma.order.update.mockResolvedValue({
        id: ORDER_ID,
        status: 'assigned',
        driverId: DRIVER_PROFILE_ID,
        assignedAt: new Date(),
        merchant: { userId: MERCHANT_USER_ID },
        driver: { userId: DRIVER_USER_ID, fullName: 'Juan Carlos Rodríguez' },
      });

      prisma.notification.create.mockResolvedValue({});

      const result = await ordersService.acceptOrderAsDriver(ORDER_ID, DRIVER_USER_ID);

      expect(result.status).toBe('assigned');
      expect(result.driverId).toBe(DRIVER_PROFILE_ID);

      // Merchant should be notified
      expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
        MERCHANT_USER_ID,
        'order:accepted',
        expect.objectContaining({
          driverName: 'Juan Carlos Rodríguez',
        }),
      );

      // Driver gets confirmation
      expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
        DRIVER_USER_ID,
        'order:confirmed',
        expect.objectContaining({ orderId: ORDER_ID }),
      );
    });

    it('Step 4: Driver picks up the order (in_transit_to_pickup → picked_up)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: 'in_transit_to_pickup',
        merchant: { userId: MERCHANT_USER_ID },
        driver: { userId: DRIVER_USER_ID },
      });

      prisma.order.update.mockResolvedValue({
        id: ORDER_ID,
        status: 'picked_up',
        pickedUpAt: new Date(),
      });

      prisma.notification.create.mockResolvedValue({});

      const result = await ordersService.updateStatus(ORDER_ID, 'picked_up', DRIVER_USER_ID);

      expect(result.status).toBe('picked_up');
      expect(result.pickedUpAt).toBeDefined();

      // Both parties notified
      expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
        MERCHANT_USER_ID,
        'order:statusChanged',
        expect.objectContaining({ status: 'picked_up' }),
      );
      expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
        DRIVER_USER_ID,
        'order:statusChanged',
        expect.objectContaining({ status: 'picked_up' }),
      );
    });

    it('Step 5: Driver delivers the order (picked_up → in_transit → delivered)', async () => {
      // First: picked_up → in_transit_to_delivery
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: 'picked_up',
        merchant: { userId: MERCHANT_USER_ID },
        driver: { userId: DRIVER_USER_ID },
      });

      prisma.order.update.mockResolvedValue({
        id: ORDER_ID,
        status: 'in_transit_to_delivery',
      });
      prisma.notification.create.mockResolvedValue({});

      await ordersService.updateStatus(ORDER_ID, 'in_transit_to_delivery', DRIVER_USER_ID);

      // Then: in_transit_to_delivery → delivered
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: 'in_transit_to_delivery',
        merchant: { userId: MERCHANT_USER_ID },
        driver: { userId: DRIVER_USER_ID },
      });

      prisma.order.update.mockResolvedValue({
        id: ORDER_ID,
        status: 'delivered',
        deliveredAt: new Date(),
      });

      const result = await ordersService.updateStatus(ORDER_ID, 'delivered', DRIVER_USER_ID);

      expect(result.status).toBe('delivered');
      expect(result.deliveredAt).toBeDefined();

      // Final notification to both
      expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
        MERCHANT_USER_ID,
        'order:statusChanged',
        expect.objectContaining({ status: 'delivered' }),
      );
    });
  });

  describe('🟡 Scheduled Order Proposal Flow', () => {
    it('Step 1: Merchant creates a scheduled order', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: MERCHANT_PROFILE_ID,
        userId: MERCHANT_USER_ID,
        businessName: 'Bowl & Café Luis Alfredo',
        latitude: 10.0,
        longitude: -85.0,
      });

      prisma.order.create.mockResolvedValue({
        id: ORDER_ID,
        merchantId: MERCHANT_PROFILE_ID,
        status: 'driver_proposals',
        orderType: 'scheduled',
        scheduledDate: new Date('2027-09-05'),
        scheduledTime: '12:00',
        totalAmount: 1500,
        pickupAddress: 'Bowl & Café',
        deliveryAddress: 'Hotel Guanacaste',
      });

      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Bowl Tropikal', price: 4500, merchantId: MERCHANT_PROFILE_ID },
      ]);

      const result = await ordersService.create(MERCHANT_USER_ID, {
        orderType: 'scheduled',
        scheduledDate: '2027-09-05',
        scheduledTime: '12:00',
        pickupAddress: 'Bowl & Café',
        deliveryAddress: 'Hotel Guanacaste',
        items: [{ menuItemId: 'item-1', quantity: 2 }],
      });

      expect(result.status).toBe('driver_proposals');
      expect(result.orderType).toBe('scheduled');

      // Should NOT broadcast to drivers (they need to propose, not accept directly)
      expect(mockEventsGateway.sendToRole).not.toHaveBeenCalled();
    });

    it('Step 2: Multiple drivers submit proposals', async () => {
      // Driver 1 (Juan Carlos - moto) submits proposal
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        orderType: 'scheduled',
        status: 'driver_proposals',
        merchantId: MERCHANT_PROFILE_ID,
      });

      prisma.driverProposal.findFirst.mockResolvedValue(null);

      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
        fullName: 'Juan Carlos Rodríguez',
        vehicleType: 'motorcycle',
      });

      prisma.driverProposal.create.mockResolvedValue({
        id: 'proposal-1',
        orderId: ORDER_ID,
        driverId: DRIVER_PROFILE_ID,
        estimatedArrival: '30 minutos',
        message: 'Llevo moto, conozco la zona bien',
        status: 'pending',
        driver: { fullName: 'Juan Carlos Rodríguez', vehicleType: 'motorcycle' },
      });

      // Mock merchant profile for notification
      prisma.merchantProfile.findUnique.mockResolvedValueOnce({
        id: MERCHANT_PROFILE_ID,
        userId: MERCHANT_USER_ID,
      });

      const proposal1 = await ordersService.submitProposal(ORDER_ID, DRIVER_USER_ID, {
        estimatedArrival: '30 minutos',
        message: 'Llevo moto, conozco la zona bien',
      });

      expect(proposal1.estimatedArrival).toBe('30 minutos');
      expect(proposal1.driver.fullName).toBe('Juan Carlos Rodríguez');

      // Driver 2 (Fran - carro) submits proposal
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_2_PROFILE_ID,
        userId: DRIVER_2_USER_ID,
        fullName: 'Fran Chen',
        vehicleType: 'car',
      });

      prisma.driverProposal.create.mockResolvedValue({
        id: 'proposal-2',
        orderId: ORDER_ID,
        driverId: DRIVER_2_PROFILE_ID,
        estimatedArrival: '20 minutos',
        message: 'Llevo carro, puedo llevar más paquetes',
        status: 'pending',
        driver: { fullName: 'Fran Chen', vehicleType: 'car' },
      });

      // Mock merchant profile for notification
      prisma.merchantProfile.findUnique.mockResolvedValueOnce({
        id: MERCHANT_PROFILE_ID,
        userId: MERCHANT_USER_ID,
      });

      const proposal2 = await ordersService.submitProposal(ORDER_ID, DRIVER_2_USER_ID, {
        estimatedArrival: '20 minutos',
        message: 'Llevo carro, puedo llevar más paquetes',
      });

      expect(proposal2.estimatedArrival).toBe('20 minutos');
      expect(proposal2.driver.fullName).toBe('Fran Chen');

      // Merchant notified of both proposals
      expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
        MERCHANT_USER_ID,
        'order:proposalReceived',
        expect.any(Object),
      );
    });

    it('Step 3: Merchant accepts Juan Carlos proposal', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: 'driver_proposals',
        merchantId: MERCHANT_PROFILE_ID,
        merchant: { userId: MERCHANT_USER_ID },
      });

      prisma.driverProposal.findUnique.mockResolvedValue({
        id: 'proposal-1',
        orderId: ORDER_ID,
        driverId: DRIVER_PROFILE_ID,
        status: 'pending',
        driver: {
          userId: DRIVER_USER_ID,
          fullName: 'Juan Carlos Rodríguez',
        },
      });

      prisma.driverProposal.update.mockResolvedValue({ id: 'proposal-1', status: 'accepted' });
      prisma.driverProposal.updateMany.mockResolvedValue({ count: 1 });

      const assignedOrder = {
        id: ORDER_ID,
        status: 'assigned',
        driverId: DRIVER_PROFILE_ID,
        assignedAt: new Date(),
        merchant: { userId: MERCHANT_USER_ID },
        driver: { userId: DRIVER_USER_ID, fullName: 'Juan Carlos Rodríguez' },
      };
      prisma.order.update.mockResolvedValue(assignedOrder);
      (prisma as any).$transaction = jest.fn(async (cb: any) =>
        cb({
          driverProposal: prisma.driverProposal,
          order: {
            ...prisma.order,
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue(assignedOrder),
          },
        }),
      );

      // Mock rejected proposals for notification
      prisma.driverProposal.findMany.mockResolvedValue([
        {
          id: 'proposal-2',
          driver: { userId: DRIVER_2_USER_ID },
          status: 'rejected',
        },
      ]);

      const result = await ordersService.acceptProposal(ORDER_ID, 'proposal-1', MERCHANT_USER_ID);

      expect(result.status).toBe('assigned');
      expect(result.driverId).toBe(DRIVER_PROFILE_ID);

      // Winning driver notified
      expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
        DRIVER_USER_ID,
        'order:proposalAccepted',
        expect.objectContaining({ orderId: ORDER_ID }),
      );

      // Losing driver notified
      expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
        DRIVER_2_USER_ID,
        'order:proposalRejected',
        expect.objectContaining({ orderId: ORDER_ID }),
      );
    });

    it('Should reject proposal acceptance from wrong merchant', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        merchant: { userId: 'wrong-merchant-id' },
      });

      await expect(
        ordersService.acceptProposal(ORDER_ID, 'proposal-1', MERCHANT_USER_ID),
      ).rejects.toThrow('No puedes aceptar propuestas de otros pedidos');
    });
  });

  describe('🔴 Error Cases', () => {
    it('Should reject order creation if merchant not found', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue(null);

      await expect(
        ordersService.create('non-existent-user', {
          pickupAddress: 'Nicoya',
          deliveryAddress: 'San José',
          items: [],
        }),
      ).rejects.toThrow('Perfil de comerciante no encontrado');
    });

    it('Should reject accepting a non-pending order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: 'delivered', // Already delivered
        merchant: { userId: MERCHANT_USER_ID },
      });

      await expect(ordersService.acceptOrderAsDriver(ORDER_ID, DRIVER_USER_ID)).rejects.toThrow(
        'El pedido ya fue tomado por otro repartidor',
      );
    });

    it('Should reject invalid status transitions', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: 'pending',
        merchant: { userId: MERCHANT_USER_ID },
        driver: { userId: DRIVER_USER_ID },
      });

      // Can't go from pending directly to delivered
      await expect(
        ordersService.updateStatus(ORDER_ID, 'delivered', DRIVER_USER_ID),
      ).rejects.toThrow('No se puede cambiar de pending a delivered');
    });

    it('Should reject proposals on non-scheduled orders', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        orderType: 'immediate', // Not scheduled
      });

      await expect(
        ordersService.submitProposal(ORDER_ID, DRIVER_USER_ID, {
          estimatedArrival: '30 min',
        }),
      ).rejects.toThrow('Solo puedes proponer en pedidos programados');
    });

    it('Should reject driver without profile', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: 'pending',
      });

      prisma.driverProfile.findUnique.mockResolvedValue(null);

      await expect(ordersService.acceptOrderAsDriver(ORDER_ID, 'user-no-profile')).rejects.toThrow(
        'Perfil de repartidor no encontrado',
      );
    });

    it('Should reject order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(ordersService.findById('non-existent-order', MERCHANT_USER_ID)).rejects.toThrow(
        'Pedido no encontrado',
      );
    });

    it('Should reject access to order by unauthorized user', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        merchant: { userId: MERCHANT_USER_ID },
        driver: { userId: DRIVER_USER_ID },
      });

      await expect(ordersService.findById(ORDER_ID, 'unauthorized-user')).rejects.toThrow(
        'No tienes acceso a este pedido',
      );
    });
  });

  describe('📊 Order Queries', () => {
    it('Merchant should see their orders', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: MERCHANT_PROFILE_ID,
        userId: MERCHANT_USER_ID,
      });

      prisma.order.findMany.mockResolvedValue([
        { id: 'order-1', status: 'delivered', totalAmount: 1500 },
        { id: 'order-2', status: 'pending', totalAmount: 800 },
        { id: 'order-3', status: 'assigned', totalAmount: 2000 },
      ]);

      const result = await ordersService.findByMerchant(MERCHANT_USER_ID);
      expect(result).toHaveLength(3);
    });

    it('Merchant should be able to filter by status', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: MERCHANT_PROFILE_ID,
        userId: MERCHANT_USER_ID,
      });

      prisma.order.findMany.mockResolvedValue([
        { id: 'order-2', status: 'pending', totalAmount: 800 },
      ]);

      const result = await ordersService.findByMerchant(MERCHANT_USER_ID, 'pending');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('Driver should see their assigned orders', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: DRIVER_PROFILE_ID,
        userId: DRIVER_USER_ID,
      });

      prisma.order.findMany.mockResolvedValue([
        { id: 'order-1', status: 'assigned', merchant: { businessName: 'Bowl & Café' } },
      ]);

      const result = await ordersService.findByDriver(DRIVER_USER_ID, 'assigned');
      expect(result).toHaveLength(1);
    });
  });
});
