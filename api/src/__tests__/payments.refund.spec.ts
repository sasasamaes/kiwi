// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';
import { StellarProvider } from '../payments/providers/stellar.provider';
import { CreditsService } from '../credits/credits.service';

describe('PaymentsService refund + webhook amount guard', () => {
  let service: PaymentsService;
  let prisma: any;
  let onvo: any;

  const admin = { sub: 'admin-1', role: 'admin' };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn() },
      payment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      creditTopup: { findUnique: jest.fn() },
    };
    onvo = {
      refundPayment: jest.fn().mockResolvedValue({ success: true, refundId: 'ref-1' }),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OnvoPayProvider, useValue: onvo },
        { provide: StellarProvider, useValue: {} },
        { provide: CreditsService, useValue: {} },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('refund rechaza monto negativo', async () => {
    await expect(service.refundOnvoPayment('pi-1', -500, admin)).rejects.toThrow(
      'Monto de reembolso inválido',
    );
    expect(onvo.refundPayment).not.toHaveBeenCalled();
  });

  it('refund rechaza monto mayor a lo cobrado', async () => {
    prisma.payment.findFirst.mockResolvedValue({ amount: 2000, status: 'completed' });

    await expect(service.refundOnvoPayment('pi-1', 5000, admin)).rejects.toThrow(
      'supera lo cobrado',
    );
    expect(onvo.refundPayment).not.toHaveBeenCalled();
  });

  it('refund rechaza pago no completado', async () => {
    prisma.payment.findFirst.mockResolvedValue({ amount: 2000, status: 'pending' });

    await expect(service.refundOnvoPayment('pi-1', 1000, admin)).rejects.toThrow(
      'Solo se puede reembolsar un pago completado',
    );
    expect(onvo.refundPayment).not.toHaveBeenCalled();
  });

  it('refund válido delega a Onvo con el monto acotado', async () => {
    prisma.payment.findFirst.mockResolvedValue({ amount: 2000, status: 'completed' });

    const res = await service.refundOnvoPayment('pi-1', 1500, admin);

    expect(res).toEqual({ success: true, refundId: 'ref-1' });
    expect(onvo.refundPayment).toHaveBeenCalledWith('pi-1', 1500);
  });

  it('webhook con monto menor NO completa el pago', async () => {
    prisma.order.findUnique.mockResolvedValue({ totalAmount: 2000 });

    const res = await (service as any).handleOnvoPayWebhook(
      {
        type: 'payment_intent.succeeded',
        data: { id: 'pi-1', amount: 500, currency: 'CRC', metadata: { orderId: 'order-1' } },
      },
      'sig',
    );

    expect(res).toEqual({ received: true, amountMismatch: true });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('webhook con monto exacto completa y guarda el intent', async () => {
    prisma.order.findUnique.mockResolvedValue({ totalAmount: 2000 });

    const res = await (service as any).handleOnvoPayWebhook(
      {
        type: 'payment_intent.succeeded',
        data: { id: 'pi-1', amount: 2000, currency: 'CRC', metadata: { orderId: 'order-1' } },
      },
      'sig',
    );

    expect(res).toEqual({ received: true });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed', onvoPaymentId: 'pi-1' }),
      }),
    );
  });

  it('webhook sin monto mantiene el comportamiento actual (completa)', async () => {
    prisma.order.findUnique.mockResolvedValue({ totalAmount: 2000 });

    const res = await (service as any).handleOnvoPayWebhook(
      {
        type: 'checkout-session.succeeded',
        data: { metadata: { orderId: 'order-1' }, paymentIntentId: 'clpi1' },
      },
      'sig',
    );

    expect(res).toEqual({ received: true });
  });
});
