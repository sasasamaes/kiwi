// Mock the problematic ESM modules before anything else
jest.mock('@nestjs/websockets', () => ({}), { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });

// Create a mock EventsGateway class
const mockEventsGateway = {
  notifyNewOrder: jest.fn(),
  notifyOrderUpdate: jest.fn(),
  broadcast: jest.fn(),
  sendToRole: jest.fn(),
  handleConnection: jest.fn(),
  handleDisconnect: jest.fn(),
};

jest.mock('../events/events.gateway', () => ({
  EventsGateway: jest.fn().mockImplementation(() => mockEventsGateway),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      merchantProfile: {
        findUnique: jest.fn(),
      },
      menuItem: {
        findMany: jest.fn(),
      },
      orderItem: {
        create: jest.fn(),
      },
    };

    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: DriversService, useValue: { getLocation: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('create', () => {
    it('should create an order successfully', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
        latitude: 10.0,
        longitude: -85.0,
      });

      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Bowl Tropikal', price: 4500, merchantId: 'merchant-1' },
      ]);

      prisma.order.create.mockResolvedValue({
        id: 'order-1',
        merchantId: 'merchant-1',
        status: 'pending',
        totalAmount: 4500,
        basePrice: 4500,
        commission: 900,
        driverPayout: 3600,
      });

      prisma.orderItem.create.mockResolvedValue({});

      const result = await service.create('user-1', {
        pickupAddress: 'Nicoya, Guanacaste',
        deliveryAddress: 'Barrio Los Ángeles',
        items: [{ menuItemId: 'item-1', quantity: 1, notes: '' }],
        specialInstructions: 'Sin cebolla',
      });

      expect(result.id).toBe('order-1');
      expect(result.status).toBe('pending');
      expect(prisma.order.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if merchant not found', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.create('non-existent', {
          pickupAddress: 'Nicoya',
          deliveryAddress: 'San José',
          items: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject invalid orderType, addresses, distance and dates', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });

      const base = { pickupAddress: 'A', deliveryAddress: 'B' };

      await expect(service.create('user-1', { ...base, orderType: 'express' })).rejects.toThrow(
        'orderType inválido',
      );
      await expect(service.create('user-1', { deliveryAddress: 'B' })).rejects.toThrow(
        'pickupAddress y deliveryAddress son requeridos',
      );
      await expect(service.create('user-1', { ...base, distanceKm: -5 })).rejects.toThrow(
        'distanceKm inválido',
      );
      await expect(service.create('user-1', { ...base, distanceKm: 9999 })).rejects.toThrow(
        'distanceKm fuera de rango',
      );
      await expect(
        service.create('user-1', { ...base, scheduledDate: 'not-a-date' }),
      ).rejects.toThrow('scheduledDate inválida');
      await expect(service.create('user-1', { ...base, orderType: 'scheduled' })).rejects.toThrow(
        'requieren scheduledDate',
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });
  });

  describe('Nicoya centro flat rate (₡2000 within 10 km)', () => {
    const merchant = { id: 'merchant-1', userId: 'user-1', businessName: 'Soda Nicoya' };

    beforeEach(() => {
      prisma.merchantProfile.findUnique.mockResolvedValue(merchant);
      prisma.order.create.mockImplementation(async ({ data }: any) => ({ id: 'order-1', ...data }));
    });

    it('charges flat ₡2000 for short trips inside the zone', async () => {
      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque de Nicoya',
        pickupLat: 10.1467,
        pickupLng: -85.452,
        deliveryAddress: 'Barrio San Martín',
        deliveryLat: 10.15,
        deliveryLng: -85.455,
        distanceKm: 1.2,
      });

      expect(order.basePrice).toBe(2000);
      expect(order.totalAmount).toBe(2200);
    });

    it('charges flat ₡2000 without coords when distance is within the zone', async () => {
      const order: any = await service.create('user-1', {
        pickupAddress: 'Nicoya Centro',
        deliveryAddress: 'Barrio Los Ángeles',
        distanceKm: 2.5,
      });

      expect(order.basePrice).toBe(2000);
    });

    it('uses distance pricing outside the zone', async () => {
      const order: any = await service.create('user-1', {
        pickupAddress: 'Santa Cruz',
        pickupLat: 10.2617,
        pickupLng: -85.584,
        deliveryAddress: 'Santa Cruz centro',
        deliveryLat: 10.265,
        deliveryLng: -85.59,
        distanceKm: 2.5,
      });

      expect(order.basePrice).toBe(1500);
    });
  });

  describe('getAvailableOrders', () => {
    it('should return available orders for drivers', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'order-1', status: 'pending', totalAmount: 5000 },
        { id: 'order-2', status: 'pending', totalAmount: 3000 },
      ]);

      const result = await service.getAvailableOrders();
      expect(result).toHaveLength(2);
    });
  });

  describe('flete pricing (trip + 10pct)', () => {
    beforeEach(() => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Soda Nicoya',
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        ...data,
      }));
    });

    it('flete en zona: 2000 + 200, driver recibe 2000', async () => {
      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque Nicoya',
        pickupLat: 10.1467,
        pickupLng: -85.452,
        deliveryAddress: 'Barrio San Martín',
        deliveryLat: 10.15,
        deliveryLng: -85.455,
        distanceKm: 2,
        kind: 'freight',
        packageDescription: 'Caja con repuestos',
        packageSize: 'M',
      });
      expect(order.basePrice).toBe(2000);
      expect(order.commission).toBe(200);
      expect(order.driverPayout).toBe(2000);
      expect(order.totalAmount).toBe(2200);
    });

    it('encomienda por peso: 12kg suma ₡3500 por 7kg extra', async () => {
      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque Nicoya',
        pickupLat: 10.1467,
        pickupLng: -85.452,
        deliveryAddress: 'Barrio San Martín',
        deliveryLat: 10.15,
        deliveryLng: -85.455,
        distanceKm: 2,
        kind: 'freight',
        packageDescription: 'Caja pesada',
        weightKg: 12,
      });
      // 2000 viaje + 7*500 peso = 5500; comisión 10% = 550; driver = 5500
      expect(order.basePrice).toBe(5500);
      expect(order.commission).toBe(550);
      expect(order.driverPayout).toBe(5500);
      expect(order.totalAmount).toBe(6050);
    });

    it('rechaza weightKg inválido', async () => {
      const base = {
        pickupAddress: 'Parque Nicoya',
        deliveryAddress: 'Barrio San Martín',
        distanceKm: 2,
        kind: 'freight',
        packageDescription: 'Caja',
      };
      await expect(service.create('user-1', { ...base, weightKg: -3 })).rejects.toThrow(
        'weightKg inválido',
      );
      await expect(service.create('user-1', { ...base, weightKg: 9999 })).rejects.toThrow(
        'weightKg inválido',
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rechaza items del menú que no pertenecen al comercio', async () => {
      prisma.menuItem.findMany.mockResolvedValue([]);
      await expect(
        service.create('user-1', {
          pickupAddress: 'A',
          deliveryAddress: 'B',
          kind: 'food',
          items: [{ menuItemId: 'otro-comercio', quantity: 1 }],
        }),
      ).rejects.toThrow('Producto del menú no válido');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('comida en zona: productos pass-through sin comision', async () => {
      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque Nicoya',
        deliveryAddress: 'Barrio San Martín',
        distanceKm: 2.5,
        kind: 'food',
        productsTotal: 5000,
      });
      expect(order.basePrice).toBe(2000);
      expect(order.commission).toBe(200);
      expect(order.totalAmount).toBe(7200);
    });

    it('rechaza kind invalido y productsTotal negativo', async () => {
      const base = { pickupAddress: 'A', deliveryAddress: 'B' };
      await expect(service.create('user-1', { ...base, kind: 'drone' })).rejects.toThrow(
        'kind inválido',
      );
      await expect(service.create('user-1', { ...base, productsTotal: -100 })).rejects.toThrow(
        'productsTotal inválido',
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });
  });

  describe('getOrderMessages', () => {
    beforeEach(() => {
      prisma.notification = { findMany: jest.fn() };
    });

    const participantOrder = {
      id: 'order-1',
      merchant: { userId: 'merchant-1' },
      driver: { userId: 'driver-1' },
    };

    it('devuelve historial al participante con flag mine', async () => {
      prisma.order.findUnique.mockResolvedValue(participantOrder);
      prisma.notification.findMany.mockResolvedValue([
        {
          id: 'm1',
          body: 'Voy en camino',
          createdAt: new Date(),
          data: { orderId: 'order-1', senderId: 'driver-1', senderRole: 'driver' },
        },
      ]);

      const messages = await service.getOrderMessages('order-1', 'merchant-1');

      expect(messages).toHaveLength(1);
      expect(messages[0].text).toBe('Voy en camino');
      expect(messages[0].mine).toBe(false);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ type: 'chat' }) }),
      );
    });

    it('niega acceso a terceros', async () => {
      prisma.order.findUnique.mockResolvedValue(participantOrder);

      await expect(service.getOrderMessages('order-1', 'outsider-9')).rejects.toThrow();
      expect(prisma.notification.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getPublicTracking', () => {
    it('expone solo campos compartibles (sin PII ni montos)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'in_transit_to_delivery',
        orderType: 'immediate',
        pickupAddress: 'Tienda',
        pickupLat: '10.1',
        pickupLng: '-85.4',
        deliveryAddress: 'Casa',
        deliveryLat: null,
        deliveryLng: null,
        driverId: 'dp-1',
        merchant: { businessName: 'Bowl & Café' },
        driver: { fullName: 'Juan', vehicleType: 'motorcycle', rating: '4.9' },
        items: [{ name: 'Bowl', quantity: 2 }],
        createdAt: new Date(),
        assignedAt: new Date(),
        pickedUpAt: null,
        deliveredAt: null,
      });

      const dto: any = await service.getPublicTracking('order-1');

      expect(dto.id).toBe('order-1');
      expect(dto.merchantName).toBe('Bowl & Café');
      expect(dto.driver.fullName).toBe('Juan');
      expect(dto.pickupLat).toBe(10.1);
      expect(dto).not.toHaveProperty('driverPayout');
      expect(dto).not.toHaveProperty('totalAmount');
      expect(JSON.stringify(dto)).not.toContain('8888');
    });

    it('404 en pedido inexistente', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.getPublicTracking('missing')).rejects.toThrow(NotFoundException);
    });

    it('ubicación 404 sin repartidor y datos con repartidor', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1', driverId: null });
      await expect(service.getPublicDriverLocation('order-1')).rejects.toThrow(NotFoundException);

      prisma.order.findUnique.mockResolvedValue({ id: 'order-1', driverId: 'dp-1' });
      const driversService = (service as any).driversService;
      driversService.getLocation.mockResolvedValue({
        lat: 10.2,
        lng: -85.5,
        updatedAt: new Date(),
        isStale: false,
        known: true,
      });

      const loc: any = await service.getPublicDriverLocation('order-1');
      expect(loc.lat).toBe(10.2);
      expect(loc).not.toHaveProperty('driverId');
    });
  });
});
