import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from './providers/onvopay.provider';
import { StellarProvider } from './providers/stellar.provider';

interface CreatePaymentDTO {
  orderId: string;
  method: 'onvopay_card' | 'onvopay_sinpe' | 'crypto' | 'cash';
  amount: number;
  currency?: string;
  customerEmail?: string;
  customerPhone?: string;
  cryptoCoin?: 'USDC' | 'USDT';
  paymentMethodId?: string; // Tokenized payment method from client
}

interface PaymentResult {
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

    if (existingPayment && existingPayment.status === 'completed') {
      throw new BadRequestException('El pedido ya tiene un pago completado');
    }

    let result: PaymentResult;

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
      currency: method === 'crypto' ? cryptoCoin : 'CRC',
      method: method as any,
      status: result.success ? 'pending' : 'failed',
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
          orderId,
          ...paymentData,
        },
      });
    }

    return result;
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

    // Create payment intent
    const intentResult = await this.onvopayProvider.createPaymentIntent({
      amount,
      currency: 'CRC',
      description: `Pago Kiwi - Pedido #${orderId.slice(0, 8)} (${paymentType})`,
      orderId,
      customerEmail,
      customerPhone,
      returnUrl: `${process.env.FRONTEND_URL ?? process.env.CLIENT_URL ?? ''}/orders/${orderId}/success`,
      cancelUrl: `${process.env.FRONTEND_URL ?? process.env.CLIENT_URL ?? ''}/orders/${orderId}/cancel`,
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

  async getPaymentStatus(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment) {
      return null;
    }

    // Check with provider if needed
    if (payment.method === 'onvopay_card' || payment.method === 'onvopay_sinpe') {
      if (payment.onvoPaymentId && payment.status === 'pending') {
        const status = await this.onvopayProvider.getPaymentIntentStatus(payment.onvoPaymentId);

        if (status.status === 'succeeded') {
          await this.prisma.payment.update({
            where: { orderId },
            data: { status: 'completed' },
          });
          payment.status = 'completed';
        } else if (status.status === 'canceled') {
          await this.prisma.payment.update({
            where: { orderId },
            data: { status: 'failed' },
          });
          payment.status = 'failed';
        }
      }
    }

    if (payment.method === 'crypto' && payment.status === 'pending') {
      // Check Stellar transaction
      const verified = await this.stellarProvider.verifyPayment(payment.id);
      if (verified.verified) {
        await this.prisma.payment.update({
          where: { orderId },
          data: { status: 'completed' },
        });
        payment.status = 'completed';
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
      const { id, metadata } = data;
      const orderId = metadata?.orderId;

      if (orderId) {
        await this.prisma.payment.update({
          where: { orderId },
          data: { status: 'completed' },
        });

        // NOTE: order stays pending until a driver claims it. Marking it
        // assigned here (without driverId) hid it from getAvailableOrders
        // (status != pending) while belonging to nobody — a lost order.

        this.logger.log(`Payment completed for order ${orderId}`);
      }
    } else if (type === 'payment_intent.canceled') {
      const { metadata } = data;
      const orderId = metadata?.orderId;

      if (orderId) {
        await this.prisma.payment.update({
          where: { orderId },
          data: { status: 'failed' },
        });

        this.logger.log(`Payment cancelled for order ${orderId}`);
      }
    }

    return { received: true };
  }

  private async handleStellarWebhook(payload: any) {
    const { transactionHash, orderId } = payload;

    // Verify transaction on Stellar
    const verified = await this.stellarProvider.verifyPayment(orderId);

    if (verified.verified) {
      await this.prisma.payment.update({
        where: { orderId },
        data: {
          status: 'completed',
          cryptoTxHash: transactionHash,
        },
      });

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
}
