// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
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
      if (payerRole === 'customer') {
        // El cliente dueño paga su propio pedido (tarjeta/SINPE/efectivo).
        // El crédito prepago es saldo del comercio, jamás del cliente.
        if (!order.customerId || order.customerId !== payerUserId) {
          throw new ForbiddenException('Solo puedes pagar tus propios pedidos');
        }
        if (method === 'credit') {
          throw new ForbiddenException('El crédito prepago es solo del comercio');
        }
      } else {
        const merchant = await this.prisma.merchantProfile.findUnique({
          where: { userId: payerUserId },
          select: { id: true },
        });
        if (!merchant || merchant.id !== order.merchantId) {
          throw new ForbiddenException('Solo el comercio dueño puede gestionar este cobro');
        }
      }
    }

    // Tarjeta/SINPE solo si el comercio pasó el KYC de Onvo (flag del admin).
    // Marketplace: la cuenta conectada `active` también habilita.
    let seller: string | undefined;
    if (method === 'onvopay_card' || method === 'onvopay_sinpe') {
      const payee = await this.prisma.merchantProfile.findUnique({
        where: { id: order.merchantId },
        select: {
          cardPaymentsEnabled: true,
          onvoConnectedAccountId: true,
          onvoOnboardingStatus: true,
        },
      });
      if (!(payee?.cardPaymentsEnabled || payee?.onvoOnboardingStatus === 'active')) {
        throw new BadRequestException('Este comercio aún no cobra con tarjeta (solo efectivo)');
      }
      seller =
        payee?.onvoOnboardingStatus === 'active'
          ? (payee.onvoConnectedAccountId ?? undefined)
          : undefined;
      // Express/flete: el cobro liquida a la cuenta conectada del repartidor
      // asignado, no a la del comercio. Solo express + driverId; los pedidos
      // de comercio quedan byte-idénticos.
      if ((order as any).orderType === 'express' && (order as any).driverId) {
        const driver = await this.prisma.driverProfile.findUnique({
          where: { id: (order as any).driverId },
          select: { onvoConnectedAccountId: true, onvoOnboardingStatus: true },
        });
        seller =
          driver?.onvoOnboardingStatus === 'active'
            ? (driver.onvoConnectedAccountId ?? undefined)
            : undefined;
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

    // Reintento seguro: si ya hay un checkout pendiente con URL, se devuelve
    // la misma en vez de crear otra sesión (cada sesión es cobrable y el
    // retry por timeout/wifi duplicaba el cobro). Igual que el flujo invitado.
    const reused = this.reusePendingCheckout(existingPayment);
    if (reused) {
      this.logger.log(`Payment reuses pending checkout for order ${orderId}`);
      return reused;
    }

    if (method === 'credit') {
      return this.createCreditPayment(orderId, order, payerUserId);
    }

    const result = await this.runProviderPayment(orderId, method, amount, {
      customerEmail,
      customerPhone,
      cryptoCoin,
      paymentMethodId,
      onBehalfOf: seller,
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
    // Tarjeta/SINPE solo si el comercio pasó el KYC de Onvo (igual que logueado).
    // Marketplace: la cuenta conectada `active` también habilita.
    let guestSeller: string | undefined;
    if (method === 'onvopay_card' || method === 'onvopay_sinpe') {
      const payee = await this.prisma.merchantProfile.findUnique({
        where: { id: order.merchantId },
        select: {
          cardPaymentsEnabled: true,
          onvoConnectedAccountId: true,
          onvoOnboardingStatus: true,
        },
      });
      if (!(payee?.cardPaymentsEnabled || payee?.onvoOnboardingStatus === 'active')) {
        throw new BadRequestException('Este comercio aún no cobra con tarjeta (solo efectivo)');
      }
      guestSeller =
        payee?.onvoOnboardingStatus === 'active'
          ? (payee.onvoConnectedAccountId ?? undefined)
          : undefined;
      // Express/flete invitado: igual que el flujo logueado, el seller es la
      // cuenta activa del repartidor asignado. Solo express + driverId.
      if ((order as any).orderType === 'express' && (order as any).driverId) {
        const guestDriver = await this.prisma.driverProfile.findUnique({
          where: { id: (order as any).driverId },
          select: { onvoConnectedAccountId: true, onvoOnboardingStatus: true },
        });
        guestSeller =
          guestDriver?.onvoOnboardingStatus === 'active'
            ? (guestDriver.onvoConnectedAccountId ?? undefined)
            : undefined;
      }
    }

    const serverAmount = Number(order.totalAmount);
    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      throw new BadRequestException('Total del pedido inválido');
    }

    const existingPayment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (existingPayment && existingPayment.status === PaymentStatus.completed) {
      throw new BadRequestException('El pedido ya tiene un pago completado');
    }
    const reusedGuest = this.reusePendingCheckout(existingPayment);
    if (reusedGuest) {
      this.logger.log(`Guest payment reuses pending checkout for order ${orderId}`);
      return reusedGuest;
    }

    const result = await this.runProviderPayment(orderId, method, serverAmount, {
      customerEmail,
      customerPhone,
      cryptoCoin,
      onBehalfOf: guestSeller,
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
   * El webhook firmado autentica el evento, pero no garantiza que lo cobrado
   * cubra el total (reintentos parciales, planes viejos, currency distinta).
   * Si el payload trae monto y NO cubre, no se completa: se devuelve
   * amountMismatch para que el retry/polling lo reconcilie. Sin monto en el
   * payload no hay nada que validar (comportamiento actual).
   * Unidades: se acepta el total exacto en colones o en céntimos; con moneda
   * explícita distinta de CRC se rechaza siempre.
   */
  private webhookAmountCovers(expectedTotal: unknown, data: any): boolean {
    const raw = data?.amount ?? data?.amountPaid ?? data?.total;
    const n = Number(raw);
    if (raw == null || !Number.isFinite(n) || n <= 0) return true;
    const currency = data?.currency != null ? String(data.currency).toUpperCase() : null;
    if (currency && currency !== 'CRC') return false;
    const total = Math.round(Number(expectedTotal));
    if (!Number.isFinite(total) || total <= 0) return true;
    return n === total || n === total * 100 || (currency === 'CRC' && n > total);
  }

  /**
   * ¿Lo cobrado cubre el total del pedido? Lee el total del servidor (nunca
   * el del webhook) y compara. Si no cubre, loguea y NO completa.
   */
  private async orderAmountCovers(orderId: string, data: any): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { totalAmount: true },
    });
    if (!order) return true; // el updateMany de abajo reporta unknownOrder
    if (this.webhookAmountCovers(order.totalAmount, data)) return true;
    this.logger.error(
      `Webhook amount mismatch for order ${orderId}: payload=${JSON.stringify(data?.amount ?? data)} total=${order.totalAmount} — NOT completing`,
    );
    return false;
  }

  /**
   * ¿Lo cobrado cubre la recarga? Igual que pedidos, contra el monto de la
   * fila credit_topups.
   */
  private async topupAmountCovers(topupId: string, data: any): Promise<boolean> {
    const topup = await this.prisma.creditTopup.findUnique({
      where: { id: topupId },
      select: { amount: true },
    });
    if (!topup) return true; // completeTopup reporta topup desconocido
    if (this.webhookAmountCovers(topup.amount, data)) return true;
    this.logger.error(
      `Webhook amount mismatch for topup ${topupId}: payload=${JSON.stringify(data?.amount ?? data)} expected=${topup.amount} — NOT completing`,
    );
    return false;
  }

  /**
   * Checkout pendiente reutilizable: si el intento anterior dejó una URL de
   * checkout sin completar (timeout, wifi caído, reintento), se devuelve esa
   * misma sesión en vez de crear otra cobrable. Solo aplica a Onvo hosted
   * checkout (card/sinpe con URL); crypto/cash generan cotización nueva.
   */
  private reusePendingCheckout(existingPayment: any): PaymentResult | null {
    if (
      existingPayment &&
      existingPayment.status === PaymentStatus.pending &&
      (existingPayment as any).onvoCheckoutUrl
    ) {
      return {
        success: true,
        checkoutUrl: (existingPayment as any).onvoCheckoutUrl,
        paymentId:
          (existingPayment as any).onvoSessionId ??
          (existingPayment as any).onvoPaymentId ??
          undefined,
      };
    }
    return null;
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
      onBehalfOf?: string;
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
          contact.onBehalfOf,
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
   * Todo el cobro (reclamo + descuento + asiento + complete) corre en UNA
   * sola transacción: si cualquier paso falla, el saldo queda intacto y el
   * retry puede reintentar. Antes el spend y el upsert final eran escrituras
   * sueltas: si el upsert fallaba, el crédito quedaba descontado con el pago
   * en `processing` y el retry moría en "pago en curso" (plata perdida).
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
    if (existing && existing.status !== PaymentStatus.failed) {
      // Hay un pago pendiente/en curso de otro intento: no gastar de más.
      throw new BadRequestException('Ya hay un pago en curso para este pedido');
    }

    // Solo el viaje (NO productos, NO comisión): basePrice ya es el viaje
    // con recargos. La comisión la paga el repartidor desde su payout.
    const spend = Math.round(Number(order.basePrice));
    if (!Number.isFinite(spend) || spend <= 0) {
      throw new BadRequestException('Monto del envío inválido');
    }

    try {
      const { payment, balance } = await this.prisma.$transaction(async (tx) => {
        if (!existing) {
          // Reclamo de la fila (orderId UNIQUE): dos llamadas concurrentes
          // chocan en P2002 y la perdedora no llega al spend.
          await tx.payment.create({
            data: {
              order: { connect: { id: orderId } },
              amount: spend,
              currency: 'CRC',
              method: 'credit' as PaymentMethod,
              status: PaymentStatus.processing as PaymentStatus,
            },
          });
        } else {
          // Fila fallida de un intento anterior: se reclama solo si sigue
          // en failed. Si otro retry la tomó en el medio, count===0 y no se
          // gasta de más.
          const claimed = await tx.payment.updateMany({
            where: { orderId, status: PaymentStatus.failed },
            data: {
              amount: spend,
              status: PaymentStatus.processing as PaymentStatus,
            },
          });
          if (claimed.count === 0) {
            throw new BadRequestException('Ya hay un pago en curso para este pedido');
          }
        }
        // Descuento condicional: solo si alcanza. Con bloqueo de fila, dos
        // retries concurrentes se serializan y el segundo revierte si no hay
        // saldo para ambos.
        const charged = await tx.merchantProfile.updateMany({
          where: { id: merchant.id, creditBalance: { gte: spend } },
          data: { creditBalance: { decrement: spend } },
        });
        if (charged.count === 0) {
          throw new BadRequestException(
            'Saldo insuficiente. Recargá con tarjeta en Mi crédito o llamá a Kiwi.',
          );
        }
        await tx.creditTransaction.create({
          data: {
            merchantId: merchant.id,
            amount: -spend,
            kind: 'spend',
            orderId,
            reason: 'Envío del pedido',
          },
        });
        const completed = await tx.payment.update({
          where: { orderId },
          data: { status: PaymentStatus.completed as PaymentStatus },
        });
        const updated = await tx.merchantProfile.findUnique({ where: { id: merchant.id } });
        return { payment: completed, balance: Number(updated?.creditBalance ?? 0) };
      });

      this.logger.log(`Credit payment for order ${orderId}: spent=${spend} balance=${balance}`);
      return { success: true, paymentId: payment.id };
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      if (e?.code === 'P2002') {
        const raced = await this.prisma.payment.findUnique({ where: { orderId } });
        if (raced?.status === PaymentStatus.completed) {
          throw new BadRequestException('El pedido ya tiene un pago completado');
        }
        throw new BadRequestException('Ya hay un pago en curso para este pedido');
      }
      throw e;
    }
  }

  private async createOnvoPayPayment(
    orderId: string,
    amount: number,
    method: 'onvopay_card' | 'onvopay_sinpe',
    customerEmail?: string,
    customerPhone?: string,
    paymentMethodId?: string,
    onBehalfOf?: string,
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
      onBehalfOf,
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

    if (
      payment.method === 'crypto' &&
      (payment.status === PaymentStatus.pending || payment.status === PaymentStatus.processing)
    ) {
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
        if (verified.txHash) (payment as any).cryptoTxHash = verified.txHash;
      }
    }

    return payment;
  }

  /**
   * Pagos crypto no completados (admin): filas con wallet, monto esperado y
   * coin, para la vista de reconciliación. SIN verificación on-chain en el
   * listado (no golpea Horizon en masa); la evidencia se pide fila a fila
   * con adminReverifyCrypto.
   */
  async listPendingCryptoAdmin(opts: { take?: number; skip?: number }) {
    const take = Math.min(Math.max(Number(opts.take ?? 30), 1), 100);
    const skip = Math.max(Number(opts.skip ?? 0), 0);
    const where = {
      method: 'crypto' as PaymentMethod,
      status: { in: [PaymentStatus.pending, PaymentStatus.processing] as PaymentStatus[] },
    };

    const [total, items] = await Promise.all([
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
            },
          },
        },
      }),
    ]);

    return {
      total,
      items: items.map((p: any) => ({
        orderId: p.orderId,
        coin: p.cryptoCoin ?? 'USDC',
        expectedAmount: p.cryptoAmount != null ? Number(p.cryptoAmount) : null,
        walletAddress: p.cryptoWalletAddress ?? null,
        cryptoTxHash: p.cryptoTxHash ?? null,
        status: p.status,
        createdAt: p.createdAt,
        order: p.order
          ? {
              id: p.order.id,
              status: p.order.status,
              totalAmount: Number(p.order.totalAmount),
              businessName: p.order.merchant?.businessName ?? null,
            }
          : null,
      })),
    };
  }

  /**
   * Re-verificación on-chain manual (admin): fuerza el chequeo contra Horizon
   * y completa el pago SOLO si aparece evidencia on-chain (mismo criterio
   * fail-closed que el polling automático).
   */
  /**
   * Reembolso Onvo con validación: dueño verificado (assertIntentAccess),
   * solo sobre pagos completados, monto positivo y acotado a lo cobrado.
   * Sin esto, un amount negativo o mayor al pago pasaba directo a Onvo.
   */
  async refundOnvoPayment(
    paymentIntentId: string,
    amount: number | undefined,
    user: { sub?: string; role?: string },
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    await this.assertIntentAccess(paymentIntentId, user, true);
    if (amount !== undefined) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        throw new BadRequestException('Monto de reembolso inválido');
      }
    }
    const payment = await this.prisma.payment.findFirst({
      where: { OR: [{ onvoPaymentId: paymentIntentId }, { onvoSessionId: paymentIntentId }] },
      select: { amount: true, status: true, method: true },
    });
    if (!payment) {
      throw new BadRequestException('Pago no encontrado para ese intent');
    }
    if (payment.status !== PaymentStatus.completed) {
      throw new BadRequestException('Solo se puede reembolsar un pago completado');
    }
    if (amount !== undefined) {
      const paid = Number(payment.amount);
      if (Number.isFinite(paid) && paid > 0 && Math.round(Number(amount)) > Math.round(paid)) {
        throw new BadRequestException(
          `El reembolso (₡${Math.round(Number(amount)).toLocaleString()}) supera lo cobrado (₡${Math.round(paid).toLocaleString()})`,
        );
      }
    }
    return this.onvopayProvider.refundPayment(paymentIntentId, amount);
  }

  async adminReverifyCrypto(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: { method: true, status: true },
    });
    if (!payment) {
      throw new BadRequestException('Pago no encontrado');
    }
    if (payment.method !== 'crypto') {
      throw new BadRequestException('El pago no es de método crypto');
    }
    if (payment.status === PaymentStatus.completed) {
      return { rechecked: true, alreadyCompleted: true, completed: true, reason: null };
    }

    // getPaymentStatus ejecuta la verificación on-chain y persiste el cambio
    // si hay evidencia (incluye dedup de txs usadas).
    const result = await this.getPaymentStatus(orderId);
    const completed = result?.status === PaymentStatus.completed;
    return {
      rechecked: true,
      alreadyCompleted: false,
      completed,
      reason: completed ? null : 'no_matching_payment',
      txHash: (result as any)?.cryptoTxHash ?? null,
      status: result?.status ?? null,
    };
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
      // 401 (no 200): la firma inválida debe verse en métricas/alertas como
      // intrusión, no como un webhook "recibido" más.
      this.logger.error('Invalid or missing OnvoPay webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const { type, data } = payload;

    // Handle different event types
    if (type === 'payment_intent.succeeded') {
      const { metadata } = data ?? {};
      // Recarga de crédito con tarjeta: acredita saldo, no pedido.
      if (metadata?.topupId) {
        if (!(await this.topupAmountCovers(metadata.topupId, data))) {
          return { received: true, amountMismatch: true };
        }
        const done = await this.creditsService.completeTopup(metadata.topupId, data?.id);
        this.logger.log(`Credit topup webhook for ${metadata.topupId} (completed=${done})`);
        return { received: true, topup: metadata.topupId, completed: done };
      }
      const orderId = metadata?.orderId;

      if (orderId) {
        if (!(await this.orderAmountCovers(orderId, data))) {
          return { received: true, amountMismatch: true };
        }
        // Se guarda el intent igual que en checkout-session: si este evento
        // llega primero, el refund por intent igual encuentra la fila.
        const res = await this.prisma.payment.updateMany({
          where: { orderId },
          data: {
            status: PaymentStatus.completed,
            ...(data?.id ? { onvoPaymentId: data.id } : {}),
          },
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
      // Recarga de crédito: metadata.topupId acredita saldo en vez de pedido.
      const topupId = data?.metadata?.topupId;
      const paymentIntentId = data?.paymentIntentId;
      if (topupId) {
        if (!(await this.topupAmountCovers(topupId, data))) {
          return { received: true, amountMismatch: true };
        }
        const done = await this.creditsService.completeTopup(topupId, paymentIntentId);
        this.logger.log(`Credit topup checkout completed for ${topupId} (completed=${done})`);
        return { received: true, topup: topupId, completed: done };
      }
      const orderId = data?.metadata?.orderId;
      if (orderId) {
        if (!(await this.orderAmountCovers(orderId, data))) {
          return { received: true, amountMismatch: true };
        }
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
        // Sin orderId en metadata: puede ser una recarga cuyo intent se
        // guardó al reconciliar — probar topup antes de descartar.
        const topupDone = await this.creditsService.completeTopupByIntent(paymentIntentId);
        if (topupDone) {
          this.logger.log(`Credit topup checkout completed by intent ${paymentIntentId}`);
          return { received: true, topupCompleted: true };
        }
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

    // Forma del hash ANTES de tocar Horizon: un string malformado no debe
    // costar un request externo (amplificación) ni romper el verifier.
    if (typeof transactionHash !== 'string' || !/^[0-9a-f]{64}$/i.test(transactionHash)) {
      this.logger.warn('Stellar webhook malformed transactionHash — ignoring');
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
