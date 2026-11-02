// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';
import { StellarProvider } from '../payments/providers/stellar.provider';
import { CreditsService } from '../credits/credits.service';

describe('PaymentsService crédito sin doble-cobro', () => {
  let service: PaymentsService;
  let prisma: any;

  const order = { id: 'order-1', merchantId: 'merchant-1', basePrice: 2000, totalAmount: 2000 };

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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      creditTransaction: { create: jest.fn().mockResolvedValue({ id: 'tx-1' }) },
      // La transacción interactiva corre el callback contra el mismo mock.
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });
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

  it('doble tap concurrente: el perdedor del reclamo no gasta', async () => {
    // Llamada 1: sin pago previo → crea + descuenta + completa en una tx.
    // Llamada 2: pasa el chequeo exterior (null) pero pierde el reclamo
    // (P2002) y al re-leer ve la fila en curso → 'en curso', sin gastar.
    prisma.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'pay-1', status: 'processing' });
    const p2002 = Object.assign(new Error('unique'), { code: 'P2002' });
    prisma.payment.create.mockResolvedValueOnce({ id: 'pay-1' }).mockRejectedValueOnce(p2002);

    const dto = { orderId: 'order-1', method: 'credit', amount: 2000 } as any;
    await expect(service.createPayment(dto, 'user-1')).resolves.toMatchObject({ success: true });
    await expect(service.createPayment(dto, 'user-1')).rejects.toThrow('en curso');
    // Un solo descuento aunque hubo dos intentos.
    expect(prisma.merchantProfile.updateMany).toHaveBeenCalledTimes(1);
  });

  it('pedido cancelado o entregado ya no admite pagos (ni toca crédito)', async () => {
    for (const status of ['cancelled', 'delivered']) {
      prisma.order.findUnique.mockResolvedValueOnce({
        id: 'order-9',
        merchantId: 'merchant-1',
        basePrice: 2000,
        totalAmount: 2000,
        status,
      });
      await expect(
        service.createPayment(
          { orderId: 'order-9', method: 'credit', amount: 2000 } as any,
          'user-1',
        ),
      ).rejects.toThrow('ya no admite pagos');
    }
    // Ni un solo descuento: el cancelado no rebaja crédito.
    expect(prisma.merchantProfile.updateMany).not.toHaveBeenCalled();
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('pedido ya pagado no gasta', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', status: 'completed' });
    await expect(
      service.createPayment(
        { orderId: 'order-1', method: 'credit', amount: 2000 } as any,
        'user-1',
      ),
    ).rejects.toThrow('completado');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('si el saldo no alcanza, la transacción revierte y se puede reintentar', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.merchantProfile.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.createPayment(
        { orderId: 'order-1', method: 'credit', amount: 2000 } as any,
        'user-1',
      ),
    ).rejects.toThrow('Saldo insuficiente');
    // Ni asiento ni complete: todo revirtió junto.
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('reintento sobre pago fallido reclama y cobra una sola vez', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', status: 'failed' });
    await expect(
      service.createPayment(
        { orderId: 'order-1', method: 'credit', amount: 2000 } as any,
        'user-1',
      ),
    ).resolves.toMatchObject({ success: true });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'failed' }) }),
    );
    expect(prisma.merchantProfile.updateMany).toHaveBeenCalledTimes(1);
  });
});
