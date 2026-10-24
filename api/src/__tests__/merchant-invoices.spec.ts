// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { MerchantInvoicesService } from '../payments/merchant-invoices.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MerchantInvoicesService corte semanal idempotente', () => {
  let service: MerchantInvoicesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      merchantProfile: { findUnique: jest.fn() },
      payment: { findMany: jest.fn(), updateMany: jest.fn() },
      merchantInvoice: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MerchantInvoicesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(MerchantInvoicesService);
  });

  it('generar dos veces no duplica: la segunda devuelve el corte existente', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm-1', businessName: 'Soda' });
    const lines = [
      {
        id: 'pay-1',
        orderId: 'o-1',
        amount: 2000,
        order: {
          deliveredAt: new Date('2026-10-21T12:00:00-06:00'),
          pickupAddress: 'A',
          deliveryAddress: 'B',
          distanceKm: 2,
          driver: { fullName: 'Juan' },
        },
      },
    ];
    prisma.payment.findMany.mockResolvedValue(lines);
    prisma.merchantInvoice.create.mockResolvedValue({ id: 'inv-1' });
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    // detail() tras crear
    prisma.merchantInvoice.findUnique.mockResolvedValueOnce({
      id: 'inv-1',
      merchantId: 'm-1',
      merchant: { businessName: 'Soda' },
      periodStart: new Date(),
      periodEnd: new Date(),
      trips: 1,
      amount: 2000,
      status: 'pending',
      paidAt: null,
      payments: lines,
    });
    const first = await service.generate('admin-1', 'm-1', '2026-10-20');
    expect(first.id).toBe('inv-1');

    // Segundo intento: ya no hay líneas sueltas → devuelve el existente.
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.merchantInvoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      merchantId: 'm-1',
      merchant: { businessName: 'Soda' },
      periodStart: new Date(),
      periodEnd: new Date(),
      trips: 1,
      amount: 2000,
      status: 'pending',
      paidAt: null,
      payments: lines,
    });
    const second = await service.generate('admin-1', 'm-1', '2026-10-20');
    expect(second.id).toBe('inv-1');
    expect(prisma.merchantInvoice.create).toHaveBeenCalledTimes(1);
  });

  it('marcar cobrado solo pasa de pending a paid una vez', async () => {
    prisma.merchantInvoice.updateMany.mockResolvedValue({ count: 1 });
    prisma.merchantInvoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      merchantId: 'm-1',
      merchant: { businessName: 'Soda' },
      status: 'paid',
      amount: 2000,
      payments: [],
    });
    const res = await service.markPaid('admin-1', 'inv-1');
    expect(res.status).toBe('paid');

    prisma.merchantInvoice.updateMany.mockResolvedValue({ count: 0 });
    prisma.merchantInvoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'paid',
      merchant: { businessName: 'Soda' },
      payments: [],
    });
    await expect(service.markPaid('admin-1', 'inv-1')).rejects.toThrow('ya está cobrada');
  });
});
