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
import { OrdersService } from '../orders/orders.service';
import { ZonesService } from '../zones/zones.service';
import { CoverageService } from '../service-area/coverage.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { ProximityService } from '../orders/proximity.service';
import { ImageUploadService } from '../menu/image-upload.service';

describe('OrdersService proof photo (Task 2)', () => {
  let service: OrdersService;
  let prisma: any;
  let imageUpload: { uploadProofImage: jest.Mock };

  beforeEach(async () => {
    prisma = {
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      driverProfile: { update: jest.fn().mockResolvedValue({}) },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      // updateStatus corre en transacción interactiva (claim + refund).
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    jest.clearAllMocks();

    imageUpload = { uploadProofImage: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: ZonesService,
          useValue: {
            list: jest.fn().mockResolvedValue([]),
            listAll: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
            update: jest.fn(),
            deactivate: jest.fn(),
            resolvePriceAt: jest.fn().mockResolvedValue(null),
          },
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
          },
        },
        { provide: SettingsService, useValue: { getDriverCommissionPct: jest.fn() } },
        { provide: ImageUploadService, useValue: imageUpload },
        {
          provide: CoverageService,
          useValue: { recordInterest: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('picked_up sin foto de pickup se rechaza', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'in_transit_to_pickup',
      driverId: 'dp-1',
      pickupProofPhotoUrl: null,
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });
    await expect(service.updateStatus('order-1', 'picked_up', 'user-d')).rejects.toThrow(
      'Subí la foto de evidencia para continuar',
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('picked_up con foto avanza y sella pickupProofAt', async () => {
    const picking = {
      id: 'order-1',
      status: 'in_transit_to_pickup',
      driverId: 'dp-1',
      pickupProofPhotoUrl: 'https://img/1.jpg',
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    };
    prisma.order.findUnique
      .mockResolvedValueOnce(picking)
      .mockResolvedValue({ ...picking, status: 'picked_up' });
    await service.updateStatus('order-1', 'picked_up', 'user-d');
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', status: 'in_transit_to_pickup' } }),
    );
  });

  it('delivered sin foto de delivery se rechaza', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'in_transit_to_delivery',
      driverId: 'dp-1',
      deliveryProofPhotoUrl: null,
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });
    await expect(service.updateStatus('order-1', 'delivered', 'user-d')).rejects.toThrow(
      'Subí la foto de evidencia para continuar',
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('delivered con foto avanza', async () => {
    const intransit = {
      id: 'order-1',
      status: 'in_transit_to_delivery',
      driverId: 'dp-1',
      deliveryProofPhotoUrl: 'https://img/2.jpg',
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    };
    prisma.order.findUnique
      .mockResolvedValueOnce(intransit)
      .mockResolvedValue({ ...intransit, status: 'delivered' });
    await service.updateStatus('order-1', 'delivered', 'user-d');
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', status: 'in_transit_to_delivery' } }),
    );
  });

  it('atajo: driver no puede forjar la foto pickup del comercio', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'in_transit_to_pickup',
      driverId: 'dp-1',
      pickupProofPhotoUrl: null,
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });
    await expect(
      service.updateStatus('order-1', 'picked_up', 'user-d', 'driver', 'https://img/fake.jpg'),
    ).rejects.toThrow('Solo el comercio sube la foto de entrega al repartidor');
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('atajo: URL no-https se rechaza aunque el actor sea correcto', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'in_transit_to_delivery',
      driverId: 'dp-1',
      deliveryProofPhotoUrl: null,
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });
    await expect(
      service.updateStatus('order-1', 'delivered', 'user-d', 'driver', 'javascript:alert(1)'),
    ).rejects.toThrow('URL de evidencia inválida');
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('admin cierra directo a delivered desde assigned (cola trabada)', async () => {
    const assigned = {
      id: 'order-1',
      status: 'assigned',
      driverId: 'dp-1',
      pickupProofPhotoUrl: null,
      deliveryProofPhotoUrl: null,
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    };
    prisma.order.findUnique
      .mockResolvedValueOnce(assigned)
      .mockResolvedValue({ ...assigned, status: 'delivered' });
    const res: any = await service.updateStatus('order-1', 'delivered', 'admin-1', 'admin');
    expect(res.status).toBe('delivered');
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', status: 'assigned' },
        data: expect.objectContaining({ status: 'delivered' }),
      }),
    );
  });

  it('comercio no puede saltar a delivered desde assigned', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'assigned',
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });
    await expect(
      service.updateStatus('order-1', 'delivered', 'merchant-user-1', 'merchant'),
    ).rejects.toThrow('No se puede cambiar');
  });

  it('admin cierra trabados sin foto (delivered sin evidencia)', async () => {
    const intransit = {
      id: 'order-1',
      status: 'in_transit_to_delivery',
      driverId: 'dp-1',
      deliveryProofPhotoUrl: null,
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    };
    prisma.order.findUnique
      .mockResolvedValueOnce(intransit)
      .mockResolvedValue({ ...intransit, status: 'delivered' });
    const res: any = await service.updateStatus('order-1', 'delivered', 'admin-1', 'admin');
    expect(res.status).toBe('delivered');
  });

  it('uploadProofPhoto: solo el comercio sube la foto pickup', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1' });

    await expect(
      (service as any).uploadProofPhoto('order-1', 'pickup', 'https://img/1.jpg', 'user-d'),
    ).rejects.toThrow('Solo el comercio sube la foto de entrega al repartidor');

    await (service as any).uploadProofPhoto(
      'order-1',
      'pickup',
      'https://img/1.jpg',
      'merchant-user-1',
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({ pickupProofPhotoUrl: 'https://img/1.jpg' }),
      }),
    );
  });

  it('uploadProofPhoto: solo el repartidor asignado sube la foto delivery', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1' });

    await expect(
      (service as any).uploadProofPhoto(
        'order-1',
        'delivery',
        'https://img/2.jpg',
        'merchant-user-1',
      ),
    ).rejects.toThrow('Solo el repartidor asignado sube la foto de entrega al cliente');

    await (service as any).uploadProofPhoto('order-1', 'delivery', 'https://img/2.jpg', 'user-d');
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({ deliveryProofPhotoUrl: 'https://img/2.jpg' }),
      }),
    );
  });

  it('uploadProofPhotoWithFile: valida kind, sube y registra la URL', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      merchant: { userId: 'merchant-user-1' },
      driver: { userId: 'user-d' },
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1' });
    imageUpload.uploadProofImage.mockResolvedValue({ url: 'https://img/proof.jpg' });

    await expect(
      (service as any).uploadProofPhotoWithFile(
        'order-1',
        'invalido',
        { buffer: Buffer.from('x') },
        'user-d',
      ),
    ).rejects.toThrow('kind inválido');

    const res = await (service as any).uploadProofPhotoWithFile(
      'order-1',
      'delivery',
      { buffer: Buffer.from('x'), size: 1 },
      'user-d',
    );
    expect(imageUpload.uploadProofImage).toHaveBeenCalled();
    expect(res).toEqual({ id: 'order-1' });
  });
});
