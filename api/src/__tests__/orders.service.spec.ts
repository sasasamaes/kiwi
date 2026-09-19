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
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { ProximityService } from '../orders/proximity.service';

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
        updateMany: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      merchantProfile: {
        findUnique: jest.fn(),
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
    };

    jest.clearAllMocks();

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
          },
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

      // Viaje ₡7000 + comisión 10% ₡700 = ₡7700 (sin productos)
      expect(order.deliveryZone).toBe('hojancha');
      expect(order.basePrice).toBe(7000);
      expect(order.driverPayout).toBe(7000);
      expect(order.commission).toBe(700);
      expect(order.commissionRate).toBe(0.1);
      expect(order.totalAmount).toBe(7700);
    });

    it('sin crédito aplica 15% al envío (onvo/efectivo)', async () => {
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

      // Viaje ₡7000 + comisión 15% ₡1050 = ₡8050
      expect(order.commission).toBe(1050);
      expect(order.commissionRate).toBe(0.15);
      expect(order.totalAmount).toBe(8050);
      expect(order.driverPayout).toBe(7000);
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
        payWithCredit: true,
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
        payWithCredit: true,
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

    it('comida en zona: comisión de productos al 15% + 10% del envío', async () => {
      const order: any = await service.create('user-1', {
        pickupAddress: 'Parque Nicoya',
        deliveryAddress: 'Barrio San Martín',
        distanceKm: 2.5,
        kind: 'food',
        payWithCredit: true,
        productsTotal: 5000,
      });
      // 10% de 2000 (envío) + 15% de 5000 (productos) = 200 + 750
      expect(order.basePrice).toBe(2000);
      expect(order.commission).toBe(950);
      expect(order.totalAmount).toBe(2000 + 5000 + 950);
    });

    it('PRODUCT_COMMISSION_PCT=0 restaura el pass-through de productos', async () => {
      process.env.PRODUCT_COMMISSION_PCT = '0';
      try {
        const order: any = await service.create('user-1', {
          pickupAddress: 'Parque Nicoya',
          deliveryAddress: 'Barrio San Martín',
          distanceKm: 2.5,
          kind: 'food',
          payWithCredit: true,
          productsTotal: 5000,
        });
        // Solo 10% del envío; productos intactos
        expect(order.commission).toBe(200);
        expect(order.totalAmount).toBe(7200);
      } finally {
        delete process.env.PRODUCT_COMMISSION_PCT;
      }
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

      const persisted = prisma.orderItem.createMany.mock.calls[0][0].data[0];
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
});
