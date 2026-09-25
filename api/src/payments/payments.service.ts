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

  async createPayment(
    dto: CreatePaymentDTO,
    payerUserId?: string,
    payerRole?: string,
  ): Promise<PaymentResult> {
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

    // Solo el comercio dueño del pedido (o admin) puede iniciar/modificar
    // su cobro. Sin esto, cualquier usuario logueado generaba checkouts y
    // pisaba la fila payment de pedidos ajenos. Los invitados usan el
    // flujo público createGuestPayment (mismo link, sin cuenta).
    if (!payerUserId) {
      throw new ForbiddenException('Iniciá sesión como comercio para iniciar el cobro');
    }

    // Validate order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException('Pedido no encontrado');
    }

    if (payerRole !== 'admin') {
      const merchant = await this.prisma.merchantProfile.findUnique({
        where: { userId: payerUserId },
        select: { id: true },
      });
      if (!merchant || merchant.id !== order.merchantId) {
        throw new ForbiddenException('Solo el comercio dueño puede gestionar este cobro');
      }
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

    if (method === 'credit') {
      return this.createCreditPayment(orderId, order, payerUserId);
    }

    const result = await this.runProviderPayment(orderId, method, amount, {
      customerEmail,
      customerPhone,
      cryptoCoin,
      paymentMethodId,
    });
    await this.savePaymentRecord(orderId, existingPayment, method, amount, cryptoCoin, result);

    return result;
  }

  /**
   * Cobro invitado (link público, sin cuenta): mismo checkout que el flujo
   * logueado pero sin dueño que validar — el UUID del pedido es la
   * credencial. Reglas: nunca crédito prepago, nunca sobre un pago
   * completado, y si ya hay un checkout pendiente se devuelve la URL
   * existente en vez de crear (y pisar) otro. El dinero solo se mueve en
   * Onvo cuando el comprador completa el checkout; aquí solo se prepara.
   */
  async createGuestPayment(dto: CreatePaymentDTO): Promise<PaymentResult> {
    const { orderId, method, customerEmail, customerPhone, cryptoCoin } = dto;

    if (method === 'credit') {
      throw new ForbiddenException('El crédito prepago requiere cuenta de comercio');
    }
    if (
      method !== 'onvopay_card' &&
      method !== 'onvopay_sinpe' &&
      method !== 'crypto' &&
      method !== 'cash'
    ) {
      throw new BadRequestException('Método de pago no válido');
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new BadRequestException('Pedido no encontrado');
    }
    if (order.status === 'delivered' || order.status === 'cancelled') {
      throw new BadRequestException('El pedido ya no admite pagos');
    }

    const serverAmount = Number(order.totalAmount);
    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      throw new BadRequestException('Total del pedido inválido');
    }

    const existingPayment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (existingPayment && existingPayment.status === PaymentStatus.completed) {
      throw new BadRequestException('El pedido ya tiene un pago completado');
    }
    if (
      existingPayment &&
      existingPayment.status === PaymentStatus.pending &&
      (existingPayment as any).onvoCheckoutUrl
    ) {
      this.logger.log(`Guest payment reuses pending checkout for order ${orderId}`);
      return {
        success: true,
        checkoutUrl: (existingPayment as any).onvoCheckoutUrl,
        paymentId:
          (existingPayment as any).onvoSessionId ??
          (existingPayment as any).onvoPaymentId ??
          undefined,
      };
    }

    const result = await this.runProviderPayment(orderId, method, serverAmount, {
      customerEmail,
      customerPhone,
      cryptoCoin,
    });
    await this.savePaymentRecord(
      orderId,
      existingPayment,
      method,
      serverAmount,
      cryptoCoin,
      result,
    );
    return result;
  }

  /**
   * Ejecuta el proveedor (Onvo/crypto/cash) y arma el PaymentResult.
   * El monto cobrado es siempre el total del servidor, nunca el del cliente.
   */
  private async runProviderPayment(
    orderId: string,
    method: string,
    amount: number,
    contact: {
      customerEmail?: string;
      customerPhone?: string;
      cryptoCoin?: 'USDC' | 'USDT';
      paymentMethodId?: string;
    },
  ): Promise<PaymentResult> {
    switch (method) {
      case 'onvopay_card':
      case 'onvopay_sinpe':
        return this.createOnvoPayPayment(
          orderId,
          amount,
          method,
          contact.customerEmail,
          contact.customerPhone,
          contact.paymentMethodId,
        );
      case 'crypto':
        return this.createCryptoPayment(orderId, amount, contact.cryptoCoin || 'USDC');
      case 'cash':
        return this.createCashPayment(orderId, amount);
      default:
        throw new BadRequestException('Método de pago no válido');
    }
  }

  /**
   * Persiste (crea o actualiza) la fila payment de la orden.
   * Checkout hospedado: result.paymentId es la SESIÓN (no el intent); el
   * intent real llega por webhook y se guarda entonces en onvoPaymentId.
   */
  private async savePaymentRecord(
    orderId: string,
    existingPayment: any,
    method: string,
    amount: number,
    cryptoCoin: 'USDC' | 'USDT' | undefined,
    result: PaymentResult,
  ): Promise<void> {
    const isCheckoutSession =
      (method === 'onvopay_card' || method === 'onvopay_sinpe') && result.checkoutUrl != null;
    const paymentData = {
      amount,
      currency: (method === 'crypto' ? cryptoCoin : 'CRC') ?? 'CRC',
      method: method as PaymentMethod,
      status: (result.success ? PaymentStatus.pending : PaymentStatus.failed) as PaymentStatus,
      onvoPaymentId: isCheckoutSession ? undefined : result.paymentId,
      onvoSessionId: isCheckoutSession ? result.paymentId : undefined,
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
  }

  /**
   * Pago con crédito prepago: solo el dueño comercio del pedido puede usarlo.
   * Descuenta SOLO el viaje — el comercio no paga comisión (la paga el
   * repartidor desde su payout) y los productos nunca salen del crédito.
   * Si ya hay pago completado, no duplica el gasto.
   *
   * Anti doble-cobro: la fila payment (orderId UNIQUE) se reclama PRIMERO con
   * create. Dos llamadas concurrentes (doble tap/retry) chocan en P2002 y la
   * perdedora no llega al spend. Sin esto, ambas descontaban crédito y el
   * upsert final pisaba una sola fila (cobro 2×, una fila).
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

    // Solo el viaje (NO productos, NO comisión): basePrice ya es el viaje
    // con recargos. La comisión la paga el repartidor desde su payout.
    const spend = Math.round(Number(order.basePrice));
    if (!Number.isFinite(spend) || spend <= 0) {
      throw new BadRequestException('Monto del envío inválido');
    }

    // Reclamo atómico de la fila (orderId UNIQUE). Si ya existe una fila no
    // completada de otro intento/método, no se pisa: se descuenta una sola vez.
    if (!existing) {
      try {
        await this.prisma.payment.create({
          data: {
            order: { connect: { id: orderId } },
            amount: spend,
            currency: 'CRC',
            method: 'credit' as PaymentMethod,
            status: PaymentStatus.processing as PaymentStatus,
          },
        });
      } catch (e: any) {
        if (e?.code === 'P2002') {
          const raced = await this.prisma.payment.findUnique({ where: { orderId } });
          if (raced?.status === PaymentStatus.completed) {
            throw new BadRequestException('El pedido ya tiene un pago completado');
          }
          throw new BadRequestException('Ya hay un pago en curso para este pedido');
        }
        throw e;
      }
    } else if (existing.status !== PaymentStatus.failed) {
      // Hay un pago pendiente/en curso de otro intento: no gastar de más.
      throw new BadRequestException('Ya hay un pago en curso para este pedido');
    }

    let balance = 0;
    try {
      ({ balance } = await this.creditsService.spend(merchant.id, spend, orderId));
    } catch (e) {
      // Liberar el reclamo para que se pueda reintentar.
      await this.prisma.payment
        .update({ where: { orderId }, data: { status: PaymentStatus.failed } })
        .catch(() => null);
      throw e;
    }

    const data = {
      amount: spend,
      currency: 'CRC',
      method: 'credit' as PaymentMethod,
      status: PaymentStatus.completed as PaymentStatus,
    };
    const payment = await this.prisma.payment.upsert({
      where: { orderId },
      update: data,
      create: { order: { connect: { id: orderId } }, ...data },
    });

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

    // redirectUrl/cancelUrl: SIEMPRE https. Un FRONTEND_URL mal configurado
    // (http://) devolvería al usuario a un contexto inseguro justo después
    // de pagar — su momento de mayor exposición. Sin env, canónico www
    // (jamás relativo: Onvo rechaza o pierde el retorno post-pago).
    const frontendBase = (
      process.env.FRONTEND_URL ??
      process.env.CLIENT_URL ??
      'https://www.kiwicr.express'
    ).replace(/^http:\/\//i, 'https://');

    // Flujo oficial tarjeta/SINPE (Checkout hospedado):
    // sesión → redirect a `url` → webhook marca completado.
    // https://docs.onvopay.com/checkout/overview
    const sessionResult = await this.onvopayProvider.createCheckoutSession({
      amount,
      currency: 'CRC',
      description: `Pago Kiwi - Pedido #${orderId.slice(0, 8)} (${paymentType})`,
      orderId,
      customerEmail,
      customerPhone,
      redirectUrl: `${frontendBase}/tracking/${orderId}?paid=1`,
      cancelUrl: `${frontendBase}/tracking/${orderId}?cancelled=1`,
    });

    if (!sessionResult.success) {
      return {
        success: false,
        error: sessionResult.error,
      };
    }

    // paymentMethodId directo (integración 100% API) se mantiene para
    // compatibilidad, pero el flujo normal es Checkout: sin método previo
    // se devuelve la URL y el comprador paga en ONVO.
    if (paymentMethodId) {
      const intentResult = await this.onvopayProvider.createPaymentIntent({
        amount,
        currency: 'CRC',
        description: `Pago Kiwi - Pedido #${orderId.slice(0, 8)} (${paymentType})`,
        orderId,
        customerEmail,
        customerPhone,
        returnUrl: `${frontendBase}/tracking/${orderId}?paid=1`,
        cancelUrl: `${frontendBase}/tracking/${orderId}?cancelled=1`,
      });
      if (!intentResult.success) {
        return { success: false, error: intentResult.error };
      }
      const confirmResult = await this.onvopayProvider.confirmPaymentIntent(
        intentResult.paymentId as string,
        paymentMethodId,
      );
      if (!confirmResult.success) {
        return { success: false, error: confirmResult.error };
      }
      // Confirmado directo: ya no hace falta redirect, y el intent queda
      // guardado como tal (no como sesión).
      return {
        success: true,
        paymentId: intentResult.paymentId,
        clientSecret: intentResult.clientSecret,
      };
    }

    // Return checkout URL for client-side completion
    return {
      success: true,
      paymentId: sessionResult.sessionId,
      checkoutUrl: sessionResult.checkoutUrl,
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
    if (opts.status && !validStatus.includes(opts.status)) {
      throw new BadRequestException(`status inválido: ${opts.status}`);
    }
    if (opts.method && !validMethod.includes(opts.method)) {
      throw new BadRequestException(`method inválido: ${opts.method}`);
    }
    if (opts.status) where.status = opts.status;
    if (opts.method) where.method = opts.method;

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

    // El flujo oficial guarda la SESIÓN (onvoSessionId) y el intent real
    // llega después por webhook; el directo guarda el intent. Buscar por
    // ambos o los 5 endpoints 403ean pagos por checkout.
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [{ onvoPaymentId: paymentIntentId }, { onvoSessionId: paymentIntentId }],
      },
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

  /**
   * Estado grueso para el link público (invitados): solo si está pagado o
   * no. Sin montos ni detalles — mismo modelo de confianza que el tracking.
   * Reconcilia con ONVO antes de responder para no mentir con filas viejas.
   */
  async getPublicPaidStatus(orderId: string): Promise<{ paid: boolean }> {
    const payment = await this.getPaymentStatus(orderId);
    return { paid: payment?.status === PaymentStatus.completed };
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
      if (payment.status === PaymentStatus.pending) {
        // Checkout hospedado: se consulta la SESIÓN (el intent aún no existe
        // o vive solo en ONVO hasta el webhook).
        const sessionId = (payment as any).onvoSessionId;
        if (sessionId) {
          const session = await this.onvopayProvider.getCheckoutSession(sessionId);
          if (session.paymentIntentId && !payment.onvoPaymentId) {
            await this.prisma.payment.update({
              where: { orderId },
              data: { onvoPaymentId: session.paymentIntentId },
            });
            payment.onvoPaymentId = session.paymentIntentId;
          }
          const paid =
            session.paymentStatus === 'paid' ||
            session.status === 'complete' ||
            session.status === 'succeeded';
          const dead =
            session.status === 'expired' ||
            session.status === 'canceled' ||
            session.status === 'cancelled';
          if (paid || dead) {
            await this.prisma.payment.update({
              where: { orderId },
              data: { status: paid ? PaymentStatus.completed : PaymentStatus.failed },
            });
            payment.status = paid ? PaymentStatus.completed : PaymentStatus.failed;
          }
        } else if (payment.onvoPaymentId) {
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
    }

    if (payment.method === 'crypto' && payment.status === PaymentStatus.pending) {
      // Verificación on-chain real: escanea los pagos entrantes a la wallet
      // receptora y exige asset, monto y tx confirmada. Fail-closed: cualquier
      // error deja el pago pending para reintentar en la próxima consulta.
      // Dedup anti doble-gasto: se excluyen las txs que ya acreditaron otro
      // pedido completado de la misma wallet receptora.
      const usedHashes = await this.prisma.payment.findMany({
        where: {
          cryptoWalletAddress: (payment as any).cryptoWalletAddress ?? undefined,
          status: PaymentStatus.completed,
          cryptoTxHash: { not: null },
          NOT: { orderId },
        },
        select: { cryptoTxHash: true },
      });
      const verified = await this.stellarProvider.verifyOrderPayment({
        orderId,
        expectedAmount: Number(payment.cryptoAmount ?? 0),
        expectedAsset: (payment.cryptoCoin as 'USDC' | 'USDT') ?? 'USDC',
        expectedWallet: (payment as any).cryptoWalletAddress ?? null,
        since: payment.createdAt,
        excludeTxHashes: usedHashes.map((p) => p.cryptoTxHash as string),
      });
      if (verified.verified) {
        await this.markCryptoCompleted(orderId, verified.txHash);
        payment.status = PaymentStatus.completed;
      }
    }

    return payment;
  }

  async handleWebhook(provider: string, payload: any, signature?: string, rawBody?: string) {
    this.logger.log(`Received ${provider} webhook`);

    switch (provider) {
      case 'onvopay':
        return this.handleOnvoPayWebhook(payload, signature, rawBody);
      case 'stellar':
        return this.handleStellarWebhook(payload);
      default:
        this.logger.warn(`Unknown webhook provider: ${provider}`);
    }
  }

  private async handleOnvoPayWebhook(payload: any, signature?: string, rawBody?: string) {
    // Verify webhook signature - reject when missing or invalid.
    // Onvo firma los bytes crudos: usar rawBody cuando el controller lo
    // capturó; el re-stringify solo como fallback (dev/tests).
    const signedPayload =
      typeof rawBody === 'string' && rawBody.length > 0 ? rawBody : JSON.stringify(payload);
    if (!signature || !this.onvopayProvider.verifyWebhookSignature(signedPayload, signature)) {
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
    } else if (type === 'checkout-session.succeeded') {
      // Checkout hospedado: la sesión trae metadata.orderId y el intent real.
      // Se guarda el intent para reembolsos/cancelaciones futuras.
      const orderId = data?.metadata?.orderId;
      const paymentIntentId = data?.paymentIntentId;
      if (orderId) {
        const res = await this.prisma.payment.updateMany({
          where: { orderId },
          data: {
            status: PaymentStatus.completed,
            ...(paymentIntentId ? { onvoPaymentId: paymentIntentId } : {}),
          },
        });
        if (res.count === 0) {
          this.logger.warn(`Checkout webhook for unknown order ${orderId} — ignoring`);
          return { received: true, unknownOrder: true };
        }
        this.logger.log(`Checkout session completed for order ${orderId}`);
      } else if (paymentIntentId) {
        const res = await this.prisma.payment.updateMany({
          where: { onvoPaymentId: paymentIntentId },
          data: { status: PaymentStatus.completed },
        });
        if (res.count === 0) {
          this.logger.warn('Checkout webhook without order match — ignoring');
          return { received: true, unknownOrder: true };
        }
        this.logger.log(`Checkout session completed for intent ${paymentIntentId}`);
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

    // Endpoint PÚBLICO sin firma HMAC: cualquiera podría POSTear
    // "orderId + tx inventado". La verificación on-chain es la única
    // autenticación — nunca confiar en el payload para marcar pagado.
    // El hash aporta quien llama: se usa solo como puntero a la tx, que se
    // descarga y valida contra la wallet receptora, asset y monto esperados.
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: {
        status: true,
        cryptoAmount: true,
        cryptoCoin: true,
        cryptoTxHash: true,
      },
    });
    if (!payment) {
      this.logger.warn(`Stellar webhook for unknown order ${orderId} — ignoring`);
      return { received: true, unknownOrder: true };
    }
    if (payment.status === PaymentStatus.completed) {
      this.logger.log(`Stellar webhook for already-completed order ${orderId} — ignoring`);
      return { received: true, alreadyCompleted: true };
    }

    // Dedup entre pedidos: si la tx ya acreditó OTRO pedido (mismo hash, distinto
    // orderId), este webhook es fraude o un retry cruzado — no acreditar dos veces.
    const reused = await this.prisma.payment.findFirst({
      where: { cryptoTxHash: transactionHash, NOT: { orderId } },
      select: { orderId: true },
    });
    if (reused) {
      this.logger.error(
        `Stellar webhook REUSE: tx ${transactionHash} already credited order ${reused.orderId} — rejecting for ${orderId}`,
      );
      return { received: true, rejected: 'tx_already_used' };
    }

    const verified = await this.stellarProvider.verifyTransactionForOrder({
      txHash: transactionHash,
      orderId,
      expectedAmount: Number(payment.cryptoAmount ?? 0),
      expectedAsset: (payment.cryptoCoin as 'USDC' | 'USDT') ?? 'USDC',
    });

    if (verified.verified) {
      const done = await this.markCryptoCompleted(orderId, transactionHash);
      if (!done) {
        this.logger.warn(`Stellar webhook for unknown order ${orderId} — ignoring`);
        return { received: true, unknownOrder: true };
      }
      this.logger.log(`Crypto payment verified for order ${orderId} (tx ${transactionHash})`);
    } else {
      this.logger.warn(
        `Stellar webhook on-chain verification FAILED for order ${orderId} (${verified.reason ?? 'unknown'}) — not marking paid`,
      );
    }

    return { received: true };
  }

  /**
   * Marca un pago crypto completado guardando el tx hash, con guarda anti-
   * carrera: updateMany condicionado a status != completed. Dos carreras
   * (webhook + polling simultáneos) no re-acreditan ni pisan el hash ya
   * guardado. Devuelve true si esta llamada fue la que completó el pago.
   */
  private async markCryptoCompleted(orderId: string, txHash?: string): Promise<boolean> {
    try {
      const res = await this.prisma.payment.updateMany({
        where: { orderId, NOT: { status: PaymentStatus.completed } },
        data: {
          status: PaymentStatus.completed,
          ...(txHash ? { cryptoTxHash: txHash } : {}),
        },
      });
      return res.count > 0;
    } catch (e: any) {
      // Índice único en crypto_tx_hash: otra orden ganó la carrera por esta tx
      // (webhook + polling simultáneos). No es un error del sistema.
      if (e?.code === 'P2002') return false;
      throw e;
    }
  }

  async getPaymentMethods() {
    // Crypto solo se ofrece con wallet receptora configurada (o mock de dev):
    // sin eso, el QR apuntaría a una dirección que no es nuestra.
    const cryptoAvailable = this.stellarProvider.isConfigured();
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
        available: cryptoAvailable,
      },
      {
        id: 'crypto_usdt',
        name: 'USDT',
        icon: '💲',
        description: 'Tether USD (Stellar)',
        type: 'crypto',
        available: cryptoAvailable,
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
