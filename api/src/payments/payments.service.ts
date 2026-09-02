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
}

interface PaymentResult {
  success: boolean;
  paymentId?: string;
  checkoutUrl?: string;
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

  async createPayment(dto: CreatePaymentDTO): Promise<PaymentResult> {
    const { orderId, method, amount, currency, customerEmail, customerPhone, cryptoCoin } = dto;

    // Validate order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException('Pedido no encontrado');
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
        result = await this.createOnvoPayPayment(orderId, amount, method, customerEmail, customerPhone);
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
    if (existingPayment) {
      await this.prisma.payment.update({
        where: { orderId },
        data: {
          amount,
          currency: method === 'crypto' ? cryptoCoin : 'CRC',
          method: method as any,
          status: 'pending',
          onvoPaymentId: result.paymentId,
          onvoCheckoutUrl: result.checkoutUrl,
          cryptoCoin: cryptoCoin,
          cryptoWalletAddress: result.walletAddress,
          cryptoAmount: result.amountInCrypto,
          exchangeRate: result.exchangeRate,
        },
      });
    } else {
      await this.prisma.payment.create({
        data: {
          orderId,
          amount,
          currency: method === 'crypto' ? cryptoCoin : 'CRC',
          method: method as any,
          status: 'pending',
          onvoPaymentId: result.paymentId,
          onvoCheckoutUrl: result.checkoutUrl,
          cryptoCoin: cryptoCoin,
          cryptoWalletAddress: result.walletAddress,
          cryptoAmount: result.amountInCrypto,
          exchangeRate: result.exchangeRate,
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
  ): Promise<PaymentResult> {
    const paymentType = method === 'onvopay_card' ? 'Tarjeta' : 'SINPE';
    
    const result = await this.onvopayProvider.createPayment({
      amount,
      currency: 'CRC',
      description: `Pago Kiwi - Pedido #${orderId.slice(0, 8)} (${paymentType})`,
      orderId,
      customerEmail,
      customerPhone,
      returnUrl: `${process.env.FRONTEND_URL}/orders/${orderId}/success`,
      cancelUrl: `${process.env.FRONTEND_URL}/orders/${orderId}/cancel`,
    });

    return {
      success: result.success,
      paymentId: result.paymentId,
      checkoutUrl: result.checkoutUrl,
      error: result.error,
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

  private async createCashPayment(
    orderId: string,
    amount: number,
  ): Promise<PaymentResult> {
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
        const status = await this.onvopayProvider.getPaymentStatus(payment.onvoPaymentId);
        
        if (status.status === 'completed') {
          await this.prisma.payment.update({
            where: { orderId },
            data: { status: 'completed' },
          });
          payment.status = 'completed';
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

  async handleWebhook(provider: string, payload: any) {
    this.logger.log(`Received ${provider} webhook`);

    switch (provider) {
      case 'onvopay':
        return this.handleOnvoPayWebhook(payload);
      case 'stellar':
        return this.handleStellarWebhook(payload);
      default:
        this.logger.warn(`Unknown webhook provider: ${provider}`);
    }
  }

  private async handleOnvoPayWebhook(payload: any) {
    const { reference, status } = payload;

    if (status === 'completed') {
      await this.prisma.payment.update({
        where: { orderId: reference },
        data: { status: 'completed' },
      });
      
      // Update order status
      await this.prisma.order.update({
        where: { id: reference },
        data: { status: 'assigned' },
      });

      this.logger.log(`Payment completed for order ${reference}`);
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
