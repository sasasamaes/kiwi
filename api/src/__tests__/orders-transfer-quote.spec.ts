// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
jest.mock('@nestjs/websockets', () => ({}), { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });

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
import { OrdersService } from '../orders/orders.service';
import { MerchantsService } from '../merchants/merchants.service';
import { ZonesService } from '../zones/zones.service';
import { CoverageService } from '../service-area/coverage.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { ProximityService } from '../orders/proximity.service';

// Nicoya centro (10.1467, -85.4520): sede A y B en el mismo punto →
// distancia 0, plana ₡2000. Sede C 0.18° al norte (~20 km, fuera de la
// zona plana) → tabla: 2000 + (20-10)*350.
const NICOYA = { lat: 10.1467, lng: -85.452 };
const LEJOS = { lat: 10.3267, lng: -85.452 };

const sede = (over: any) => ({
  id: 'sede-a',
  userId: 'user-1',
  businessName: 'Sede A',
  address: 'Nicoya centro',
  latitude: NICOYA.lat,
  longitude: NICOYA.lng,
  transfersEnabled: true,
  parentMerchantId: 'matriz-1',
  transferPriceOverride: null,
  ...over,
});

function mockChain(prisma: any, originOver: any = {}, destOver: any = {}) {
  prisma.merchantProfile.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.userId) return sede(originOver);
    if (where.id === 'sede-b')
      return {
        id: 'sede-b',
        businessName: 'Sede B',
        address: 'San Martín',
        latitude: NICOYA.lat,
        longitude: NICOYA.lng,
        transfersEnabled: true,
        parentMerchantId: 'matriz-1',
        transferPriceOverride: null,
        ...destOver,
      };
    if (where.id === 'matriz-1')
      return { id: 'matriz-1', businessName: 'Matriz', transferPriceOverride: null };
    return null;
  });
}

describe('Traslados: cotización punto a punto + precio pactado', () => {
  let orders: OrdersService;
  let merchants: MerchantsService;
  let prisma: any;

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
        update: jest.fn((a: any) => Promise.resolve(a.data)),
      },
      payment: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      creditTransaction: { create: jest.fn() },
      menuItem: { findMany: jest.fn() },
      menuItemVariantOption: { findMany: jest.fn().mockResolvedValue([]) },
      driverProfile: { findUnique: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      orderItem: { create: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        MerchantsService,
        {
          provide: ZonesService,
          useValue: {
            list: jest.fn().mockResolvedValue([]),
            resolvePriceAt: jest.fn().mockResolvedValue(null),
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: DriversService, useValue: { getLocation: jest.fn() } },
        {
          provide: ProximityService,
          useValue: { findNearbyDrivers: jest.fn().mockResolvedValue({ candidates: null }) },
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
            notifyFollowers: jest.fn(),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getDriverCommissionPct: jest.fn().mockResolvedValue(15),
            getHomeCookCommissionPct: jest.fn().mockResolvedValue(5),
            getTestDriverEmails: jest.fn().mockResolvedValue(['pilot@kiwi.app']),
          },
        },
        { provide: CoverageService, useValue: { recordInterest: jest.fn() } },
      ],
    }).compile();

    orders = module.get(OrdersService);
    merchants = module.get(MerchantsService);
  });

  it('cotiza sede→sede en el mismo punto: ₡2000, sin pactado', async () => {
    mockChain(prisma);
    const q: any = await orders.quoteTransfer('user-1', 'sede-b');
    expect(q.distanceKm).toBe(0);
    expect(q.tripPrice).toBe(2000);
    expect(q.overrideApplied).toBe(false);
  });

  it('cotiza por distancia fuera de la zona plana', async () => {
    mockChain(prisma, {}, { latitude: LEJOS.lat, longitude: LEJOS.lng });
    const q: any = await orders.quoteTransfer('user-1', 'sede-b');
    expect(q.distanceKm).toBeCloseTo(20, 0);
    expect(q.tripPrice).toBe(Math.round(2000 + (q.distanceKm - 10) * 350));
    expect(q.overrideApplied).toBe(false);
  });

  it('el pactado de la sede manda sobre el cálculo', async () => {
    mockChain(prisma, { transferPriceOverride: 2500 });
    const q: any = await orders.quoteTransfer('user-1', 'sede-b');
    expect(q.tripPrice).toBe(2500);
    expect(q.overrideApplied).toBe(true);
  });

  it('el pactado se hereda de la matriz', async () => {
    mockChain(prisma);
    prisma.merchantProfile.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.userId) return sede({});
      if (where.id === 'sede-b')
        return {
          id: 'sede-b',
          businessName: 'Sede B',
          address: 'x',
          latitude: NICOYA.lat,
          longitude: NICOYA.lng,
          transfersEnabled: true,
          parentMerchantId: 'matriz-1',
        };
      if (where.id === 'matriz-1')
        return { id: 'matriz-1', businessName: 'Matriz', transferPriceOverride: 3000 };
      return null;
    });
    const q: any = await orders.quoteTransfer('user-1', 'sede-b');
    expect(q.tripPrice).toBe(3000);
    expect(q.overrideApplied).toBe(true);
  });

  it('createTransfer cobra el pactado (base, total y payout derivan)', async () => {
    mockChain(prisma, { transferPriceOverride: 2500 });
    prisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'o-1',
      status: 'pending',
      ...data,
    }));
    const order: any = await orders.createTransfer('user-1', {
      toMerchantId: 'sede-b',
      packageDescription: '2 cajas',
    });
    expect(order.basePrice).toBe(2500);
    expect(order.totalAmount).toBe(2500);
    expect(order.driverPayout).toBe(2500 - Math.round(2500 * 0.15));
  });

  it('admin: guarda pactado, lo limpia con null y rechaza negativo', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm-1' });
    await merchants.setTransferPriceOverride('m-1', 2500);
    expect(prisma.merchantProfile.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { transferPriceOverride: 2500 },
    });
    await merchants.setTransferPriceOverride('m-1', null);
    expect(prisma.merchantProfile.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { transferPriceOverride: null },
    });
    await expect(merchants.setTransferPriceOverride('m-1', -100)).rejects.toThrow('inválido');
    prisma.merchantProfile.findUnique.mockResolvedValueOnce(null);
    await expect(merchants.setTransferPriceOverride('nope', 100)).rejects.toThrow('no encontrado');
  });
});
