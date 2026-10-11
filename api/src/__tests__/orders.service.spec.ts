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
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { ProximityService } from '../orders/proximity.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;
  let settingsStub: { getDriverCommissionPct: jest.Mock; getHomeCookCommissionPct: jest.Mock };

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
      orderItem: {
        create: jest.fn(),
      },
      // updateStatus corre en transacción interactiva (claim + refund).
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    jest.clearAllMocks();

    settingsStub = {
      getDriverCommissionPct: jest.fn().mockResolvedValue(15),
      getHomeCookCommissionPct: jest.fn().mockResolvedValue(5),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
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
            notifyAssignmentOffered: jest.fn().mockResolvedValue({}),
            notifyContestStarted: jest.fn().mockResolvedValue({}),
            notifyNoDriverAvailable: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: SettingsService, useValue: settingsStub },
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

      // Viaje ₡7000: el comercio paga ₡7000, el driver paga 15% (₡1050)
      expect(order.deliveryZone).toBe('hojancha');
      expect(order.basePrice).toBe(7000);
      expect(order.driverPayout).toBe(5950);
      expect(order.commission).toBe(1050);
      expect(order.commissionRate).toBe(0.15);
      expect(order.totalAmount).toBe(7000);
    });

    it('el medio de pago no cambia la comisión: siempre 15% del driver', async () => {
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

      // Viaje ₡7000: comercio paga ₡7000, driver recibe ₡5950 (15% Kiwi)
      expect(order.commission).toBe(1050);
      expect(order.commissionRate).toBe(0.15);
      expect(order.totalAmount).toBe(7000);
      expect(order.driverPayout).toBe(5950);
    });

    it('la tasa del admin manda: 20% configured → comisión 1400 en viaje 7000', async () => {
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
      expect(order.totalAmount).toBe(2000);
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

    it('flete en zona: 2000, driver recibe 1700 (15%)', async () => {
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
      expect(order.commission).toBe(300);
      expect(order.driverPayout).toBe(1700);
      expect(order.totalAmount).toBe(2000);
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
      // 2000 viaje + 7*500 peso = 5500; comisión 15% = 825; driver = 4675
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

    it('comida en zona: productos sin comisión, comercio paga envío pleno', async () => {
      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque Nicoya',
        deliveryAddress: 'Barrio San Martín',
        distanceKm: 2.5,
        kind: 'food',
        payWithCredit: true,
        productsTotal: 5000,
      });
      // 15% de 2000 (envío) lo paga el driver; productos 100% del comercio
      expect(order.basePrice).toBe(2000);
      expect(order.commission).toBe(300);
      expect(order.driverPayout).toBe(1700);
      expect(order.totalAmount).toBe(2000 + 5000);
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

    it('cocina casera usa la comisión reducida de emprendedores', async () => {
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
      expect(order.commissionRate).toBe(0.05);
      expect(order.commission).toBe(100); // 5% de 2000 (envío)
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
});
