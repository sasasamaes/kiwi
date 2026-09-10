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
});
