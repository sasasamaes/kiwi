// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';
import { StellarProvider } from '../payments/providers/stellar.provider';
import { CreditsService } from '../credits/credits.service';

describe('PaymentsService facturación semanal sin doble-cobro', () => {
  let service: PaymentsService;
  let prisma: any;

  const order = { id: 'order-1', merchantId: 'merchant-1', basePrice: 2000, totalAmount: 2500 };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(),
      },
      merchantProfile: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      creditTransaction: { create: jest.fn() },
      // La transacción interactiva corre el callback contra el mismo mock.
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    prisma.merchantProfile.findUnique.mockResolvedValue({
      id: 'merchant-1',
      userId: 'user-1',
      weeklyBillingEnabled: true,
    });
    prisma.payment.update.mockResolvedValue({ id: 'pay-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OnvoPayProvider, useValue: {} },
        { provide: StellarProvider, useValue: {} },
        { provide: CreditsService, useValue: { spend: jest.fn() } },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  const dto = () => ({ orderId: 'order-1', method: 'weekly_invoice', amount: 2500 }) as any;

  it('cobra solo el viaje y no toca el crédito prepago', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
    await expect(service.createPayment(dto(), 'user-1')).resolves.toMatchObject({
      success: true,
    });
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 2000, method: 'weekly_invoice' }),
      }),
    );
    expect(prisma.merchantProfile.updateMany).not.toHaveBeenCalled();
    expect(prisma.merchantProfile.update).not.toHaveBeenCalled();
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('sin flag activo rechaza antes de crear el pago', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({
      id: 'merchant-1',
      userId: 'user-1',
      weeklyBillingEnabled: false,
    });
    await expect(service.createPayment(dto(), 'user-1')).rejects.toThrow('facturación semanal');
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('otro comercio no puede usar la facturación ajena', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({
      id: 'merchant-2',
      userId: 'user-2',
      weeklyBillingEnabled: true,
    });
    await expect(service.createPayment(dto(), 'user-2')).rejects.toThrow('Solo el comercio dueño');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('pedido ya pagado no duplica', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', status: 'completed' });
    await expect(service.createPayment(dto(), 'user-1')).rejects.toThrow('completado');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('doble tap concurrente: el perdedor del reclamo no crea de más', async () => {
    prisma.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'pay-1', status: 'processing' });
    const p2002 = Object.assign(new Error('unique'), { code: 'P2002' });
    prisma.payment.create.mockResolvedValueOnce({ id: 'pay-1' }).mockRejectedValueOnce(p2002);
    await expect(service.createPayment(dto(), 'user-1')).resolves.toMatchObject({
      success: true,
    });
    await expect(service.createPayment(dto(), 'user-1')).rejects.toThrow('en curso');
    expect(prisma.payment.create).toHaveBeenCalledTimes(2);
  });
});
