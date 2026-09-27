// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';
import { StellarProvider } from '../payments/providers/stellar.provider';
import { CreditsService } from '../credits/credits.service';
import { PaymentStatus } from '@prisma/client';

/**
 * Flujo crypto end-to-end (sin red): reconciliación polling + webhook.
 * Regla bajo test: una tx solo acredita un pedido, y solo con verificación
 * on-chain real (el provider es el que decide; acá se mockea su veredicto).
 */
describe('PaymentsService — pagos crypto (dedup y webhook)', () => {
  let service: PaymentsService;
  let prisma: any;
  let stellar: {
    verifyOrderPayment: jest.Mock;
    verifyTransactionForOrder: jest.Mock;
    isConfigured: jest.Mock;
  };

  const ORDER = 'order-crypto-1';
  const TX = 'a'.repeat(64);
  const TX2 = 'b'.repeat(64);

  const pendingCryptoPayment = (over: Record<string, any> = {}) => ({
    orderId: ORDER,
    method: 'crypto',
    status: PaymentStatus.pending,
    cryptoCoin: 'USDC',
    cryptoAmount: 12,
    cryptoWalletAddress: 'GWALLET',
    cryptoTxHash: null,
    createdAt: new Date('2026-09-25T12:00:00Z'),
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      payment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: { findUnique: jest.fn() },
    };
    stellar = {
      verifyOrderPayment: jest.fn().mockResolvedValue({ verified: false }),
      verifyTransactionForOrder: jest.fn().mockResolvedValue({ verified: false }),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OnvoPayProvider, useValue: {} },
        { provide: StellarProvider, useValue: stellar },
        { provide: CreditsService, useValue: { spend: jest.fn() } },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('getPaymentStatus — reconciliación polling', () => {
    it('pago verificado on-chain → marca completed y guarda tx hash', async () => {
      prisma.payment.findUnique.mockResolvedValue(pendingCryptoPayment());
      stellar.verifyOrderPayment.mockResolvedValue({ verified: true, txHash: TX });

      const res = await service.getPaymentStatus(ORDER);

      expect(stellar.verifyOrderPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: ORDER,
          expectedAmount: 12,
          expectedAsset: 'USDC',
          expectedWallet: 'GWALLET',
          excludeTxHashes: [],
        }),
      );
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { orderId: ORDER, NOT: { status: PaymentStatus.completed } },
        data: { status: PaymentStatus.completed, cryptoTxHash: TX },
      });
      expect(res.status).toBe(PaymentStatus.completed);
    });

    it('pasa los hashes ya usados por otros pedidos al provider (dedup)', async () => {
      prisma.payment.findUnique.mockResolvedValue(pendingCryptoPayment());
      prisma.payment.findMany.mockResolvedValue([{ cryptoTxHash: TX }]);

      await service.getPaymentStatus(ORDER);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PaymentStatus.completed,
            NOT: { orderId: ORDER },
          }),
        }),
      );
      expect(stellar.verifyOrderPayment).toHaveBeenCalledWith(
        expect.objectContaining({ excludeTxHashes: [TX] }),
      );
    });

    it('no verificado → sigue pending, sin updates', async () => {
      prisma.payment.findUnique.mockResolvedValue(pendingCryptoPayment());
      stellar.verifyOrderPayment.mockResolvedValue({
        verified: false,
        reason: 'no_matching_payment',
      });

      const res = await service.getPaymentStatus(ORDER);

      expect(res.status).toBe(PaymentStatus.pending);
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook stellar', () => {
    const callWebhook = () =>
      (service as any).handleStellarWebhook({ orderId: ORDER, transactionHash: TX });

    it('verificación on-chain OK → marca completed con el hash real', async () => {
      prisma.payment.findUnique.mockResolvedValue(pendingCryptoPayment());
      prisma.payment.findFirst.mockResolvedValue(null);
      stellar.verifyTransactionForOrder.mockResolvedValue({ verified: true, txHash: TX });

      const res = await callWebhook();

      expect(stellar.verifyTransactionForOrder).toHaveBeenCalledWith({
        txHash: TX,
        orderId: ORDER,
        expectedAmount: 12,
        expectedAsset: 'USDC',
      });
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { orderId: ORDER, NOT: { status: PaymentStatus.completed } },
        data: { status: PaymentStatus.completed, cryptoTxHash: TX },
      });
      expect(res.received).toBe(true);
    });

    it('verificación fallida → no toca la fila', async () => {
      prisma.payment.findUnique.mockResolvedValue(pendingCryptoPayment());
      prisma.payment.findFirst.mockResolvedValue(null);
      stellar.verifyTransactionForOrder.mockResolvedValue({
        verified: false,
        reason: 'no_matching_payment',
      });

      const res = await callWebhook();

      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(res.received).toBe(true);
    });

    it('tx ya acreditada por otro pedido → rechaza sin verificar ni marcar', async () => {
      prisma.payment.findUnique.mockResolvedValue(pendingCryptoPayment());
      prisma.payment.findFirst.mockResolvedValue({ orderId: 'order-otro' });

      const res = await callWebhook();

      expect(stellar.verifyTransactionForOrder).not.toHaveBeenCalled();
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(res.rejected).toBe('tx_already_used');
    });

    it('pedido ya completado → ignora (idempotente)', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        pendingCryptoPayment({ status: PaymentStatus.completed, cryptoTxHash: TX }),
      );
      prisma.payment.findFirst.mockResolvedValue(null);

      const res = await callWebhook();

      expect(stellar.verifyTransactionForOrder).not.toHaveBeenCalled();
      expect(res.alreadyCompleted).toBe(true);
    });

    it('pedido desconocido → unknownOrder, sin tocar nada', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      const res = await callWebhook();

      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
      expect(res.unknownOrder).toBe(true);
    });

    it('payload sin orderId o hash → ignored', async () => {
      expect((await (service as any).handleStellarWebhook({ orderId: ORDER })).ignored).toBe(true);
      expect((await (service as any).handleStellarWebhook({ transactionHash: TX })).ignored).toBe(
        true,
      );
    });

    it('carrera P2002 por índice único → responde recibido sin lanzar', async () => {
      prisma.payment.findUnique.mockResolvedValue(pendingCryptoPayment());
      prisma.payment.findFirst.mockResolvedValue(null);
      stellar.verifyTransactionForOrder.mockResolvedValue({ verified: true, txHash: TX2 });
      prisma.payment.updateMany.mockRejectedValue({ code: 'P2002' });

      const res = await callWebhook();
      expect(res.received).toBe(true);
    });
  });

  describe('listPendingCryptoAdmin', () => {
    it('lista solo crypto no completado con order y montos normalizados', async () => {
      prisma.payment.count.mockResolvedValue(1);
      prisma.payment.findMany.mockResolvedValue([
        {
          orderId: ORDER,
          cryptoCoin: 'USDT',
          cryptoAmount: '12.5',
          cryptoWalletAddress: 'GWALLET',
          cryptoTxHash: null,
          status: PaymentStatus.pending,
          createdAt: new Date('2026-09-25T12:00:00Z'),
          order: {
            id: ORDER,
            status: 'pending',
            totalAmount: '9500',
            merchant: { businessName: 'Soda La Puerta' },
          },
        },
      ]);

      const res = await (service as any).listPendingCryptoAdmin({ take: 10 });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ method: 'crypto' }),
        }),
      );
      expect(res.total).toBe(1);
      expect(res.items[0]).toMatchObject({
        orderId: ORDER,
        coin: 'USDT',
        expectedAmount: 12.5,
        order: { businessName: 'Soda La Puerta', totalAmount: 9500 },
      });
    });
  });

  describe('adminReverifyCrypto', () => {
    it('pago inexistente → 400', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect((service as any).adminReverifyCrypto(ORDER)).rejects.toThrow('no encontrado');
    });

    it('método no crypto → 400', async () => {
      prisma.payment.findUnique.mockResolvedValue({ method: 'cash', status: 'pending' });
      await expect((service as any).adminReverifyCrypto(ORDER)).rejects.toThrow('crypto');
    });

    it('ya completado → respuesta inmediata sin re-verificar', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        method: 'crypto',
        status: PaymentStatus.completed,
      });

      const res = await (service as any).adminReverifyCrypto(ORDER);

      expect(res).toMatchObject({ rechecked: true, alreadyCompleted: true, completed: true });
      expect(stellar.verifyOrderPayment).not.toHaveBeenCalled();
    });

    it('delega en getPaymentStatus (verificación on-chain real) y reporta resultado', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        method: 'crypto',
        status: PaymentStatus.pending,
      });
      // getPaymentStatus re-consulta la fila + on-chain via provider:
      prisma.payment.findUnique.mockResolvedValueOnce({
        method: 'crypto',
        status: PaymentStatus.pending,
      });
      prisma.payment.findUnique.mockResolvedValueOnce(pendingCryptoPayment());
      prisma.payment.findMany.mockResolvedValue([]);
      stellar.verifyOrderPayment.mockResolvedValue({ verified: true, txHash: TX });

      const res = await (service as any).adminReverifyCrypto(ORDER);

      expect(stellar.verifyOrderPayment).toHaveBeenCalled();
      expect(res).toMatchObject({ rechecked: true, completed: true, txHash: TX });
    });

    it('sin evidencia → completed:false con razón, sin lanzar', async () => {
      prisma.payment.findUnique
        .mockResolvedValueOnce({ method: 'crypto', status: PaymentStatus.pending })
        .mockResolvedValueOnce(pendingCryptoPayment());
      prisma.payment.findMany.mockResolvedValue([]);
      stellar.verifyOrderPayment.mockResolvedValue({
        verified: false,
        reason: 'no_matching_payment',
      });

      const res = await (service as any).adminReverifyCrypto(ORDER);

      expect(res.completed).toBe(false);
      expect(res.reason).toBe('no_matching_payment');
    });
  });
});
