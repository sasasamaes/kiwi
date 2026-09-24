import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';
import { StellarProvider } from '../payments/providers/stellar.provider';
import { CreditsService } from '../credits/credits.service';

describe('PaymentsService — row-level payment access', () => {
  let service: PaymentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      payment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OnvoPayProvider, useValue: {} },
        { provide: StellarProvider, useValue: {} },
        { provide: CreditsService, useValue: { spend: jest.fn() } },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('assertIntentAccess', () => {
    const paymentRow = {
      id: 'pay-1',
      onvoPaymentId: 'pi-123',
      order: {
        merchant: { userId: 'u-merch' },
        driver: { userId: 'u-driver' },
      },
    };

    it('permite al comercio dueño de la orden', async () => {
      prisma.payment.findFirst.mockResolvedValue(paymentRow);

      await expect(
        service.assertIntentAccess('pi-123', { sub: 'u-merch', role: 'merchant' }),
      ).resolves.toBeUndefined();
    });

    it('permite al repartidor asignado (lectura/cancelación)', async () => {
      prisma.payment.findFirst.mockResolvedValue(paymentRow);

      await expect(
        service.assertIntentAccess('pi-123', { sub: 'u-driver', role: 'driver' }),
      ).resolves.toBeUndefined();
    });

    it('bloquea a un tercero autenticado aunque conozca el intent id', async () => {
      prisma.payment.findFirst.mockResolvedValue(paymentRow);

      await expect(
        service.assertIntentAccess('pi-123', { sub: 'u-raro', role: 'merchant' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('bloquea si ningún pago local corresponde al intent (enumeración)', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.assertIntentAccess('pi-desconocido', { sub: 'u-raro', role: 'merchant' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refund (requireMerchant) rechaza al repartidor', async () => {
      prisma.payment.findFirst.mockResolvedValue(paymentRow);

      await expect(
        service.assertIntentAccess('pi-123', { sub: 'u-driver', role: 'driver' }, true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('admin pasa sin consulta', async () => {
      await expect(
        service.assertIntentAccess('pi-123', { sub: 'u-admin', role: 'admin' }),
      ).resolves.toBeUndefined();
      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    });

    it('encuentra pagos del flujo checkout por session id', async () => {
      prisma.payment.findFirst.mockResolvedValue(paymentRow);

      await expect(
        service.assertIntentAccess('clcs-session-1', { sub: 'u-merch', role: 'merchant' }),
      ).resolves.toBeUndefined();
      expect(prisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ onvoPaymentId: 'clcs-session-1' }, { onvoSessionId: 'clcs-session-1' }],
          },
        }),
      );
    });
  });

  describe('getPaymentStatusForUser', () => {
    it('permite al dueño y delega en getPaymentStatus', async () => {
      prisma.order.findUnique.mockResolvedValue({
        merchant: { userId: 'u-merch' },
        driver: { userId: 'u-driver' },
      });
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.getPaymentStatusForUser('o-1', { sub: 'u-driver', role: 'driver' }),
      ).resolves.toBeNull();
    });

    it('rechaza a un usuario ajeno al pedido', async () => {
      prisma.order.findUnique.mockResolvedValue({
        merchant: { userId: 'u-merch' },
        driver: { userId: 'u-driver' },
      });

      await expect(
        service.getPaymentStatusForUser('o-1', { sub: 'u-raro', role: 'merchant' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza pedidos inexistentes sin filtrar existencia', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getPaymentStatusForUser('o-fantasma', { sub: 'u-raro', role: 'driver' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
