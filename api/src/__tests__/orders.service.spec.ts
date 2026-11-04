// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
// Mock the problematic ESM modules before anything else
jest.mock('@nestjs/websockets', () => ({}), { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });

// Create a mock EventsGateway class
const mockEventsGateway = {
  notifyNewOrder: jest.fn(),
  notifyOrderUpdate: jest.fn(),
  broadcast: jest.fn(),
  sendToRole: jest.fn(),
  sendToUser: jest.fn(),
  handleConnection: jest.fn(),
  handleDisconnect: jest.fn(),
};

jest.mock('../events/events.gateway', () => ({
  EventsGateway: jest.fn().mockImplementation(() => mockEventsGateway),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { ZonesService } from '../zones/zones.service';
import { CoverageService } from '../service-area/coverage.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { ProximityService } from '../orders/proximity.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;
  let coverageMock: { recordInterest: jest.Mock };
  let zonesMock: any;
  let settingsStub: {
    getDriverCommissionPct: jest.Mock;
    getHomeCookCommissionPct: jest.Mock;
    getTestDriverEmails: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      order: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      merchantProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      creditTransaction: {
        create: jest.fn(),
      },
      menuItem: {
        findMany: jest.fn(),
      },
      menuItemVariantOption: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      driverProfile: {
        findUnique: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderItem: {
        create: jest.fn(),
      },
      // updateStatus corre en transacción interactiva (claim + refund).
      $transaction: jest.fn((fn: any) => fn(prisma)),
      // claimWithCapacity: lock de aviso dentro de la tx.
      $executeRaw: jest.fn().mockResolvedValue([]),
    };

    jest.clearAllMocks();

    settingsStub = {
      getDriverCommissionPct: jest.fn().mockResolvedValue(15),
      getHomeCookCommissionPct: jest.fn().mockResolvedValue(5),
      getTestDriverEmails: jest.fn().mockResolvedValue(['pilot@kiwi.app']),
    };

    coverageMock = { recordInterest: jest.fn().mockResolvedValue(undefined) };

    zonesMock = {
      list: jest.fn().mockResolvedValue([]),
      listAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
      resolvePriceAt: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: ZonesService,
          useValue: zonesMock,
        },
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: DriversService, useValue: { getLocation: jest.fn() } },
        {
          provide: ProximityService,
          useValue: {
            findNearbyDrivers: jest
              .fn()
              .mockResolvedValue({ candidates: null, radiusUsedKm: 12, staleSkipped: 0 }),
          },
        },
        {
          provide: GeocodingService,
          useValue: { searchCostaRica: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NotificationsService,
          useValue: {
            notifyNewOrderTopic: jest.fn().mockResolvedValue({ delivered: 0, inbox: 0 }),
            notifyDriverNewOrderTargeted: jest.fn().mockResolvedValue({ delivered: true }),
            notifyOrderAccepted: jest.fn().mockResolvedValue({}),
            notifyOrderStatusUpdate: jest.fn().mockResolvedValue({}),
            notifyOrderRejected: jest.fn().mockResolvedValue({}),
            notifyMerchantNewOrder: jest.fn().mockResolvedValue({}),
            notifyAssignmentOffered: jest.fn().mockResolvedValue({}),
            notifyContestStarted: jest.fn().mockResolvedValue({}),
            notifyNoDriverAvailable: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: SettingsService, useValue: settingsStub },
        {
          provide: CoverageService,
          useValue: coverageMock,
        },
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

    it('snapshottea el kiosko en la línea del pedido (lista de compras)', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Mercadito',
      });
      prisma.menuItem.findMany.mockResolvedValue([
        {
          id: 'item-k',
          name: 'Cuajada',
          price: 2000,
          merchantId: 'merchant-1',
          kiosk: { name: 'Kiosko Ana' },
        },
      ]);
      prisma.order.create.mockResolvedValue({ id: 'order-9' });

      await service.create('user-1', {
        pickupAddress: 'Mercadito',
        deliveryAddress: 'Centro',
        items: [{ menuItemId: 'item-k', quantity: 2 }],
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: [expect.objectContaining({ menuItemId: 'item-k', kioskName: 'Kiosko Ana' })],
            },
          }),
        }),
      );
    });

    it('notifica al comercio con order:new (socket 1:1) al crear el pedido', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
        latitude: 10.0,
        longitude: -85.0,
      });
      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Bowl', price: 4500, merchantId: 'merchant-1' },
      ]);
      prisma.order.create.mockResolvedValue({
        id: 'order-1',
        merchantId: 'merchant-1',
        status: 'pending',
        totalAmount: 4500,
        orderType: 'immediate',
      });
      prisma.orderItem.create.mockResolvedValue({});
      mockEventsGateway.sendToUser.mockClear();

      await service.create('user-1', {
        pickupAddress: 'Nicoya',
        deliveryAddress: 'Barrio Los Ángeles',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
        paymentMethod: 'cash',
      });

      expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
        'user-1',
        'order:new',
        expect.objectContaining({ orderId: 'order-1' }),
      );
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

    it('programar para hoy más tarde valida fecha+hora (no solo la medianoche)', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });
      prisma.order.create.mockResolvedValue({ id: 'sched-1', status: 'driver_proposals' });
      // Pared CR real (el backend lee sin-offset como CR), da igual el TZ del runner.
      const crParts = (d: Date) => {
        const p = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Costa_Rica',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
          .formatToParts(d)
          .reduce<Record<string, string>>((acc, x) => {
            if (x.type !== 'literal') acc[x.type] = x.value;
            return acc;
          }, {});
        return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
      };
      // +3h garantiza futuro; -3h garantiza pasado.
      const future = new Date(Date.now() + 3 * 3600_000);

      const f = crParts(future);
      const res: any = await service.create('user-1', {
        pickupAddress: 'A',
        deliveryAddress: 'B',
        orderType: 'scheduled',
        scheduledDate: f.day,
        scheduledTime: f.time,
        paymentMethod: 'cash',
      });
      expect(res.status).toBe('driver_proposals');
      expect(prisma.order.create).toHaveBeenCalled();

      // Ya pasada (fecha+hora) se rechaza con el mensaje conocido.
      const p = crParts(new Date(Date.now() - 3 * 3600_000));
      await expect(
        service.create('user-1', {
          pickupAddress: 'A',
          deliveryAddress: 'B',
          orderType: 'scheduled',
          scheduledDate: p.day,
          scheduledTime: p.time,
        }),
      ).rejects.toThrow('ya pasó');
    });

    it('readyInMinutes fija readyAt = ahora + N (solo 15/20/30)', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Pizzería',
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        status: 'pending',
        ...data,
      }));
      const before = Date.now();
      const order: any = await service.create('user-1', {
        pickupAddress: 'Nicoya Centro',
        deliveryAddress: 'Barrio Los Ángeles',
        deliveryZone: 'centro',
        distanceKm: 1,
        readyInMinutes: 20,
        paymentMethod: 'cash',
      });
      const ms = new Date(order.readyAt).getTime() - before;
      expect(ms).toBeGreaterThanOrEqual(20 * 60 * 1000 - 5000);
      expect(ms).toBeLessThanOrEqual(20 * 60 * 1000 + 5000);
      expect(order.status).toBe('pending');
    });

    it('readyInMinutes rechaza valores fuera de la allowlist y programados', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Pizzería',
      });
      await expect(
        service.create('user-1', {
          pickupAddress: 'A',
          deliveryAddress: 'B',
          readyInMinutes: 10,
        }),
      ).rejects.toThrow('readyInMinutes inválido');
      await expect(
        service.create('user-1', {
          pickupAddress: 'A',
          deliveryAddress: 'B',
          orderType: 'scheduled',
          scheduledDate: '2099-01-01',
          scheduledTime: '12:00',
          readyInMinutes: 15,
        }),
      ).rejects.toThrow('solo para pedidos inmediatos');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should price by deliveryZone catalog (server is source of truth)', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        status: 'pending',
        ...data,
      }));

      const order: any = await service.create('user-1', {
        pickupAddress: 'Nicoya Centro',
        deliveryAddress: 'Hojancha centro',
        deliveryZone: 'hojancha',
        distanceKm: 1,
        payWithCredit: true,
      });

      // Viaje ₡7000 sin productos: el comercio paga el viaje (₡7000); Kiwi
      // descuenta el 15% del payout del repartidor (₡1050).
      expect(order.deliveryZone).toBe('hojancha');
      expect(order.basePrice).toBe(7000);
      expect(order.driverPayout).toBe(5950);
      expect(order.commission).toBe(1050);
      expect(order.commissionRate).toBe(0.15);
      expect(order.totalAmount).toBe(7000);
    });

    it('el medio de pago no cambia el cargo: sin productos no hay cargo extra', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        status: 'pending',
        ...data,
      }));

      const order: any = await service.create('user-1', {
        pickupAddress: 'Nicoya Centro',
        deliveryAddress: 'Hojancha centro',
        deliveryZone: 'hojancha',
        distanceKm: 1,
      });

      // Viaje ₡7000 sin productos: el comercio paga ₡7000; Kiwi descuenta
      // el 15% (₡1050) del payout del repartidor.
      expect(order.commission).toBe(1050);
      expect(order.commissionRate).toBe(0.15);
      expect(order.totalAmount).toBe(7000);
      expect(order.driverPayout).toBe(5950);
    });

    it('la tasa del admin manda: 20% configured → corte del payout con 20%, total sin recargo', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        status: 'pending',
        ...data,
      }));
      settingsStub.getDriverCommissionPct.mockResolvedValue(20);

      const order: any = await service.create('user-1', {
        pickupAddress: 'Nicoya Centro',
        deliveryAddress: 'Hojancha centro',
        deliveryZone: 'hojancha',
        distanceKm: 1,
      });

      expect(order.commissionRate).toBe(0.2);
      expect(order.commission).toBe(1400);
      expect(order.driverPayout).toBe(5600);
      expect(order.totalAmount).toBe(7000);
    });

    it('rechaza pedido test si el comercio no tiene el modo habilitado', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
        testOrdersEnabled: false,
        testOrdersUntil: null,
      });

      await expect(
        service.create('user-1', {
          pickupAddress: 'Nicoya Centro',
          deliveryAddress: 'Hojancha centro',
          deliveryZone: 'hojancha',
          distanceKm: 1,
          isTest: true,
        }),
      ).rejects.toThrow('modo prueba');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rechaza pedido test vencido aunque el flag siga prendido', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
        testOrdersEnabled: true,
        testOrdersUntil: new Date(Date.now() - 1000),
      });

      await expect(
        service.create('user-1', {
          pickupAddress: 'Nicoya Centro',
          deliveryAddress: 'Hojancha centro',
          deliveryZone: 'hojancha',
          distanceKm: 1,
          isTest: true,
        }),
      ).rejects.toThrow('modo prueba');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('el pedido test nace en efectivo, sin gateo y marcado isTest', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
        testOrdersEnabled: true,
        testOrdersUntil: new Date(Date.now() + 3600_000),
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        status: 'pending',
        ...data,
      }));

      const order: any = await service.create('user-1', {
        pickupAddress: 'Nicoya Centro',
        deliveryAddress: 'Hojancha centro',
        deliveryZone: 'hojancha',
        distanceKm: 1,
        paymentMethod: 'weekly_invoice',
        isTest: true,
      });

      expect(order.isTest).toBe(true);
      // Efectivo forzado: sin gateo de pago aunque pidiera factura semanal.
      expect(order.status).toBe('pending');
      expect(order.basePrice).toBe(7000);
    });

    it('rechaza asignar un pedido test a un repartidor que no es piloto', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
        testOrdersEnabled: true,
        testOrdersUntil: new Date(Date.now() + 3600_000),
      });
      prisma.driverProfile.findUnique.mockResolvedValue({
        id: 'driver-1',
        userId: 'user-not-pilot',
        fullName: 'Repartidor X',
        status: 'available',
        kycStatus: 'approved',
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'user-pilot' }]);

      await expect(
        service.create('user-1', {
          pickupAddress: 'Nicoya Centro',
          deliveryAddress: 'Hojancha centro',
          deliveryZone: 'hojancha',
          distanceKm: 1,
          driverId: 'driver-1',
          isTest: true,
        }),
      ).rejects.toThrow('piloto');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('traslado: rechaza si la sede origen no tiene traslados habilitados', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'sede-a',
        userId: 'user-1',
        businessName: 'Farmacia Centro',
        address: 'Nicoya centro',
        transfersEnabled: false,
        parentMerchantId: null,
      });

      await expect(
        service.createTransfer('user-1', {
          toMerchantId: 'sede-b',
          packageDescription: '2 cajas',
          deliveryZone: 'hojancha',
        }),
      ).rejects.toThrow('traslados no están habilitados');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('traslado: rechaza destino de otra cadena', async () => {
      prisma.merchantProfile.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.userId)
          return {
            id: 'sede-a',
            userId: 'user-1',
            businessName: 'Farmacia Centro',
            address: 'Nicoya centro',
            transfersEnabled: true,
            parentMerchantId: 'matriz-1',
          };
        return {
          id: 'otra',
          businessName: 'Otra farmacia',
          address: 'Liberia',
          transfersEnabled: true,
          parentMerchantId: 'matriz-2',
        };
      });

      await expect(
        service.createTransfer('user-1', {
          toMerchantId: 'otra',
          packageDescription: '2 cajas',
          deliveryZone: 'hojancha',
        }),
      ).rejects.toThrow('misma cadena');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('traslado: crea pedido kind transfer a la sede hermana, sin venta', async () => {
      prisma.merchantProfile.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.userId)
          return {
            id: 'sede-a',
            userId: 'user-1',
            businessName: 'Farmacia Centro',
            address: 'Nicoya centro',
            transfersEnabled: true,
            parentMerchantId: 'matriz-1',
          };
        return {
          id: 'sede-b',
          businessName: 'Farmacia San Martín',
          address: 'San Martín',
          transfersEnabled: true,
          parentMerchantId: 'matriz-1',
        };
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        status: 'pending',
        ...data,
      }));

      const order: any = await service.createTransfer('user-1', {
        toMerchantId: 'sede-b',
        packageDescription: '2 cajas de acetaminofén',
        deliveryZone: 'hojancha',
      });

      expect(order.kind).toBe('transfer');
      expect(order.transferToMerchantId).toBe('sede-b');
      expect(order.productsTotal).toBe(0);
      expect(order.customerName).toBe('Farmacia San Martín');
      expect(order.pickupAddress).toBe('Nicoya centro');
      expect(order.deliveryAddress).toBe('San Martín');
    });

    it('should reject unknown deliveryZone', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });

      await expect(
        service.create('user-1', {
          pickupAddress: 'A',
          deliveryAddress: 'B',
          deliveryZone: 'barrio-inexistente',
        }),
      ).rejects.toThrow('Barrio de entrega inválido');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should match catalog slugs against DB labels (los-angeles → Los Ángeles)', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        status: 'pending',
        ...data,
      }));
      zonesMock.list.mockResolvedValueOnce([
        { id: 'uuid-los-angeles', label: 'Los Ángeles', price: 1500 },
      ]);

      const order: any = await service.create('user-1', {
        pickupAddress: 'Nicoya Centro',
        deliveryAddress: 'Los Ángeles, frente a la plaza',
        deliveryZone: 'los-angeles',
        distanceKm: 3,
      });

      expect(order.deliveryZone).toBe('uuid-los-angeles');
    });

    it('gates non-cash orders in awaiting_payment without alerting drivers', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        ...data,
      }));
      mockEventsGateway.sendToUser.mockClear();

      const order: any = await service.create('user-1', {
        pickupAddress: 'Nicoya Centro',
        deliveryAddress: 'Barrio Los Ángeles',
        distanceKm: 1,
        paymentMethod: 'card',
      });

      expect(order.status).toBe('awaiting_payment');
      expect(order.contestStartedAt).toBeUndefined();
      expect(mockEventsGateway.sendToUser).not.toHaveBeenCalled();
    });

    it('cash orders skip the payment gate', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        ...data,
      }));

      const order: any = await service.create('user-1', {
        pickupAddress: 'Nicoya Centro',
        deliveryAddress: 'Barrio Los Ángeles',
        distanceKm: 1,
        paymentMethod: 'cash',
      });

      expect(order.status).toBe('pending');
      expect(order.contestStartedAt).toBeInstanceOf(Date);
    });

    it('releaseAwaitingPayment moves a paid order to contest and alerts', async () => {
      const gated = {
        id: 'order-9',
        status: 'awaiting_payment',
        merchantId: 'merchant-1',
        driverId: null,
        orderType: 'immediate',
        pickupAddress: 'A',
        deliveryAddress: 'B',
        totalAmount: 3000,
        driverPayout: 1500,
        distanceKm: 2,
        createdAt: new Date(),
      };
      prisma.order.findUnique.mockResolvedValue(gated);
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockEventsGateway.sendToUser.mockClear();

      const out: any = await service.releaseAwaitingPayment('order-9');

      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-9', status: 'awaiting_payment' },
        }),
      );
      expect(out.status).toBe('pending');
      expect(mockEventsGateway.sendToUser).toHaveBeenCalledWith(
        'merchant-1',
        'order:new',
        expect.objectContaining({ orderId: 'order-9' }),
      );
    });

    it('releaseAwaitingPayment is a no-op when already released', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-9', status: 'pending' });
      prisma.order.updateMany.mockClear();

      expect(await service.releaseAwaitingPayment('order-9')).toBeNull();
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('drivers cannot accept awaiting_payment orders', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-9', status: 'awaiting_payment' });

      await expect(service.acceptOrderAsDriver('order-9', 'user-d')).rejects.toThrow(
        'aún no está pagado',
      );
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
        payWithCredit: true,
      });

      expect(order.basePrice).toBe(2000);
      expect(order.totalAmount).toBe(2000); // el comercio paga el viaje, sin recargo
      expect(order.commission).toBe(300);
      expect(order.driverPayout).toBe(1700);
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

      // Server measures ~0.75 km between coords (not the claimed 2.5).
      expect(order.basePrice).toBe(800);
    });
  });

  describe('Cobertura operativa (solo Nicoya y alrededores)', () => {
    const merchant = { id: 'merchant-1', userId: 'user-1', businessName: 'Soda Nicoya' };

    beforeEach(() => {
      prisma.merchantProfile.findUnique.mockResolvedValue(merchant);
      prisma.order.create.mockImplementation(async ({ data }: any) => ({ id: 'order-1', ...data }));
    });

    it('bloquea entrega en San José y anota el interés', async () => {
      await expect(
        service.create('user-1', {
          pickupAddress: 'Soda Nicoya',
          pickupLat: 10.1467,
          pickupLng: -85.452,
          deliveryAddress: 'San José centro',
          deliveryLat: 9.9281,
          deliveryLng: -84.0907,
          distanceKm: 200,
          customerEmail: 'sj@x.com',
        }),
      ).rejects.toThrow('Todavía no llegamos a tu zona');
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(coverageMock.recordInterest).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'order-blocked' }),
      );
    });

    it('permite entrega dentro del área (Nicoya)', async () => {
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
    });

    it('el polígono del GPS prevalece sobre el barrio elegido (antifraude)', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Soda Nicoya',
      });
      zonesMock.resolvePriceAt.mockResolvedValue({
        source: 'polygon',
        zone: { id: 'zona-cara', label: 'Zona Cara', price: 5000 },
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({ id: 'o1', ...data }));
      const order: any = await service.create('user-1', {
        pickupAddress: 'Soda Nicoya',
        pickupLat: 10.1467,
        pickupLng: -85.452,
        deliveryAddress: 'Zona Cara',
        deliveryLat: 10.2,
        deliveryLng: -85.44,
        deliveryZone: 'centro',
        distanceKm: 8,
      });
      expect(order.deliveryZone).toBe('zona-cara');
    });

    it('la referencia sin polígono no pisa el barrio elegido', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Soda Nicoya',
      });
      zonesMock.resolvePriceAt.mockResolvedValue({
        source: 'reference',
        zone: { id: 'zona-ref', label: 'Ref', price: 1000 },
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({ id: 'o2', ...data }));
      const order: any = await service.create('user-1', {
        pickupAddress: 'Soda Nicoya',
        pickupLat: 10.1467,
        pickupLng: -85.452,
        deliveryAddress: 'Centro',
        deliveryLat: 10.15,
        deliveryLng: -85.455,
        deliveryZone: 'centro',
        distanceKm: 1.2,
      });
      expect(order.deliveryZone).toBe('centro');
    });
  });

  describe('getAvailableOrders', () => {
    it('listForAdmin pagina, filtra y arma stats', async () => {
      prisma.order.count.mockResolvedValue(2);
      prisma.order.findMany.mockResolvedValue([{ id: 'o1' }]);
      prisma.order.aggregate.mockResolvedValue({
        _count: { id: 2 },
        _sum: { totalAmount: 10000, commission: 1500 },
      });
      prisma.order.groupBy = jest
        .fn()
        .mockResolvedValue([{ status: 'delivered', _count: { status: 2 } }]);

      const res = await service.listForAdmin({ take: 20, status: 'delivered', search: 'Nicoya' });

      expect(res.total).toBe(2);
      expect(res.stats.revenue).toBe(10000);
      expect(res.stats.platformFee).toBe(1500);
      expect(res.stats.byStatus.delivered).toBe(2);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });

    it('listForAdmin rechaza estado inválido', async () => {
      await expect(service.listForAdmin({ status: 'volando' })).rejects.toThrow('Estado inválido');
    });

    it('listForAdmin filtra por repartidor cuando se pide', async () => {
      prisma.order.count.mockResolvedValue(1);
      prisma.order.findMany.mockResolvedValue([{ id: 'o9' }]);
      prisma.order.aggregate.mockResolvedValue({
        _count: { id: 1 },
        _sum: { totalAmount: 1500, commission: 225 },
      });
      prisma.order.groupBy = jest.fn().mockResolvedValue([]);

      await service.listForAdmin({ driverId: 'dp-luis' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ driverId: 'dp-luis' }) }),
      );
    });

    it('listForAdmin ancla el rango de fechas a hora CR (no al TZ del servidor)', async () => {
      prisma.order.count.mockResolvedValue(0);
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { totalAmount: 0, commission: 0 },
      });
      prisma.order.groupBy = jest.fn().mockResolvedValue([]);

      // Caso real: pedido creado 2 nov 06:59 p. m. CR (= 3 nov 00:59 UTC).
      // Con Hasta=02/11 debe entrar: el corte es 3 nov 00:00 CR = 06:00 UTC.
      await service.listForAdmin({ from: '2026-10-26', to: '2026-11-02' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date(Date.UTC(2026, 9, 26, 6)),
              lt: new Date(Date.UTC(2026, 10, 3, 6)),
            },
          }),
        }),
      );
    });

    it('should return available orders for drivers', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'order-1', status: 'pending', totalAmount: 5000 },
        { id: 'order-2', status: 'pending', totalAmount: 3000 },
      ]);

      const result = await service.getAvailableOrders();
      expect(result).toHaveLength(2);
    });

    it('oculta el contacto del comprador en la vitrina y ordena por cercanía', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'lejos',
          status: 'pending',
          customerName: 'Ana',
          customerPhone: '88888888',
          merchant: { latitude: 11.0, longitude: -86.0 },
        },
        {
          id: 'cerca',
          status: 'pending',
          customerName: 'Luis',
          customerPhone: '87777777',
          merchant: { latitude: 10.15, longitude: -85.45 },
        },
      ]);

      const result: any[] = await service.getAvailableOrders(10.1483, -85.4527);

      expect(result.map((o) => o.id)).toEqual(['cerca', 'lejos']);
      for (const o of result) {
        expect(o.customerName).toBeUndefined();
        expect(o.customerPhone).toBeUndefined();
      }
    });
  });

  describe('flete pricing (comisión 15% del driver)', () => {
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

    it('flete en zona: el comercio paga el viaje, el 15% sale del payout del driver', async () => {
      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque Nicoya',
        pickupLat: 10.1467,
        pickupLng: -85.452,
        deliveryAddress: 'Barrio San Martín',
        deliveryLat: 10.15,
        deliveryLng: -85.455,
        distanceKm: 2,
        kind: 'freight',
        payWithCredit: true,
        packageDescription: 'Caja con repuestos',
        packageSize: 'M',
      });
      expect(order.basePrice).toBe(2000);
      expect(order.commission).toBe(300); // 15% sobre el viaje, lo paga el repartidor
      expect(order.driverPayout).toBe(1700); // viaje − 15%
      expect(order.totalAmount).toBe(2000); // el comercio paga el viaje
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
        payWithCredit: true,
        packageDescription: 'Caja pesada',
        weightKg: 12,
      });
      // 2000 viaje + 7*500 peso = 5500; Kiwi 15% = 825 del payout del driver.
      expect(order.basePrice).toBe(5500);
      expect(order.commission).toBe(825);
      expect(order.driverPayout).toBe(4675);
      expect(order.totalAmount).toBe(5500);
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

    it('comida en zona: sin cargo sobre productos ni sobre el viaje (el 15% lo paga el driver)', async () => {
      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque Nicoya',
        deliveryAddress: 'Barrio San Martín',
        distanceKm: 2.5,
        kind: 'food',
        payWithCredit: true,
        productsTotal: 5000,
      });
      // Comercio (dashboard): paga productos + viaje. Sin cargo de servicio
      // sobre productos (eso es solo en pedidos de cliente) y sin recargo
      // sobre el viaje (el 15% sale del payout del repartidor).
      expect(order.basePrice).toBe(2000);
      expect(order.commission).toBe(300); // 15% sobre el viaje
      expect(order.commissionRate).toBe(0.15);
      expect(order.driverPayout).toBe(1700);
      expect(order.totalAmount).toBe(5000 + 2000);
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

    it('usa distancia del servidor cuando hay coords (ignora spoof del cliente)', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });
      prisma.order.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'order-9', ...args.data }),
      );

      await service.create('user-1', {
        pickupAddress: 'A',
        deliveryAddress: 'B',
        pickupLat: 10.2617,
        pickupLng: -85.584,
        deliveryLat: 10.27,
        deliveryLng: -85.595,
        distanceKm: 0.1, // spoof: el servidor debe medir ~1.5 km
      });

      const stored = prisma.order.create.mock.calls[0][0].data;
      expect(stored.distanceKm).toBeGreaterThan(1);
      expect(stored.distanceKm).toBeLessThan(3);
      expect(stored.basePrice).toBe(1000); // tier ≤ 2 km
    });

    it('cobra variantes con deltas de la BD y guarda snapshot', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([{ id: 'item-1', price: 4500 }]);
      prisma.menuItemVariantOption.findMany.mockResolvedValue([
        {
          id: 'opt-big',
          name: 'Grande',
          priceDelta: 1000,
          isAvailable: true,
          group: { id: 'g1', name: 'Tamaño', menuItemId: 'item-1' },
        },
      ]);
      prisma.order.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'o1', ...args.data }),
      );
      prisma.orderItem.createMany = jest.fn().mockResolvedValue({});

      await service.create('user-1', {
        pickupAddress: 'A',
        deliveryAddress: 'B',
        items: [{ menuItemId: 'item-1', quantity: 2, variants: [{ optionId: 'opt-big' }] }],
      });

      const persisted = prisma.order.create.mock.calls[0][0].data.items.create[0];
      expect(persisted.price).toBe(5500); // 4500 + delta DB 1000 (no el del cliente)
      expect(persisted.selectedVariants).toEqual([
        { group: 'Tamaño', option: 'Grande', priceDelta: 1000 },
      ]);
    });

    it('rechaza variante ajena, no disponible o en item personalizado', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([{ id: 'item-1', price: 1000 }]);
      prisma.menuItemVariantOption.findMany.mockResolvedValue([
        {
          id: 'opt-x',
          name: 'X',
          priceDelta: 500,
          isAvailable: false,
          group: { id: 'g9', name: 'Otro', menuItemId: 'other-item' },
        },
      ]);
      const base = { pickupAddress: 'A', deliveryAddress: 'B' };

      await expect(
        service.create('user-1', {
          ...base,
          items: [{ menuItemId: 'item-1', quantity: 1, variants: [{ optionId: 'opt-x' }] }],
        }),
      ).rejects.toThrow('Variante no válida');
      await expect(
        service.create('user-1', {
          ...base,
          items: [{ name: 'Mano', price: 100, quantity: 1, variants: [{ optionId: 'opt-x' }] }],
        }),
      ).rejects.toThrow('personalizados');
    });

    it('rechaza producto fuera de su día (availableDays)', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      // Un día que NO es hoy en CR: el pedido inmediato debe rebotar.
      const { crWeekday } = jest.requireActual(
        '../common/costa-rica-time',
      ) as typeof import('../common/costa-rica-time');
      const notToday = (crWeekday(new Date()) + 1) % 7;
      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-jueves', price: 2900, availableDays: [notToday] },
      ]);

      await expect(
        service.create('user-1', {
          pickupAddress: 'A',
          deliveryAddress: 'B',
          items: [{ menuItemId: 'item-jueves', quantity: 1 }],
        }),
      ).rejects.toThrow('no se ofrece ese día');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('cocina casera: sin cargo sobre productos; el 15% standard sale del payout del driver', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        isHomeCook: true,
      });
      prisma.menuItem.findMany.mockResolvedValue([]);
      prisma.order.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'o-hc', ...args.data }),
      );

      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque Nicoya',
        deliveryAddress: 'Barrio San Martín',
        distanceKm: 2.5,
        kind: 'food',
        productsTotal: 5000,
      });

      expect(settingsStub.getHomeCookCommissionPct).toHaveBeenCalled();
      // Comercio cocina casera: la tasa del viaje sigue siendo la standard
      // (el cargo de cocina casera solo aplica a pedidos de cliente).
      expect(order.commissionRate).toBe(0.15);
      // Comercio: sin cargo de servicio sobre productos; Kiwi descuenta el 15%
      // del viaje del payout del repartidor.
      expect(order.commission).toBe(300);
      expect(order.driverPayout).toBe(1700);
      expect(order.totalAmount).toBe(5000 + 2000);
    });

    it('vía cliente (app): el cliente paga factura nominal; 15% al driver y 15% al comercio', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({
        id: 'merchant-1',
        userId: 'user-1',
        businessName: 'Bowl & Café',
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        status: 'pending',
        ...data,
      }));

      const order: any = await service.create('user-1', {
        pickupAddress: 'Nicoya Centro',
        deliveryAddress: 'Barrio Los Ángeles',
        deliveryZone: 'los-angeles',
        distanceKm: 2.5,
        kind: 'food',
        productsTotal: 5000,
        origin: 'client_app',
      });

      // Cliente paga 5000 + 1500 a valor nominal (sin recargos).
      // Kiwi: 15% del viaje al repartidor + 15% del ticket al comercio.
      expect(order.origin).toBe('client_app');
      expect(order.totalAmount).toBe(5000 + 1500);
      expect(order.commission).toBe(225 + 750);
      expect(order.commissionRate).toBe(0.15);
      expect(order.driverPayout).toBe(1500 - 225);
    });

    it('rechaza cuando el stock del día no alcanza', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', price: 1000, stockQty: 0, dailyQty: null, stockDay: null },
      ]);
      prisma.menuItem.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      prisma.menuItem.findUnique = jest.fn().mockResolvedValue({ stockQty: 0 });

      await expect(
        service.create('user-1', {
          pickupAddress: 'A',
          deliveryAddress: 'B',
          items: [{ menuItemId: 'item-1', quantity: 1 }],
        }),
      ).rejects.toThrow('se agotó');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('descuenta el stock al crear el pedido', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', price: 1000, stockQty: 50, dailyQty: null, stockDay: null },
      ]);
      prisma.menuItem.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.order.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'o-stock', ...args.data }),
      );

      await service.create('user-1', {
        pickupAddress: 'A',
        deliveryAddress: 'B',
        items: [{ menuItemId: 'item-1', quantity: 2 }],
      });

      expect(prisma.menuItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', stockQty: { gte: 2 } },
        data: { stockQty: { decrement: 2 } },
      });
    });

    it('repone el lote cuando empieza un nuevo día de venta', async () => {
      const { toCRDateKey } = jest.requireActual(
        '../common/costa-rica-time',
      ) as typeof import('../common/costa-rica-time');
      const today = toCRDateKey(new Date());
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', price: 1000, stockQty: 3, dailyQty: 50, stockDay: '2020-01-01' },
      ]);
      prisma.menuItem.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.menuItem.findUnique = jest.fn().mockResolvedValue({
        id: 'item-1',
        price: 1000,
        stockQty: 50,
        dailyQty: 50,
        stockDay: today,
      });
      prisma.order.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'o-reset', ...args.data }),
      );

      await service.create('user-1', {
        pickupAddress: 'A',
        deliveryAddress: 'B',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      });

      // 1º reposición al lote del día, 2º descuento de la unidad pedida.
      expect(prisma.menuItem.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'item-1', stockDay: '2020-01-01' },
        data: { stockQty: 50, stockDay: today },
      });
      expect(prisma.menuItem.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'item-1', stockQty: { gte: 1 } },
        data: { stockQty: { decrement: 1 } },
      });
    });

    it('preventa: item solo-mañana se puede pedir programado para mañana', async () => {
      const { crWeekday, toCRDateKey } = jest.requireActual(
        '../common/costa-rica-time',
      ) as typeof import('../common/costa-rica-time');
      const now = new Date();
      const tomorrow = (crWeekday(now) + 1) % 7;
      const tomorrowKey = toCRDateKey(new Date(now.getTime() + 86_400_000));
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-jueves', price: 2500, availableDays: [tomorrow], stockQty: null },
      ]);
      prisma.menuItem.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.order.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'o-prev', ...args.data }),
      );

      // Inmediato hoy: rebota (no se ofrece hoy).
      await expect(
        service.create('user-1', {
          pickupAddress: 'A',
          deliveryAddress: 'B',
          items: [{ menuItemId: 'item-jueves', quantity: 1 }],
        }),
      ).rejects.toThrow('no se ofrece ese día');

      // Programado para mañana: pasa.
      const order: any = await service.create('user-1', {
        pickupAddress: 'A',
        deliveryAddress: 'B',
        orderType: 'scheduled',
        scheduledDate: tomorrowKey,
        scheduledTime: '14:00',
        items: [{ menuItemId: 'item-jueves', quantity: 2 }],
      });
      expect(order.id).toBe('o-prev');
    });

    it('efectivo con monto: guarda cashTendered y crea fila Payment cash', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([]);
      prisma.payment.upsert = jest.fn().mockResolvedValue({});
      prisma.order.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'o-cash', ...args.data }),
      );

      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque Nicoya',
        deliveryAddress: 'Barrio San Martín',
        distanceKm: 2.5,
        kind: 'food',
        productsTotal: 5000,
        paymentMethod: 'cash',
        cashTendered: 10000,
      });

      // Total 5000 + envío 2000 = 7000 ≤ 10000 (sin recargo: el 15% sale del payout).
      expect(order.totalAmount).toBe(7000);
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ cashTendered: 10000 }) }),
      );
      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'o-cash' },
          create: expect.objectContaining({ method: 'cash', amount: 7000, status: 'pending' }),
        }),
      );
    });

    it('efectivo con monto menor a lo cobrable se rechaza', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([]);
      prisma.payment.upsert = jest.fn().mockResolvedValue({});

      await expect(
        service.create('user-1', {
          pickupAddress: 'Parque Nicoya',
          deliveryAddress: 'Barrio San Martín',
          distanceKm: 2.5,
          kind: 'food',
          productsTotal: 5000,
          paymentMethod: 'cash',
          cashTendered: 1000,
        }),
      ).rejects.toThrow('no cubre lo que se cobra en efectivo');
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });

    it('pedido del comercio en efectivo: el tendered cubre solo el viaje', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([]);
      prisma.payment.upsert = jest.fn().mockResolvedValue({});
      prisma.order.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'o-cash-trip', ...args.data }),
      );

      // Total 7000 pero el viaje son 2000: con 2500 alcanza (solo se cobra el viaje).
      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque Nicoya',
        deliveryAddress: 'Barrio San Martín',
        distanceKm: 2.5,
        kind: 'food',
        productsTotal: 5000,
        paymentMethod: 'cash',
        cashTendered: 2500,
      });

      expect(order.totalAmount).toBe(7000);
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ cashTendered: 2500 }) }),
      );
    });

    it('sin cashTendered no guarda monto pero igual crea fila cash', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([]);
      prisma.payment.upsert = jest.fn().mockResolvedValue({});
      prisma.order.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'o-cash2', ...args.data }),
      );

      await service.create('user-1', {
        pickupAddress: 'A',
        deliveryAddress: 'B',
        paymentMethod: 'cash',
      });

      const data = prisma.order.create.mock.calls[0][0].data;
      expect('cashTendered' in data).toBe(false);
      expect(prisma.payment.upsert).toHaveBeenCalled();
    });

    it('pedido no-efectivo no crea fila Payment', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
      prisma.menuItem.findMany.mockResolvedValue([]);
      prisma.payment.upsert = jest.fn().mockResolvedValue({});
      prisma.order.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'o-card', ...args.data }),
      );

      await service.create('user-1', {
        pickupAddress: 'A',
        deliveryAddress: 'B',
        paymentMethod: 'card',
      });

      expect(prisma.payment.upsert).not.toHaveBeenCalled();
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
        driver: {
          fullName: 'Juan',
          photoUrl: 'https://cdn.test/juan.jpg',
          vehicleType: 'motorcycle',
          vehiclePlate: 'NIC-1234',
          rating: '4.9',
        },
        items: [{ name: 'Bowl', quantity: 2 }],
        createdAt: new Date(),
        assignedAt: new Date(),
        pickedUpAt: null,
        deliveredAt: null,
      });

      const dto: any = await service.getPublicTracking('order-1');

      expect(dto.id).toBe('order-1');
      expect(dto.merchantName).toBe('Bowl & Café');
      expect(dto.driverId).toBe('dp-1');
      expect(dto.driver.fullName).toBe('Juan');
      expect(dto.driver.photoUrl).toBe('https://cdn.test/juan.jpg');
      expect(dto.driver.vehiclePlate).toBe('NIC-1234');
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

      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        driverId: 'dp-1',
        status: 'in_transit_to_delivery',
      });
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

    it('ubicación 404 en pedido entregado/cancelado aunque haya repartidor', async () => {
      for (const status of ['delivered', 'cancelled', 'pending', 'no_driver']) {
        prisma.order.findUnique.mockResolvedValue({ id: 'order-1', driverId: 'dp-1', status });
        await expect(service.getPublicDriverLocation('order-1')).rejects.toThrow(NotFoundException);
      }
    });
  });

  describe('assignDriver availability guard', () => {
    const ORDER_ID = 'order-1';
    const DRIVER_ID = 'dp-1';

    it('rejects assigning an offline driver with a clear message', async () => {
      prisma.driverProfile = {
        ...prisma.driverProfile,
        findUnique: jest.fn().mockResolvedValue({
          id: DRIVER_ID,
          fullName: 'Nuevo Repartidor',
          status: 'offline',
          kycStatus: 'approved',
          userId: 'user-d',
        }),
      };

      await expect(service.assignDriver(ORDER_ID, DRIVER_ID)).rejects.toThrow(
        new BadRequestException(
          'Nuevo Repartidor no está disponible ahora (estado: offline). Podrás asignárselo cuando se conecte.',
        ),
      );
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a not-yet-verified (KYC pending) driver', async () => {
      prisma.driverProfile = {
        ...prisma.driverProfile,
        findUnique: jest.fn().mockResolvedValue({
          id: DRIVER_ID,
          fullName: 'Nuevo Repartidor',
          status: 'available',
          kycStatus: 'pending',
          userId: 'user-d',
        }),
      };

      // Flag por defecto (KYC_REQUIRED=false): el KYC NO bloquea la asignación.
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        merchant: {},
        driver: {},
      });
      await expect(service.assignDriver(ORDER_ID, DRIVER_ID)).resolves.toBeDefined();

      // Flag activado (reactivar KYC): vuelve a bloquear.
      prisma.order.updateMany.mockClear();
      (process.env as any).KYC_REQUIRED = 'true';
      try {
        await expect(service.assignDriver(ORDER_ID, DRIVER_ID)).rejects.toThrow(
          new BadRequestException('Nuevo Repartidor aún no está verificado (KYC pending).'),
        );
        expect(prisma.order.updateMany).not.toHaveBeenCalled();
      } finally {
        delete process.env.KYC_REQUIRED;
      }
    });
  });

  describe('tope de 10 pedidos simultáneos por repartidor', () => {
    const ORDER_ID = 'order-1';
    const DRIVER_ID = 'dp-1';

    beforeEach(() => {
      prisma.driverProfile = {
        findUnique: jest.fn().mockResolvedValue({
          id: DRIVER_ID,
          fullName: 'Juan',
          status: 'available',
          kycStatus: 'approved',
          userId: 'user-d',
        }),
      };
    });

    it('acceptOrderAsDriver rechaza el 11° pedido sin tocar el claim', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: 'pending',
        driverId: null,
      });
      prisma.order.count.mockResolvedValue(10);
      await expect(service.acceptOrderAsDriver(ORDER_ID, 'user-d')).rejects.toThrow(
        'Ya tenés 10 pedidos activos',
      );
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('acceptOrderAsDriver deja pasar con 9 activos', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: 'pending',
        driverId: null,
      });
      prisma.order.count.mockResolvedValue(9);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUnique.mockResolvedValueOnce({
        id: ORDER_ID,
        status: 'pending',
        driverId: null,
      });
      // findUnique se llama varias veces; el claim y el fetch devuelven pedido válido
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        merchant: { userId: 'm1' },
        driver: { fullName: 'Juan' },
      });
      await expect(service.acceptOrderAsDriver(ORDER_ID, 'user-d')).resolves.toBeDefined();
      expect(prisma.order.updateMany).toHaveBeenCalled();
    });

    it('assignDriver rechaza si el elegido ya tiene 10 activos', async () => {
      prisma.order.count.mockResolvedValue(10);
      await expect(service.assignDriver(ORDER_ID, DRIVER_ID)).rejects.toThrow(
        'Ya tenés 10 pedidos activos',
      );
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('rejectOrderAsDriver', () => {
    it('reject asignado: vuelve a concurso y avisa al comercio', async () => {
      prisma.driverProfile = {
        findUnique: jest.fn().mockResolvedValue({ id: 'dp-1', fullName: 'Juan', userId: 'user-d' }),
      };
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        merchant: { userId: 'merchant-user-1' },
      });

      const res = await service.rejectOrderAsDriver('order-1', 'user-d');

      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'order-1',
            driverId: 'dp-1',
            status: { in: ['assigned', 'pending_acceptance', 'in_transit_to_pickup'] },
          },
          data: expect.objectContaining({
            driverId: null,
            status: 'pending',
            contestStartedAt: expect.any(Date),
          }),
        }),
      );
      expect(res.id).toBe('order-1');
    });

    it('reject ajeno o ya recogido: 400 sin tocar nada', async () => {
      prisma.driverProfile = {
        findUnique: jest.fn().mockResolvedValue({ id: 'dp-9', fullName: 'Otro', userId: 'user-x' }),
      };
      prisma.order.updateMany.mockResolvedValue({ count: 0 });
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: 'picked_up' });

      await expect(service.rejectOrderAsDriver('order-1', 'user-x')).rejects.toThrow(
        'Solo podés rechazar un pedido asignado a vos antes de recoger',
      );
    });

    it('reject de inexistente: 404', async () => {
      prisma.driverProfile = {
        findUnique: jest.fn().mockResolvedValue({ id: 'dp-1', fullName: 'Juan', userId: 'user-d' }),
      };
      prisma.order.updateMany.mockResolvedValue({ count: 0 });
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.rejectOrderAsDriver('nope', 'user-d')).rejects.toThrow(
        'Pedido no encontrado',
      );
    });
  });

  describe('getDeliveredZoneMix', () => {
    it('clasifica por zona fija, GPS claro y texto; lo ambiguo queda fuera', async () => {
      prisma.order.findMany.mockResolvedValue([
        { deliveryZone: 'hojancha', deliveryAddress: 'x', deliveryLat: null, deliveryLng: null },
        // GPS exacto de Centro (runner-up Carmen a ~230m → confident)
        { deliveryZone: null, deliveryAddress: 'x', deliveryLat: 10.14828, deliveryLng: -85.45201 },
        // Punto medio Centro/Carmen → ambiguo, cae a texto que tampoco matchea
        {
          deliveryZone: null,
          deliveryAddress: 'Calle sin nombre',
          deliveryLat: 10.14864,
          deliveryLng: -85.453,
        },
        // Sin coords: texto "Matabuey"
        {
          deliveryZone: null,
          deliveryAddress: 'Matabuey, 100m este',
          deliveryLat: null,
          deliveryLng: null,
        },
      ]);

      const res = await service.getDeliveredZoneMix();

      expect(res.delivered).toBe(4);
      expect(res.classified).toBe(3);
      expect(res.unclassified).toBe(1);
      expect(res.weights).toMatchObject({ hojancha: expect.any(Number) });
      const totalWeight = Object.values(res.weights).reduce((s: number, w) => s + (w as number), 0);
      expect(totalWeight).toBe(100);
    });

    it('sin entregados devuelve ceros sin romper', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      const res = await service.getDeliveredZoneMix();
      expect(res).toMatchObject({ delivered: 0, classified: 0, unclassified: 0, weights: {} });
    });
  });

  describe('updateStatus suma el viaje al entregar', () => {
    const baseOrder = {
      id: 'order-1',
      status: 'in_transit_to_delivery',
      driverId: 'dp-1',
      merchantId: 'merchant-1',
      basePrice: 2000,
      pickupProofPhotoUrl: 'https://img/1.jpg',
      deliveryProofPhotoUrl: 'https://img/2.jpg',
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    };

    beforeEach(() => {
      prisma.driverProfile = { update: jest.fn().mockResolvedValue({}) };
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
    });

    it('delivered incrementa totalTrips una vez', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce(baseOrder)
        .mockResolvedValue({ ...baseOrder, status: 'delivered' });

      await service.updateStatus('order-1', 'delivered', 'user-d');

      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1', status: 'in_transit_to_delivery' },
        }),
      );
      expect(prisma.driverProfile.update).toHaveBeenCalledWith({
        where: { id: 'dp-1' },
        data: { totalTrips: { increment: 1 } },
      });
    });

    it('otros estados no tocan el contador', async () => {
      const picking = { ...baseOrder, status: 'in_transit_to_pickup' };
      prisma.order.findUnique
        .mockResolvedValueOnce(picking)
        .mockResolvedValue({ ...picking, status: 'picked_up' });

      await service.updateStatus('order-1', 'picked_up', 'user-d');

      expect(prisma.driverProfile.update).not.toHaveBeenCalled();
    });

    it('el comercio no puede pilotear el ciclo hasta entregado', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: 'in_transit_to_delivery',
      });

      await expect(
        service.updateStatus('order-1', 'delivered', 'merchant-user-1', 'merchant'),
      ).rejects.toThrow('no puede cambiar');
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('el repartidor no cancela a mitad de ruta', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, status: 'in_transit_to_pickup' });

      await expect(
        service.updateStatus('order-1', 'cancelled', 'user-d', 'driver'),
      ).rejects.toThrow('no puede cambiar');
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('el comercio sí cancela un pedido asignado', async () => {
      const assigned = { ...baseOrder, status: 'assigned' };
      prisma.order.findUnique
        .mockResolvedValueOnce(assigned)
        .mockResolvedValue({ ...assigned, status: 'cancelled' });

      await service.updateStatus('order-1', 'cancelled', 'merchant-user-1', 'merchant');

      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'order-1', status: 'assigned' } }),
      );
    });

    it('si otro request movió el pedido, responde 409 sin escribir', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, status: 'in_transit_to_pickup' });
      prisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.updateStatus('order-1', 'picked_up', 'user-d')).rejects.toThrow(
        'cambió de estado',
      );
      expect(prisma.driverProfile.update).not.toHaveBeenCalled();
    });

    it('cancelar con crédito pagado devuelve el viaje y marca refunded', async () => {
      const assigned = { ...baseOrder, status: 'assigned' };
      prisma.order.findUnique
        .mockResolvedValueOnce(assigned)
        .mockResolvedValue({ ...assigned, status: 'cancelled' });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });

      await service.updateStatus('order-1', 'cancelled', 'merchant-user-1', 'merchant');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'order-1', method: 'credit', status: 'completed' },
          data: { status: 'refunded' },
        }),
      );
      expect(prisma.merchantProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'merchant-1' },
          data: { creditBalance: { increment: 2000 } },
        }),
      );
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 2000, kind: 'refund', orderId: 'order-1' }),
        }),
      );
    });

    it('cancelar sin pago con crédito no toca el saldo', async () => {
      const assigned = { ...baseOrder, status: 'assigned' };
      prisma.order.findUnique
        .mockResolvedValueOnce(assigned)
        .mockResolvedValue({ ...assigned, status: 'cancelled' });
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });

      await service.updateStatus('order-1', 'cancelled', 'merchant-user-1', 'merchant');

      expect(prisma.merchantProfile.update).not.toHaveBeenCalled();
      expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('createGuestOrder', () => {
    const profile = {
      id: 'merchant-1',
      userId: 'user-1',
      businessName: 'Bowl & Café',
      address: 'Nicoya Centro',
      latitude: 10.1483,
      longitude: -85.4527,
    };

    it('exige teléfono de contacto', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue(profile);

      await expect(
        service.createGuestOrder('merchant-1', {
          deliveryAddress: 'Barrio Los Ángeles',
          items: [],
        }),
      ).rejects.toThrow('customerPhone');
    });

    it('comercio inexistente → 404', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.createGuestOrder('nope', {
          deliveryAddress: 'Barrio Los Ángeles',
          customerPhone: '88888888',
          items: [],
        }),
      ).rejects.toThrow('Comercio no encontrado');
    });

    it('crea con precios del servidor y contacto persistido', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue(profile);
      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Bowl Tropikal', price: 4500, merchantId: 'merchant-1' },
      ]);
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        status: 'pending',
        ...data,
      }));

      const order: any = await service.createGuestOrder('merchant-1', {
        deliveryAddress: 'Barrio Los Ángeles',
        customerPhone: '8888-8888',
        customerName: 'María',
        items: [{ menuItemId: 'item-1', quantity: 2, price: 1 }],
      });

      // Precio del cliente ($1) ignorado: 2 × ₡4500 del menú.
      expect(order.productsTotal).toBe(9000);
      expect(order.customerPhone).toBe('8888-8888');
      expect(order.customerName).toBe('María');
      // Pickup por defecto: el del comercio.
      expect(order.pickupAddress).toBe('Nicoya Centro');
      expect(order.merchantId).toBe('merchant-1');
    });

    it('acepta pegados de WhatsApp (+506 con espacios) y los normaliza', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue(profile);
      prisma.menuItem.findMany.mockResolvedValue([]);
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        status: 'pending',
        ...data,
      }));

      const order: any = await service.createGuestOrder('merchant-1', {
        deliveryAddress: 'Barrio Los Ángeles',
        customerPhone: '+506 6380 5455',
        items: [],
      });

      expect(order.customerPhone).toBe('6380-5455');
    });

    it('rechaza teléfonos que no son 8 dígitos', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue(profile);

      await expect(
        service.createGuestOrder('merchant-1', {
          deliveryAddress: 'Barrio Los Ángeles',
          customerPhone: '+1 555 123 4567',
          items: [],
        }),
      ).rejects.toThrow('customerPhone');
    });
  });

  describe('createEncomiendaOrder (cliente pide encomienda a repartidor)', () => {
    const customer = { id: 'cust-1', role: 'customer', status: 'active' };
    const base = {
      customerName: 'Ana',
      customerPhone: '8888-7777',
      pickupAddress: 'Mercado de Nicoya',
      deliveryAddress: 'Barrio San Martín',
      pickupLat: 10.1467,
      pickupLng: -85.452,
      deliveryLat: 10.15,
      deliveryLng: -85.455,
      distanceKm: 2,
      packageDescription: 'Caja con documentos',
      packageSize: 'S',
      weightKg: 3,
    };

    beforeEach(() => {
      prisma.user = {
        findUnique: jest.fn().mockResolvedValue(customer),
        upsert: jest.fn().mockResolvedValue({ id: 'sys-user' }),
      };
      prisma.merchantProfile.upsert = jest.fn().mockResolvedValue({ id: 'sys-merchant' });
      prisma.merchantProfile.findUnique.mockImplementation(async ({ where }: any) =>
        where.userId === 'sys-user'
          ? {
              id: 'sys-merchant',
              userId: 'sys-user',
              businessName: 'Kiwi Encomiendas',
              address: 'Nicoya',
            }
          : null,
      );
      prisma.order.create.mockImplementation(async ({ data }: any) => ({
        id: 'order-enc-1',
        status: 'pending',
        ...data,
      }));
      prisma.order.update = jest.fn().mockImplementation(async ({ data }: any) => ({
        id: 'order-enc-1',
        ...data,
      }));
    });

    it('crea freight de origen cliente, contra el perfil sistema, en efectivo', async () => {
      const order: any = await service.createEncomiendaOrder('cust-1', base);

      expect(order.kind).toBe('freight');
      expect(order.origin).toBe('client_app');
      expect(order.merchantId).toBe('sys-merchant');
      expect(order.productsTotal).toBe(0);
      expect(order.pickupAddress).toBe('Mercado de Nicoya');
      expect(order.weightKg).toBe(3);
    });

    it('vincula el pedido a la cuenta del cliente', async () => {
      const order: any = await service.createEncomiendaOrder('cust-1', base);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-enc-1' },
        data: { customerId: 'cust-1' },
      });
      expect(order.customerId).toBe('cust-1');
    });

    it('perfil sistema sin login: user inactive, no listado', async () => {
      await service.createEncomiendaOrder('cust-1', base);

      const upsertArgs = prisma.user.upsert.mock.calls[0][0];
      expect(upsertArgs.create.status).toBe('inactive');
      expect(upsertArgs.create.passwordHash).toBeUndefined();
      const profileArgs = prisma.merchantProfile.upsert.mock.calls[0][0];
      expect(profileArgs.create.isListed).toBe(false);
    });

    it('rechaza cuentas que no son cliente activo', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'x', role: 'merchant', status: 'active' });

      await expect(service.createEncomiendaOrder('x', base)).rejects.toThrow(
        'Cuenta de cliente no válida',
      );
    });

    it('exige teléfono y descripción del paquete', async () => {
      await expect(
        service.createEncomiendaOrder('cust-1', { ...base, customerPhone: '' }),
      ).rejects.toThrow('customerPhone');
      await expect(
        service.createEncomiendaOrder('cust-1', { ...base, packageDescription: '   ' }),
      ).rejects.toThrow('packageDescription');
    });

    it('ignora cartas de productos: freight nunca cobra items', async () => {
      const order: any = await service.createEncomiendaOrder('cust-1', {
        ...base,
        items: [{ menuItemId: 'x', name: 'Hack', price: 1, quantity: 99 }],
      });

      expect(order.productsTotal).toBe(0);
      expect(order.items).toBeUndefined();
    });
  });

  describe('createMandadoOrder (cliente pide compra presencial)', () => {
    const customer = { id: 'cust-1', role: 'customer', status: 'active' };
    const base = {
      customerName: 'Ana',
      customerPhone: '8888-7777',
      pickupAddress: 'Súper La Amistad, Nicoya',
      pickupLat: 10.1467,
      pickupLng: -85.452,
      deliveryAddress: 'Barrio San Martín',
      deliveryLat: 10.15,
      deliveryLng: -85.455,
      distanceKm: 2,
      purchaseStore: 'Súper La Amistad',
      packageDescription: '2 leches, pan y queso',
      purchaseEstimate: 5000,
    };
    let created: any;

    beforeEach(() => {
      prisma.user = {
        findUnique: jest.fn().mockResolvedValue(customer),
        upsert: jest.fn().mockResolvedValue({ id: 'sys-user' }),
      };
      prisma.merchantProfile.upsert = jest.fn().mockResolvedValue({ id: 'sys-merchant' });
      prisma.merchantProfile.findUnique.mockImplementation(async ({ where }: any) =>
        where.userId === 'sys-user'
          ? { id: 'sys-merchant', userId: 'sys-user', businessName: 'Kiwi Encomiendas' }
          : null,
      );
      // create() real con prisma mockeado: devuelve la fila tal cual.
      prisma.order.create.mockImplementation(async ({ data }: any) => {
        created = { id: 'order-man-1', status: 'pending', ...data };
        return created;
      });
      prisma.order.findUnique.mockImplementation(async () => created);
      prisma.order.update = jest.fn().mockImplementation(async ({ data }: any) => {
        created = { ...created, ...data };
        return created;
      });
      prisma.payment.update = jest.fn().mockResolvedValue({});
    });

    it('cobra 10% extra (5% bonus repartidor + 5% Kiwi) sobre compra + viaje', async () => {
      const order: any = await service.createMandadoOrder('cust-1', base);

      expect(order.isMandado).toBe(true);
      expect(order.purchaseStore).toBe('Súper La Amistad');
      expect(order.productsTotal).toBe(5000);
      const trip = Number(order.basePrice);
      const extra = Math.round((5000 + trip) * 0.1);
      const bonus = Math.round(extra / 2);
      const tripFee = Math.round(trip * Number(order.commissionRate));
      expect(order.extraFee).toBe(extra);
      expect(order.commission).toBe(tripFee + (extra - bonus));
      expect(order.driverPayout).toBe(trip - tripFee + bonus + 5000);
      expect(order.totalAmount).toBe(5000 + trip + extra);
    });

    it('en efectivo el cliente cubre el total (compra + viaje + fee)', async () => {
      // Total real = 5000 + viaje + 10%: con 100 no alcanza.
      await expect(
        service.createMandadoOrder('cust-1', { ...base, cashTendered: 100 }),
      ).rejects.toThrow('no cubre lo que se cobra en efectivo');

      const order: any = await service.createMandadoOrder('cust-1', {
        ...base,
        cashTendered: 20000,
      });
      expect(order.cashTendered).toBe(20000);
    });

    it('valida tienda, lista y tope de estimado (₡15000)', async () => {
      await expect(
        service.createMandadoOrder('cust-1', { ...base, purchaseStore: '  ' }),
      ).rejects.toThrow('purchaseStore');
      await expect(
        service.createMandadoOrder('cust-1', { ...base, packageDescription: '' }),
      ).rejects.toThrow('packageDescription');
      await expect(
        service.createMandadoOrder('cust-1', { ...base, purchaseEstimate: 0 }),
      ).rejects.toThrow('purchaseEstimate');
      await expect(
        service.createMandadoOrder('cust-1', { ...base, purchaseEstimate: 15001 }),
      ).rejects.toThrow('purchaseEstimate');
      await expect(
        service.createMandadoOrder('cust-1', { ...base, customerPhone: 'x' }),
      ).rejects.toThrow('customerPhone');
    });

    it('rechaza cuentas que no son cliente activo', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'x', role: 'driver', status: 'active' });
      await expect(service.createMandadoOrder('x', base)).rejects.toThrow(
        'Cuenta de cliente no válida',
      );
    });
  });

  describe('setReceiptAmount (factura del mandado)', () => {
    beforeEach(() => {
      prisma.payment.update = jest.fn().mockResolvedValue({});
      prisma.order.update = jest.fn().mockImplementation(async ({ data }: any) => data);
    });

    const row = () => ({
      id: 'order-man-1',
      isMandado: true,
      status: 'assigned',
      driverId: 'drv-1',
      basePrice: 1500,
      commissionRate: 0.15,
      productsTotal: 5000,
      receiptAmount: null,
    });

    it('recalcula con la factura y actualiza el pago cash', async () => {
      let current: any = row();
      prisma.order.findUnique.mockImplementation(async () => current);
      prisma.order.update.mockImplementation(async ({ data }: any) => {
        current = { ...current, ...data };
        return current;
      });
      prisma.driverProfile = {
        findUnique: jest.fn().mockResolvedValue({ id: 'drv-1' }),
      };

      const updated: any = await service.setReceiptAmount('order-man-1', 'user-drv', 6200);

      // extra = 10% de (6200+1500) = 770; bonus = 385; tripFee = 225
      expect(updated.extraFee).toBe(770);
      expect(updated.productsTotal).toBe(6200);
      expect(updated.driverPayout).toBe(1500 - 225 + 385 + 6200);
      expect(updated.totalAmount).toBe(6200 + 1500 + 770);
      expect(updated.commission).toBe(225 + (770 - 385));
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { orderId: 'order-man-1' },
        data: { amount: 6200 + 1500 + 770 },
      });
    });

    it('solo el repartidor asignado y antes de cerrar', async () => {
      prisma.order.findUnique.mockResolvedValue(row());
      prisma.driverProfile = { findUnique: jest.fn().mockResolvedValue({ id: 'otro' }) };
      await expect(service.setReceiptAmount('order-man-1', 'user-x', 6200)).rejects.toThrow(
        'asignado',
      );

      prisma.driverProfile = { findUnique: jest.fn().mockResolvedValue({ id: 'drv-1' }) };
      prisma.order.findUnique.mockResolvedValue({ ...row(), status: 'delivered' });
      await expect(service.setReceiptAmount('order-man-1', 'user-drv', 6200)).rejects.toThrow(
        'cerró',
      );
    });

    it('rechaza lo que no es mandado y montos inválidos', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...row(), isMandado: false });
      prisma.driverProfile = { findUnique: jest.fn().mockResolvedValue({ id: 'drv-1' }) };
      await expect(service.setReceiptAmount('order-man-1', 'user-drv', 6200)).rejects.toThrow(
        'Mandado no encontrado',
      );
      await expect(service.setReceiptAmount('order-man-1', 'user-drv', -5)).rejects.toThrow(
        'receiptAmount',
      );
    });
  });

  describe('findPossibleDuplicate', () => {
    const A = '200 oeste y 75 sur de escuela Eupi casa a mano izquierda color celeste';
    const B = '200 oeste y 75 sur de la escuela Eupi casa mano izquierda color celeste';

    beforeEach(() => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm-1', userId: 'u-1' });
    });

    it('detecta el par real: mismo destino re-escrito con diferencias', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          deliveryAddress: B,
          status: 'in_transit_to_delivery',
          createdAt: new Date(Date.now() - 23 * 60 * 1000),
          driver: { fullName: 'Luis Espinoza' },
        },
      ]);
      const res = await service.findPossibleDuplicate('u-1', A);
      expect(res.duplicate?.id).toBe('order-1');
      expect(res.duplicate?.driverName).toBe('Luis Espinoza');
    });

    it('no avisa con dirección distinta', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          deliveryAddress: 'Barrio San Martín, taller de muflas',
          status: 'assigned',
          createdAt: new Date(),
          driver: null,
        },
      ]);
      const res = await service.findPossibleDuplicate('u-1', A);
      expect(res.duplicate).toBeNull();
    });

    it('no avisa sin activos recientes ni con dirección cortita', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      expect((await service.findPossibleDuplicate('u-1', A)).duplicate).toBeNull();
      expect((await service.findPossibleDuplicate('u-1', 'casa')).duplicate).toBeNull();
      expect(prisma.order.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('createManualOrder', () => {
    beforeEach(() => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm-1', userId: 'u-1' });
      prisma.driverProfile = {
        findUnique: jest.fn().mockResolvedValue({ id: 'drv-1' }),
        update: jest.fn().mockResolvedValue({}),
      };
      prisma.order.create.mockResolvedValue({
        id: 'manual-1',
        merchantId: 'm-1',
        driverId: 'drv-1',
        status: 'delivered',
        totalAmount: 1500,
      });
      prisma.payment = {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
    });

    it('crea entregado con repartidor e incrementa viajes', async () => {
      const res = await service.createManualOrder(
        {
          merchantId: 'm-1',
          driverId: 'drv-1',
          pickupAddress: 'Comercio',
          deliveryAddress: 'Casa',
          basePrice: 1500,
          status: 'delivered',
        },
        'admin-1',
      );
      expect(res.id).toBe('manual-1');
      expect(prisma.driverProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { totalTrips: { increment: 1 } } }),
      );
    });

    it('sin merchantId y sin house exige comercio (no cae a mostrador por error)', async () => {
      await expect(
        service.createManualOrder(
          { pickupAddress: 'A', deliveryAddress: 'B', basePrice: 1500 },
          'admin-1',
        ),
      ).rejects.toThrow('merchantId es requerido');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('mandado sin comercio usa/crea el mostrador y paga completo al repartidor sin tocar crédito', async () => {
      prisma.merchantProfile.findFirst = jest.fn().mockResolvedValue(null);
      prisma.user = { create: jest.fn().mockResolvedValue({ id: 'u-house' }) };
      prisma.merchantProfile.create = jest
        .fn()
        .mockResolvedValue({ id: 'm-house', userId: 'u-house' });
      prisma.order.create.mockResolvedValue({
        id: 'manual-2',
        merchantId: 'm-house',
        status: 'delivered',
        totalAmount: 1500,
      });

      const res = await service.createManualOrder(
        {
          house: true,
          pickupAddress: 'Pulpería',
          deliveryAddress: 'Casa',
          basePrice: 1500,
          status: 'delivered',
        },
        'admin-1',
      );
      expect(res.id).toBe('manual-2');
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.merchantProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ businessName: 'Mostrador KiWi' }),
        }),
      );
      // Payout completo al repartidor y sin movimiento de crédito
      // (solo registro cash; el balance del comercio no se toca).
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            merchantId: 'm-house',
            driverPayout: 1500,
            commission: 0,
          }),
        }),
      );
      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ method: 'cash', status: 'pending' }),
        }),
      );
    });

    it('mandado sin comercio reusa el mostrador existente', async () => {
      prisma.merchantProfile.findFirst = jest
        .fn()
        .mockResolvedValue({ id: 'm-house', userId: 'u-house' });
      prisma.user = { create: jest.fn() };
      prisma.merchantProfile.create = jest.fn();

      await service.createManualOrder(
        {
          house: true,
          pickupAddress: 'A',
          deliveryAddress: 'B',
          basePrice: 1000,
          status: 'pending',
        },
        'admin-1',
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.merchantProfile.create).not.toHaveBeenCalled();
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ merchantId: 'm-house' }) }),
      );
    });
  });
});
