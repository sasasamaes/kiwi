import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from './providers/onvopay.provider';
import { StellarProvider } from './providers/stellar.provider';
import { CreditsService } from '../credits/credits.service';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export interface CreatePaymentDTO {
  orderId: string;
  method: 'onvopay_card' | 'onvopay_sinpe' | 'crypto' | 'cash' | 'credit';
  amount: number;
  currency?: string;
  customerEmail?: string;
  customerPhone?: string;
  cryptoCoin?: 'USDC' | 'USDT';
  paymentMethodId?: string; // Tokenized payment method from client
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  checkoutUrl?: string;
  clientSecret?: string;
  walletAddress?: string;
  amountInCrypto?: number;
  exchangeRate?: number;
  qrCode?: string;
  error?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private onvopayProvider: OnvoPayProvider,
    private stellarProvider: StellarProvider,
    private creditsService: CreditsService,
  ) {}

  async createPayment(dto: CreatePaymentDTO, payerUserId?: string): Promise<PaymentResult> {
    const {
      orderId,
      method,
      amount: clientAmount,
      currency,
      customerEmail,
      customerPhone,
      cryptoCoin,
      paymentMethodId,
    } = dto;

    // Validate order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException('Pedido no encontrado');
    }

    // Server is the source of truth for money: the client amount is only
    // a sanity signal, never the charged value. (Strict equality would
    // break legit flows: order.totalAmount covers shipping while clients
    // send cart totals — a pre-existing pricing-model gap. What must never
    // happen is charging the client-supplied number, which this guarantees.)
    const serverAmount = Number(order.totalAmount);
    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      throw new BadRequestException('Total del pedido inválido');
    }
    if (clientAmount !== undefined && Math.abs(Number(clientAmount) - serverAmount) > 0.01) {
      this.logger.warn(
        `Payment amount mismatch for order ${orderId}: client=${clientAmount} server=${serverAmount} — charging server total`,
      );
    }
    const amount = serverAmount;
    if (payerUserId) {
      this.logger.log(`Payment initiated for order ${orderId} by user ${payerUserId}`);
    }

    // Check if payment already exists
    const existingPayment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (existingPayment && existingPayment.status === PaymentStatus.completed) {
      throw new BadRequestException('El pedido ya tiene un pago completado');
    }

    let result: PaymentResult;

    if (method === 'credit') {
      return this.createCreditPayment(orderId, order, payerUserId);
    }

    switch (method) {
      case 'onvopay_card':
      case 'onvopay_sinpe':
        result = await this.createOnvoPayPayment(
          orderId,
          amount,
          method,
          customerEmail,
          customerPhone,
          paymentMethodId,
        );
        break;

      case 'crypto':
        result = await this.createCryptoPayment(orderId, amount, cryptoCoin || 'USDC');
        break;

      case 'cash':
        result = await this.createCashPayment(orderId, amount);
        break;

      default:
        throw new BadRequestException('Método de pago no válido');
    }

    // Save or update payment record
    const paymentData = {
      amount,
      currency: (method === 'crypto' ? cryptoCoin : 'CRC') ?? 'CRC',
      method: method as PaymentMethod,
      status: (result.success ? PaymentStatus.pending : PaymentStatus.failed) as PaymentStatus,
      onvoPaymentId: result.paymentId,
      onvoCheckoutUrl: result.checkoutUrl,
      cryptoCoin: cryptoCoin,
      cryptoWalletAddress: result.walletAddress,
      cryptoAmount: result.amountInCrypto,
      exchangeRate: result.exchangeRate,
    };

    if (existingPayment) {
      await this.prisma.payment.update({
        where: { orderId },
        data: paymentData,
      });
    } else {
      await this.prisma.payment.create({
        data: {
          order: { connect: { id: orderId } },
          ...paymentData,
        },
      });
    }

    return result;
  }

  /**
   * Pago con crédito prepago: solo el dueño comercio del pedido puede usarlo.
   * Descuenta viaje (payout) + comisión de la app — los productos nunca salen
   * del crédito. Si ya hay pago completado, no duplica el gasto.
   */
  private async createCreditPayment(
    orderId: string,
    order: any,
    payerUserId?: string,
  ): Promise<PaymentResult> {
    if (!payerUserId) {
      throw new BadRequestException('Iniciá sesión como comercio para pagar con crédito');
    }
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId: payerUserId },
    });
    if (!merchant || merchant.id !== order.merchantId) {
      throw new ForbiddenException('Solo el comercio dueño puede pagar con crédito');
    }
    const existing = await this.prisma.payment.findUnique({ where: { orderId } });
    if (existing && existing.status === PaymentStatus.completed) {
      throw new BadRequestException('El pedido ya tiene un pago completado');
    }

    // Viaje + comisión (NO productos): basePrice ya es el viaje con recargos.
    const spend = Math.round(Number(order.basePrice) + Number(order.commission));
    if (!Number.isFinite(spend) || spend <= 0) {
      throw new BadRequestException('Monto del envío inválido');
    }

    const { balance } = await this.creditsService.spend(merchant.id, spend, orderId);

    const data = {
      amount: spend,
      currency: 'CRC',
      method: 'credit' as PaymentMethod,
      status: PaymentStatus.completed as PaymentStatus,
    };
    let payment: any;
    if (existing) {
      payment = await this.prisma.payment.update({ where: { orderId }, data });
    } else {
      payment = await this.prisma.payment.create({
        data: { order: { connect: { id: orderId } }, ...data },
      });
    }

    this.logger.log(`Credit payment for order ${orderId}: spent=${spend} balance=${balance}`);
    return { success: true, paymentId: payment.id };
  }

  private async createOnvoPayPayment(
    orderId: string,
    amount: number,
    method: 'onvopay_card' | 'onvopay_sinpe',
    customerEmail?: string,
    customerPhone?: string,
    paymentMethodId?: string,
  ): Promise<PaymentResult> {
    const paymentType = method === 'onvopay_card' ? 'Tarjeta' : 'SINPE';

    // returnUrl/cancelUrl: SIEMPRE https. Un FRONTEND_URL mal configurado
    // (http://) devolvería al usuario a un contexto inseguro justo después
    // de pagar — su momento de mayor exposición.
    const frontendBase = (process.env.FRONTEND_URL ?? process.env.CLIENT_URL ?? '').replace(
      /^http:\/\//i,
      'https://',
    );

    // Create payment intent
    const intentResult = await this.onvopayProvider.createPaymentIntent({
      amount,
      currency: 'CRC',
      description: `Pago Kiwi - Pedido #${orderId.slice(0, 8)} (${paymentType})`,
      orderId,
      customerEmail,
      customerPhone,
      returnUrl: `${frontendBase}/orders/${orderId}/success`,
      cancelUrl: `${frontendBase}/orders/${orderId}/cancel`,
    });

    if (!intentResult.success) {
      return {
        success: false,
        error: intentResult.error,
      };
    }

    // If payment method ID is provided, confirm immediately
    if (paymentMethodId && intentResult.paymentId) {
      const confirmResult = await this.onvopayProvider.confirmPaymentIntent(
        intentResult.paymentId,
        paymentMethodId,
      );

      if (!confirmResult.success) {
        return {
          success: false,
          error: confirmResult.error,
        };
      }

      return {
        success: true,
        paymentId: intentResult.paymentId,
        checkoutUrl: intentResult.checkoutUrl,
        clientSecret: intentResult.clientSecret,
      };
    }

    // Return checkout URL for client-side completion
    return {
      success: true,
      paymentId: intentResult.paymentId,
      checkoutUrl: intentResult.checkoutUrl,
      clientSecret: intentResult.clientSecret,
    };
  }

  private async createCryptoPayment(
    orderId: string,
    amount: number,
    coin: 'USDC' | 'USDT',
  ): Promise<PaymentResult> {
    const result = await this.stellarProvider.createPaymentRequest({
      amount,
      currency: coin,
      orderId,
    });

    return {
      success: result.success,
      paymentId: result.paymentId,
      walletAddress: result.walletAddress,
      amountInCrypto: result.amountInCrypto,
      exchangeRate: result.exchangeRate,
      qrCode: result.qrCode,
      error: result.error,
    };
  }

  private async createCashPayment(orderId: string, amount: number): Promise<PaymentResult> {
    // Cash payments don't need external processing
    const paymentId = `cash_${Date.now()}`;
    return {
      success: true,
      paymentId,
    };
  }

  /**
   * Todos los pagos para el admin: paginado, filtro por estado/método y
   * resumen (totales + últimos 30 días + por método). Sin mocks.
   */
  async listForAdmin(opts: { take?: number; skip?: number; status?: string; method?: string }) {
    const take = Math.min(Math.max(Number(opts.take ?? 30), 1), 100);
    const skip = Math.max(Number(opts.skip ?? 0), 0);
    const where: any = {};
    const validStatus = ['pending', 'processing', 'completed', 'failed', 'refunded'];
    const validMethod = ['onvopay_card', 'onvopay_sinpe', 'crypto', 'cash', 'credit'];
    if (opts.status && validStatus.includes(opts.status)) where.status = opts.status;
    if (opts.method && validMethod.includes(opts.method)) where.method = opts.method;

    const [total, items, byStatus, byMethod, daily] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              merchant: { select: { businessName: true } },
              driver: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.payment.groupBy({
        by: ['status'],
        _count: { status: true },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        _count: { method: true },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<Array<{ day: string; total: number }>>`
        SELECT TO_CHAR("created_at", 'YYYY-MM-DD') AS day, SUM("amount")::float AS total
        FROM "payments"
        WHERE "status" = 'completed' AND "created_at" >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day`,
    ]);

    const sum = (rows: any[], key: string) =>
      Object.fromEntries(
        rows.map((r) => [r[key], { count: r._count[key], amount: Number(r._sum?.amount || 0) }]),
      );

    return {
      total,
      items: items.map((p) => ({ ...p, amount: Number(p.amount) })),
      summary: {
        byStatus: sum(byStatus, 'status'),
        byMethod: sum(byMethod, 'method'),
        daily30: daily.map((d) => ({ date: d.day, amount: Number(d.total) })),
      },
    };
  }

  /**
   * Row-level guard for payment-scoped endpoints. A user may act on a payment
   * intent only through an order they participate in (merchant owner, assigned
   * driver) or if they are admin. `requireMerchant` additionally refuses
   * drivers — refunds/cancellations are merchant/admin actions.
   */
  async assertIntentAccess(
    paymentIntentId: string,
    user: { sub?: string; role?: string },
    requireMerchant = false,
  ) {
    if (user?.role === 'admin') return;

    const payment = await this.prisma.payment.findFirst({
      where: { onvoPaymentId: paymentIntentId },
      include: {
        order: {
          include: {
            merchant: { select: { userId: true } },
            driver: { select: { userId: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new ForbiddenException('No tienes acceso a este pago');
    }

    const userId = user?.sub;
    const isMerchant = payment.order?.merchant?.userId === userId;
    const isDriver = payment.order?.driver?.userId === userId;

    if (requireMerchant ? !isMerchant : !isMerchant && !isDriver) {
      throw new ForbiddenException('No tienes acceso a este pago');
    }
  }

  /** Ownership-scoped variant of getPaymentStatus for the controller. */
  async getPaymentStatusForUser(orderId: string, user: { sub?: string; role?: string }) {
    if (user?.role !== 'admin') {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          merchant: { select: { userId: true } },
          driver: { select: { userId: true } },
        },
      });

      const userId = user?.sub;
      const isMerchant = order?.merchant?.userId === userId;
      const isDriver = order?.driver?.userId === userId;

      if (!order || (!isMerchant && !isDriver)) {
        throw new ForbiddenException('No tienes acceso a este pago');
      }
    }

    return this.getPaymentStatus(orderId);
  }

  async getPaymentStatus(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment) {
      return null;
    }

    // Check with provider if needed
    if (payment.method === 'onvopay_card' || payment.method === 'onvopay_sinpe') {
      if (payment.onvoPaymentId && payment.status === PaymentStatus.pending) {
        const status = await this.onvopayProvider.getPaymentIntentStatus(payment.onvoPaymentId);

        if (status.status === 'succeeded') {
          await this.prisma.payment.update({
            where: { orderId },
            data: { status: PaymentStatus.completed },
          });
          payment.status = PaymentStatus.completed;
        } else if (status.status === 'canceled') {
          await this.prisma.payment.update({
            where: { orderId },
            data: { status: PaymentStatus.failed },
          });
          payment.status = PaymentStatus.failed;
        }
      }
    }

    if (payment.method === 'crypto' && payment.status === PaymentStatus.pending) {
      // Check Stellar transaction
      const verified = await this.stellarProvider.verifyPayment(payment.id);
      if (verified.verified) {
        await this.prisma.payment.update({
          where: { orderId },
          data: { status: PaymentStatus.completed },
        });
        payment.status = PaymentStatus.completed;
      }
    }

    return payment;
  }

  async handleWebhook(provider: string, payload: any, signature?: string) {
    this.logger.log(`Received ${provider} webhook`);

    switch (provider) {
      case 'onvopay':
        return this.handleOnvoPayWebhook(payload, signature);
      case 'stellar':
        return this.handleStellarWebhook(payload);
      default:
        this.logger.warn(`Unknown webhook provider: ${provider}`);
    }
  }

  private async handleOnvoPayWebhook(payload: any, signature?: string) {
    // Verify webhook signature - reject when missing or invalid
    if (
      !signature ||
      !this.onvopayProvider.verifyWebhookSignature(JSON.stringify(payload), signature)
    ) {
      this.logger.error('Invalid or missing OnvoPay webhook signature');
      return { received: false, error: 'Invalid signature' };
    }

    const { type, data } = payload;

    // Handle different event types
    if (type === 'payment_intent.succeeded') {
      const { metadata } = data ?? {};
      const orderId = metadata?.orderId;

      if (orderId) {
        const res = await this.prisma.payment.updateMany({
          where: { orderId },
          data: { status: PaymentStatus.completed },
        });
        if (res.count === 0) {
          this.logger.warn(`Webhook for unknown order ${orderId} — ignoring`);
          return { received: true, unknownOrder: true };
        }

        // NOTE: order stays pending until a driver claims it. Marking it
        // assigned here (without driverId) hid it from getAvailableOrders
        // (status != pending) while belonging to nobody — a lost order.

        this.logger.log(`Payment completed for order ${orderId}`);
      }
    } else if (type === 'payment_intent.canceled') {
      const { metadata } = data ?? {};
      const orderId = metadata?.orderId;

      if (orderId) {
        await this.prisma.payment.updateMany({
          where: { orderId },
          data: { status: PaymentStatus.failed },
        });

        this.logger.log(`Payment cancelled for order ${orderId}`);
      }
    }

    return { received: true };
  }

  private async handleStellarWebhook(payload: any) {
    const { transactionHash, orderId } = payload ?? {};

    if (!orderId || !transactionHash) {
      this.logger.warn('Stellar webhook missing orderId/transactionHash — ignoring');
      return { received: true, ignored: true };
    }

    // Verify transaction on Stellar
    const verified = await this.stellarProvider.verifyPayment(orderId);

    if (verified.verified) {
      const res = await this.prisma.payment.updateMany({
        where: { orderId },
        data: {
          status: PaymentStatus.completed,
          cryptoTxHash: transactionHash,
        },
      });
      if (res.count === 0) {
        this.logger.warn(`Stellar webhook for unknown order ${orderId} — ignoring`);
        return { received: true, unknownOrder: true };
      }

      this.logger.log(`Crypto payment verified for order ${orderId}`);
    }

    return { received: true };
  }

  async getPaymentMethods() {
    return [
      {
        id: 'onvopay_sinpe',
        name: 'SINPE Móvil',
        icon: '📱',
        description: 'Transferencia instantánea',
        type: 'fiat',
        available: true,
      },
      {
        id: 'onvopay_card',
        name: 'Tarjeta',
        icon: '💳',
        description: 'Crédito o débito',
        type: 'fiat',
        available: true,
      },
      {
        id: 'crypto_usdc',
        name: 'USDC',
        icon: '💵',
        description: 'Stablecoin USD (Stellar)',
        type: 'crypto',
        available: true,
      },
      {
        id: 'crypto_usdt',
        name: 'USDT',
        icon: '💲',
        description: 'Tether USD (Stellar)',
        type: 'crypto',
        available: true,
      },
      {
        id: 'cash',
        name: 'Efectivo',
        icon: '💵',
        description: 'Pagar al repartidor',
        type: 'cash',
        available: true,
      },
    ];
  }

  /**
   * Create a customer in OnvoPay
   */
  async createOnvoCustomer(
    email: string,
    phone?: string,
    userId?: string,
  ): Promise<{ customerId: string }> {
    return this.onvopayProvider.createCustomer(email, phone);
  }

  /**
   * List payment methods for a customer
   */
  async listOnvoPaymentMethods(customerId: string): Promise<{ methods: any[] }> {
    const result = await this.onvopayProvider.listPaymentMethods(customerId);
    return { methods: result.paymentMethods || [] };
  }

  /**
   * Setup recurring payment for a customer
   */
  async setupRecurringPayment(
    customerId: string,
  ): Promise<{ setupIntentId: string; clientSecret: string }> {
    return this.onvopayProvider.createSetupIntent(customerId);
  }
}
