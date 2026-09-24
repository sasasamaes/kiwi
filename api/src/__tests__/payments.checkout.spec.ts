import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';
import { StellarProvider } from '../payments/providers/stellar.provider';
import { CreditsService } from '../credits/credits.service';
import { ConfigService } from '@nestjs/config';

describe('OnvoPay Checkout hospedado (one-time-link)', () => {
  let service: PaymentsService;
  let provider: OnvoPayProvider;
  let prisma: any;
  let fetchSpy: jest.SpyInstance;

  const order = { id: 'order-1', merchantId: 'merchant-1', basePrice: 1500, totalAmount: 1500 };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      merchantProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'merchant-1' }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        OnvoPayProvider,
        { provide: PrismaService, useValue: prisma },
        { provide: StellarProvider, useValue: {} },
        { provide: CreditsService, useValue: { spend: jest.fn() } },
        { provide: ConfigService, useValue: { get: (k: string) => undefined } },
      ],
    }).compile();

    service = module.get(PaymentsService);
    provider = module.get(OnvoPayProvider);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.ONVO_SECRET_KEY;
  });

  it('crea sesión con céntimos, redirectUrl y metadata.orderId', async () => {
    process.env.ONVO_SECRET_KEY = 'onvo_test_secret';
    const prov = new OnvoPayProvider({ get: () => 'onvo_test_secret' } as any);
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'clcs1', url: 'https://checkout.onvopay.com/pay/clcs1' }),
    });

    const res = await prov.createCheckoutSession({
      amount: 1500,
      currency: 'CRC',
      description: 'Pedido',
      orderId: 'order-1',
      redirectUrl: 'https://x/tracking/order-1?paid=1',
      cancelUrl: 'https://x/tracking/order-1?cancelled=1',
    });

    expect(res).toMatchObject({
      success: true,
      checkoutUrl: 'https://checkout.onvopay.com/pay/clcs1',
      sessionId: 'clcs1',
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.lineItems).toEqual([
      expect.objectContaining({ quantity: 1, unitAmount: 150000, currency: 'CRC' }),
    ]);
    expect(body.redirectUrl).toContain('paid=1');
    expect(body.metadata.orderId).toBe('order-1');
    expect(fetchSpy.mock.calls[0][0]).toContain('/checkout/sessions/one-time-link');
  });

  it('sin secret key falla explícito (no URL fantasma)', async () => {
    const prov = new OnvoPayProvider({ get: () => '' } as any);
    const res = await prov.createCheckoutSession({
      amount: 1500,
      currency: 'CRC',
      description: 'Pedido',
      orderId: 'order-1',
      redirectUrl: 'https://x/?paid=1',
      cancelUrl: 'https://x/?cancelled=1',
    });
    expect(res.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('el pago con tarjeta guarda sessionId (no intent) y devuelve la url', async () => {
    const provWithKey = new OnvoPayProvider({ get: () => 'onvo_test_secret' } as any);
    (service as any).onvopayProvider = provWithKey;
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'clcs1', url: 'https://checkout.onvopay.com/pay/clcs1' }),
    });
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });

    const res = await service.createPayment(
      {
        orderId: 'order-1',
        method: 'onvopay_card',
        amount: 1500,
        customerEmail: 'a@x.com',
        customerPhone: '88888888',
      },
      'user-dueno',
    );

    expect(res.success).toBe(true);
    expect(res.checkoutUrl).toBe('https://checkout.onvopay.com/pay/clcs1');
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onvoSessionId: 'clcs1' }),
      }),
    );
    const saved = prisma.payment.create.mock.calls[0][0].data;
    expect(saved.onvoPaymentId).toBeUndefined();
  });

  it('webhook checkout-session.succeeded completa y guarda el intent', async () => {
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });

    const res = await (service as any).handleOnvoPayWebhook(
      {
        type: 'checkout-session.succeeded',
        data: { metadata: { orderId: 'order-1' }, paymentIntentId: 'clpi1' },
      },
      'sig',
    );

    expect(res).toEqual({ received: true });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'order-1' },
        data: expect.objectContaining({ status: 'completed', onvoPaymentId: 'clpi1' }),
      }),
    );
  });

  it('webhook de orden desconocida no revienta', async () => {
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });

    const res = await (service as any).handleOnvoPayWebhook(
      {
        type: 'checkout-session.succeeded',
        data: { metadata: { orderId: 'nope' } },
      },
      'sig',
    );

    expect(res).toEqual({ received: true, unknownOrder: true });
  });

  it('getPaymentStatus reconcilia la sesión pagada', async () => {
    const provWithKey = new OnvoPayProvider({ get: () => 'onvo_test_secret' } as any);
    (service as any).onvopayProvider = provWithKey;
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'clcs1',
        status: 'complete',
        paymentStatus: 'paid',
        paymentIntentId: 'clpi1',
      }),
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      method: 'onvopay_card',
      status: 'pending',
      onvoSessionId: 'clcs1',
      onvoPaymentId: null,
    });
    prisma.payment.update.mockResolvedValue({});

    const res = await service.getPaymentStatus('order-1');

    expect(res.status).toBe('completed');
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('un tercero no inicia el cobro de un pedido ajeno', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'otro-comercio' });
    await expect(
      service.createPayment(
        { orderId: 'order-1', method: 'onvopay_card', amount: 1500 } as any,
        'user-raro',
      ),
    ).rejects.toThrow('Solo el comercio dueño');
  });

  it('sin pagador no hay cobro', async () => {
    await expect(
      service.createPayment({ orderId: 'order-1', method: 'onvopay_card', amount: 1500 } as any),
    ).rejects.toThrow('Iniciá sesión');
  });

  it('guest: reusa el checkout pendiente en vez de pisarlo', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...order, status: 'pending' });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'pending',
      onvoCheckoutUrl: 'https://checkout.onvopay.com/pay/clcs1',
      onvoSessionId: 'clcs1',
      onvoPaymentId: null,
    });

    const res = await service.createGuestPayment({
      orderId: 'order-1',
      method: 'onvopay_card',
    } as any);

    expect(res).toMatchObject({
      success: true,
      checkoutUrl: 'https://checkout.onvopay.com/pay/clcs1',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('guest: nunca sobre pago completado ni con crédito', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...order, status: 'pending' });
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', status: 'completed' });
    await expect(
      service.createGuestPayment({ orderId: 'order-1', method: 'onvopay_card' } as any),
    ).rejects.toThrow('completado');

    await expect(
      service.createGuestPayment({ orderId: 'order-1', method: 'credit' } as any),
    ).rejects.toThrow('cuenta de comercio');
  });

  it('guest: pedido entregado ya no admite pagos', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...order, status: 'delivered' });
    prisma.payment.findUnique.mockResolvedValue(null);
    await expect(
      service.createGuestPayment({ orderId: 'order-1', method: 'cash' } as any),
    ).rejects.toThrow('ya no admite pagos');
  });
});
