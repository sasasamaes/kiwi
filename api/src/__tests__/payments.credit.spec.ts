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
  let credits: any;

  const order = { id: 'order-1', merchantId: 'merchant-1', basePrice: 2000, totalAmount: 2000 };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      merchantProfile: { findUnique: jest.fn() },
    };
    credits = { spend: jest.fn().mockResolvedValue({ spent: 2000, balance: 8000 }) };
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1', userId: 'user-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OnvoPayProvider, useValue: {} },
        { provide: StellarProvider, useValue: {} },
        { provide: CreditsService, useValue: credits },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  it('doble tap concurrente: el perdedor del reclamo no gasta', async () => {
    // Cada llamada hace 2 findUnique (chequeo exterior + interior).
    // Llamada 1: [null, null] → reclama y gasta.
    // Llamada 2: pasa el chequeo exterior (null) pero pierde el reclamo
    // (P2002) y al re-leer ve la fila en curso → 'en curso', sin gastar.
    prisma.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'pay-1', status: 'processing' });
    const p2002 = Object.assign(new Error('unique'), { code: 'P2002' });
    prisma.payment.create.mockResolvedValueOnce({ id: 'pay-1' }).mockRejectedValueOnce(p2002);
    prisma.payment.upsert.mockResolvedValue({ id: 'pay-1' });

    const dto = { orderId: 'order-1', method: 'credit', amount: 2000 } as any;
    await expect(service.createPayment(dto, 'user-1')).resolves.toMatchObject({ success: true });
    await expect(service.createPayment(dto, 'user-1')).rejects.toThrow('en curso');
    expect(credits.spend).toHaveBeenCalledTimes(1);
  });

  it('pedido ya pagado no gasta', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', status: 'completed' });
    await expect(
      service.createPayment(
        { orderId: 'order-1', method: 'credit', amount: 2000 } as any,
        'user-1',
      ),
    ).rejects.toThrow('completado');
    expect(credits.spend).not.toHaveBeenCalled();
  });

  it('si el spend falla, libera el reclamo para reintentar', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.payment.update.mockResolvedValue({ id: 'pay-1' });
    credits.spend.mockRejectedValue(new BadRequestException('Saldo insuficiente'));
    await expect(
      service.createPayment(
        { orderId: 'order-1', method: 'credit', amount: 2000 } as any,
        'user-1',
      ),
    ).rejects.toThrow('Saldo insuficiente');
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });
});
