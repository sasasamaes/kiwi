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
});
