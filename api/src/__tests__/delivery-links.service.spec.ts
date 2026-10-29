// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DeliveryLinksService } from '../delivery-links/delivery-links.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ZonesService } from '../zones/zones.service';

describe('DeliveryLinksService', () => {
  let service: DeliveryLinksService;
  let prisma: any;
  let ordersService: any;
  let paymentsService: any;

  const merchant = {
    id: 'merchant-1',
    userId: 'user-m1',
    businessName: 'Soda Test',
    address: 'Nicoya centro',
    latitude: 10.1467,
    longitude: -85.452,
  };
  const zone = { id: 'zone-1', label: 'Los Ángeles', price: 1500 };

  beforeEach(async () => {
    prisma = {
      merchantProfile: { findUnique: jest.fn() },
      deliveryLink: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      order: { findUnique: jest.fn(), findFirst: jest.fn() },
    };
    ordersService = { create: jest.fn(), releaseAwaitingPayment: jest.fn() };
    paymentsService = { createPayment: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryLinksService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrdersService, useValue: ordersService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: ZonesService, useValue: { list: jest.fn().mockResolvedValue([zone]) } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) => (k === 'CLIENT_URL' ? 'https://client.test' : undefined)),
          },
        },
      ],
    }).compile();

    service = module.get(DeliveryLinksService);
    prisma.merchantProfile.findUnique.mockResolvedValue(merchant);
  });

  describe('create', () => {
    it('crea el link con zona vigente y devuelve URL pública', async () => {
      prisma.deliveryLink.create.mockImplementation(({ data }: any) => ({ id: 'dl-1', ...data }));
      const res = await service.create('user-m1', {
        deliveryZone: 'zone-1',
        paymentMethod: 'cash',
      });
      expect(res.url).toMatch(/^https:\/\/client\.test\/order\/delivery\/[0-9a-f]{64}$/);
      expect(res.zone).toEqual({ id: 'zone-1', label: 'Los Ángeles', price: 1500 });
      expect(prisma.deliveryLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            merchantId: 'merchant-1',
            deliveryZone: 'zone-1',
            paymentMethod: 'cash',
            status: 'pending',
          }),
        }),
      );
      // El token crudo nunca se persiste.
      const saved = prisma.deliveryLink.create.mock.calls[0][0].data;
      expect(saved.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(saved).not.toHaveProperty('token');
    });

    it('rechaza zona inexistente', async () => {
      await expect(
        service.create('user-m1', { deliveryZone: 'nope', paymentMethod: 'cash' }),
      ).rejects.toThrow('Barrio de entrega inválido');
      expect(prisma.deliveryLink.create).not.toHaveBeenCalled();
    });

    it('link pagado por el cliente nace en efectivo', async () => {
      prisma.deliveryLink.create.mockImplementation(({ data }: any) => ({ id: 'dl-9', ...data }));
      const res = await service.create('user-m1', {
        deliveryZone: 'zone-1',
        paymentMethod: 'credit',
        paidBy: 'customer',
      } as any);
      expect(res.link.paymentMethod).toBe('cash');
      expect(res.link.paidBy).toBe('customer');
    });

    it('rechaza facturación semanal si el comercio no la tiene activa', async () => {
      prisma.merchantProfile.findUnique.mockResolvedValue({ ...merchant });
      await expect(
        service.create('user-m1', { deliveryZone: 'zone-1', paymentMethod: 'weekly_invoice' }),
      ).rejects.toThrow('facturación semanal');
      expect(prisma.deliveryLink.create).not.toHaveBeenCalled();
    });

    it('rechaza método desconocido', async () => {
      await expect(
        service.create('user-m1', { deliveryZone: 'zone-1', paymentMethod: 'onvopay_card' }),
      ).rejects.toThrow('Método de pago inválido');
    });
  });

  describe('getPublic', () => {
    it('muestra comercio, barrio y precio sin exponer el hash', async () => {
      prisma.deliveryLink.findUnique.mockResolvedValue({
        id: 'dl-1',
        merchantId: 'merchant-1',
        deliveryZone: 'zone-1',
        paymentMethod: 'cash',
        status: 'pending',
        expiresAt: new Date(Date.now() + 1000),
        orderId: null,
      });
      prisma.merchantProfile.findUnique.mockResolvedValue({
        businessName: 'Soda Test',
        logoUrl: null,
        address: 'Nicoya centro',
      });
      const pub: any = await service.getPublic('a'.repeat(64));
      expect(pub.merchantName).toBe('Soda Test');
      expect(pub.zoneLabel).toBe('Los Ángeles');
      expect(pub.price).toBe(1500);
      expect(pub).not.toHaveProperty('tokenHash');
    });

    it('expone paidBy y SINPE (o teléfono como respaldo)', async () => {
      prisma.deliveryLink.findUnique.mockResolvedValue({
        id: 'dl-1',
        merchantId: 'merchant-1',
        deliveryZone: 'zone-1',
        paymentMethod: 'cash',
        paidBy: 'customer',
        status: 'pending',
        expiresAt: new Date(Date.now() + 1000),
        orderId: null,
      });
      prisma.merchantProfile.findUnique.mockResolvedValue({
        businessName: 'Soda Test',
        logoUrl: null,
        address: 'Nicoya centro',
        sinpeNumber: null,
        userId: 'user-m1',
      });
      prisma.user = { findUnique: jest.fn().mockResolvedValue({ phone: '8888-1111' }) } as any;
      const pub: any = await service.getPublic('a'.repeat(64));
      expect(pub.paidBy).toBe('customer');
      expect(pub.sinpeNumber).toBe('8888-1111');
    });

    it('link consumido devuelve el pedido para redirigir al tracking', async () => {
      prisma.deliveryLink.findUnique.mockResolvedValue({
        id: 'dl-1',
        status: 'consumed',
        orderId: 'order-9',
        expiresAt: new Date(),
      });
      prisma.order.findUnique.mockResolvedValue({ id: 'order-9' });
      const pub: any = await service.getPublic('b'.repeat(64));
      expect(pub).toEqual({ consumed: true, orderId: 'order-9' });
    });

    it('link vencido responde Gone', async () => {
      prisma.deliveryLink.findUnique.mockResolvedValue({
        id: 'dl-1',
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000),
        orderId: null,
      });
      await expect(service.getPublic('c'.repeat(64))).rejects.toThrow('venc');
    });
  });

  describe('submit', () => {
    const dto = {
      customerName: 'Ana',
      customerPhone: '88881234',
      deliveryAddress: 'Casa verde',
      packageDescription: 'Documentos',
    };

    function linkRow(overrides = {}) {
      return {
        id: 'dl-1',
        merchantId: 'merchant-1',
        deliveryZone: 'zone-1',
        paymentMethod: 'cash',
        status: 'pending',
        expiresAt: new Date(Date.now() + 1000),
        orderId: null,
        ...overrides,
      };
    }

    it('crea el pedido con pickup del comercio y zona del link, no del cliente', async () => {
      prisma.deliveryLink.findUnique.mockResolvedValue(linkRow());
      prisma.deliveryLink.updateMany.mockResolvedValue({ count: 1 });
      ordersService.create.mockResolvedValue({ id: 'order-1', basePrice: 1500 });
      prisma.deliveryLink.update.mockResolvedValue({});

      const res: any = await service.submit('d'.repeat(64), {
        ...dto,
        // Intento de manipular: pickup y zona ajenos deben ignorarse.
        pickupAddress: 'Otro lado',
        deliveryZone: 'zone-otra',
      } as any);

      expect(res.order.id).toBe('order-1');
      expect(res.reused).toBe(false);
      const data = ordersService.create.mock.calls[0][1];
      expect(data.origin).toBe('merchant_panel');
      expect(data.kind).toBe('freight');
      expect(data.items).toEqual([]);
      expect(data.productsTotal).toBe(0);
      expect(data.pickupAddress).toBe('Nicoya centro');
      expect(data.deliveryZone).toBe('zone-1');
      expect(data.customerPhone).toBe('8888-1234');
      expect(data.paymentMethod).toBe('cash');
      // El link queda atado al pedido.
      expect(prisma.deliveryLink.update).toHaveBeenCalledWith({
        where: { id: 'dl-1' },
        data: { orderId: 'order-1' },
      });
    });

    it('sin descripción usa el default genérico (formulario sin sección)', async () => {
      prisma.deliveryLink.findUnique.mockResolvedValue(linkRow());
      prisma.deliveryLink.updateMany.mockResolvedValue({ count: 1 });
      ordersService.create.mockResolvedValue({ id: 'order-9', basePrice: 1500 });
      prisma.deliveryLink.update.mockResolvedValue({});

      const { customerName, customerPhone, deliveryAddress } = dto;
      await service.submit('f'.repeat(64), { customerName, customerPhone, deliveryAddress });
      const data = ordersService.create.mock.calls[0][1];
      expect(data.packageDescription).toBe('Paquete por entregar');
    });

    it('con crédito cobra el viaje al comercio y libera el pedido', async () => {
      prisma.deliveryLink.findUnique.mockResolvedValue(linkRow({ paymentMethod: 'credit' }));
      prisma.deliveryLink.updateMany.mockResolvedValue({ count: 1 });
      ordersService.create.mockResolvedValue({ id: 'order-2', basePrice: 1500 });
      paymentsService.createPayment.mockResolvedValue({ success: true });
      prisma.deliveryLink.update.mockResolvedValue({});

      await service.submit('e'.repeat(64), dto);
      expect(paymentsService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-2', method: 'credit', amount: 1500 }),
        'user-m1',
        'merchant',
      );
    });

    it('link pagado por el cliente no toca el crédito (nace en efectivo)', async () => {
      prisma.deliveryLink.findUnique.mockResolvedValue(linkRow({ paidBy: 'customer' }));
      prisma.deliveryLink.updateMany.mockResolvedValue({ count: 1 });
      ordersService.create.mockResolvedValue({ id: 'order-3', basePrice: 1500 });
      prisma.deliveryLink.update.mockResolvedValue({});
      paymentsService.createPayment.mockClear();

      await service.submit('h'.repeat(64), dto);
      const data = ordersService.create.mock.calls[0][1];
      expect(data.paymentMethod).toBe('cash');
      expect(paymentsService.createPayment).not.toHaveBeenCalled();
    });

    it('reintento con el mismo link devuelve el pedido sin duplicar', async () => {
      prisma.deliveryLink.findUnique.mockResolvedValue(
        linkRow({ status: 'consumed', orderId: 'order-1' }),
      );
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1' });
      const res: any = await service.submit('f'.repeat(64), dto);
      expect(res).toEqual({ order: { id: 'order-1' }, reused: true });
      expect(ordersService.create).not.toHaveBeenCalled();
    });

    it('exige teléfono CR válido y dirección', async () => {
      prisma.deliveryLink.findUnique.mockResolvedValue(linkRow());
      await expect(
        service.submit('g'.repeat(64), { ...dto, customerPhone: '123' }),
      ).rejects.toThrow('customerPhone');
      await expect(
        service.submit('g'.repeat(64), { ...dto, deliveryAddress: '  ' }),
      ).rejects.toThrow('deliveryAddress');
      expect(prisma.deliveryLink.updateMany).not.toHaveBeenCalled();
    });
  });
});
