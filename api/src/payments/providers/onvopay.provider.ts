import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

interface OnvoPayPaymentRequest {
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

interface OnvoPayPaymentResponse {
  success: boolean;
  paymentId?: string;
  checkoutUrl?: string;
  clientSecret?: string;
  error?: string;
}

interface PaymentMethodToken {
  type: 'card' | 'sinpe';
  card?: {
    number: string;
    expMonth: number;
    expYear: number;
    cvv: string;
    holderName: string;
  };
  sinpe?: {
    phone: string;
  };
}

@Injectable()
export class OnvoPayProvider {
  private readonly logger = new Logger(OnvoPayProvider.name);
  private readonly secretKey: string;
  private readonly publishableKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('ONVO_SECRET_KEY', '');
    this.publishableKey = this.configService.get<string>('ONVO_PUBLISHABLE_KEY', '');
    this.baseUrl = this.configService.get<string>('ONVO_BASE_URL', 'https://api.onvopay.com/v1');

    // Validate configuration
    if (!this.secretKey) {
      this.logger.warn('ONVO_SECRET_KEY not configured - payments will fail in production');
    }
    if (!this.publishableKey) {
      this.logger.warn(
        'ONVO_PUBLISHABLE_KEY not configured - client-side payment methods cannot be created',
      );
    }
  }

  /**
   * Create a payment intent with OnvoPay
   * @see https://docs.onvopay.com/en/payments/payment-intents
   */
  async createPaymentIntent(request: OnvoPayPaymentRequest): Promise<OnvoPayPaymentResponse> {
    try {
      this.logger.log(`Creating OnvoPay payment intent for order ${request.orderId}`);

      // In development, use mock if no API key configured
      if (!this.secretKey) {
        this.logger.warn('OnvoPay secret key not configured, using mock response');
        return this.mockCreatePaymentIntent(request);
      }

      const response = await fetch(`${this.baseUrl}/payment-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify({
          amount: Math.round(request.amount), // Colones don't have decimals
          currency: request.currency || 'CRC',
          description: request.description,
          metadata: {
            orderId: request.orderId,
            customerEmail: request.customerEmail,
            customerPhone: request.customerPhone,
          },
          returnUrl: request.returnUrl,
          cancelUrl: request.cancelUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Payment intent creation failed');
      }

      return {
        success: true,
        paymentId: data.id,
        checkoutUrl: data.checkoutUrl,
        clientSecret: data.clientSecret,
      };
    } catch (error) {
      this.logger.error('OnvoPay payment intent creation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Confirm a payment intent with a payment method
   * @see https://docs.onvopay.com/en/api/confirmar-una-intencion-de-pago
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string,
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      this.logger.log(`Confirming OnvoPay payment intent ${paymentIntentId}`);

      if (!this.secretKey) {
        return { success: true, status: 'succeeded' };
      }

      const response = await fetch(`${this.baseUrl}/payment-intents/${paymentIntentId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify({
          paymentMethodId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Payment confirmation failed');
      }

      return {
        success: true,
        status: data.status,
      };
    } catch (error) {
      this.logger.error('OnvoPay payment confirmation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get payment intent status
   * @see https://docs.onvopay.com/en/api/crear-una-intencion-de-pago
   */
  async getPaymentIntentStatus(
    paymentIntentId: string,
  ): Promise<{ status: string; details?: any }> {
    try {
      if (!this.secretKey) {
        return this.mockGetPaymentStatus(paymentIntentId);
      }

      const response = await fetch(`${this.baseUrl}/payment-intents/${paymentIntentId}`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const data = await response.json();
      return { status: data.status, details: data };
    } catch (error) {
      this.logger.error('Failed to get payment intent status:', error);
      return { status: 'error', details: { error: error.message } };
    }
  }

  /**
   * Cancel a payment intent
   * @see https://docs.onvopay.com/en/api/cancelar-una-intencion-de-pago
   */
  async cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.secretKey) {
        return { success: true };
      }

      const response = await fetch(`${this.baseUrl}/payment-intents/${paymentIntentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      return { success: response.ok };
    } catch (error) {
      this.logger.error('Cancel payment intent failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Capture a payment intent (for authorized payments)
   * @see https://docs.onvopay.com/en/api/capturar-una-intencion-de-pago
   */
  async capturePaymentIntent(
    paymentIntentId: string,
    amount?: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.secretKey) {
        return { success: true };
      }

      const response = await fetch(`${this.baseUrl}/payment-intents/${paymentIntentId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: amount ? JSON.stringify({ amount }) : undefined,
      });

      return { success: response.ok };
    } catch (error) {
      this.logger.error('Capture payment intent failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a payment method (tokenize card or SINPE)
   * This should be called client-side with publishable key
   * @see https://docs.onvopay.com/en/api/crear-un-metodo-de-pago
   */
  async createPaymentMethod(token: string, billing?: any): Promise<{ id: string; type: string }> {
    try {
      // In production, this is done client-side with publishable key
      // Server-side we just store the token ID
      this.logger.log('Payment method token received');

      return {
        id: token,
        type: 'card', // or 'sinpe'
      };
    } catch (error) {
      this.logger.error('Failed to process payment method:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * Fail-closed in production: without a secret or valid signature we reject.
   * @see https://docs.onvopay.com/en/webhooks
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = this.configService.get<string>('ONVO_WEBHOOK_SECRET') ?? this.secretKey;

    if (!webhookSecret) {
      // No secret configured: only allow unsigned webhooks outside production
      // (local dev with mock provider). In production this must reject.
      const isProd = this.configService.get('NODE_ENV') === 'production';
      if (isProd) {
        this.logger.error('ONVO_WEBHOOK_SECRET missing in production — rejecting webhook');
        return false;
      }
      this.logger.warn('Verifying webhook without secret (dev only) — accepting');
      return true;
    }

    try {
      const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(signature ?? '', 'utf8');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Create a customer in OnvoPay (optional, for recurring payments)
   */
  async createCustomer(email: string, phone?: string): Promise<{ customerId: string }> {
    try {
      if (!this.secretKey) {
        return { customerId: `cust_${Date.now()}` };
      }

      const response = await fetch(`${this.baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify({
          email,
          phone,
          metadata: {},
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create customer');
      }

      return { customerId: data.id };
    } catch (error) {
      this.logger.error('Failed to create customer:', error);
      throw error;
    }
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(customerId: string): Promise<{ paymentMethods: any[] }> {
    try {
      if (!this.secretKey) {
        return { paymentMethods: [] };
      }

      const response = await fetch(`${this.baseUrl}/customers/${customerId}/payment-methods`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const data = await response.json();
      return { paymentMethods: data.data || [] };
    } catch (error) {
      this.logger.error('Failed to list payment methods:', error);
      return { paymentMethods: [] };
    }
  }

  /**
   * Get payment methods available for checkout
   * This should be called client-side with publishable key
   */
  async getAvailablePaymentMethods(): Promise<{ methods: string[] }> {
    return {
      methods: ['card', 'sinpe'],
    };
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    paymentIntentId: string,
    amount?: number,
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      if (!this.secretKey) {
        return { success: true, refundId: `ref_${Date.now()}` };
      }

      const response = await fetch(`${this.baseUrl}/payment-intents/${paymentIntentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: amount ? JSON.stringify({ amount }) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Refund failed');
      }

      return { success: true, refundId: data.id };
    } catch (error) {
      this.logger.error('Refund failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get payment intent details
   */
  async getPaymentIntent(paymentIntentId: string): Promise<{ intent: any; error?: string }> {
    try {
      if (!this.secretKey) {
        return { intent: { id: paymentIntentId, status: 'succeeded' } };
      }

      const response = await fetch(`${this.baseUrl}/payment-intents/${paymentIntentId}`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get payment intent');
      }

      return { intent: data };
    } catch (error) {
      this.logger.error('Failed to get payment intent:', error);
      return { intent: {}, error: error.message };
    }
  }

  /**
   * Create a recurring payment setup
   */
  async createSetupIntent(
    customerId: string,
    paymentMethodTypes: string[] = ['card', 'sinpe'],
  ): Promise<{ setupIntentId: string; clientSecret: string; error?: string }> {
    try {
      if (!this.secretKey) {
        return {
          setupIntentId: `seti_${Date.now()}`,
          clientSecret: `seti_secret_${Date.now()}`,
        };
      }

      const response = await fetch(`${this.baseUrl}/setup-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify({
          customer: customerId,
          payment_method_types: paymentMethodTypes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create setup intent');
      }

      return {
        setupIntentId: data.id,
        clientSecret: data.client_secret,
      };
    } catch (error) {
      this.logger.error('Failed to create setup intent:', error);
      return { setupIntentId: '', clientSecret: '', error: error.message };
    }
  }

  // Mock methods for development
  private mockCreatePaymentIntent(request: OnvoPayPaymentRequest): OnvoPayPaymentResponse {
    const paymentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      success: true,
      paymentId,
      checkoutUrl: `https://checkout.onvopay.com/pay/${paymentId}`,
      clientSecret: `pi_${paymentId}_secret_${Math.random().toString(36).substr(2, 16)}`,
    };
  }

  private mockGetPaymentStatus(paymentIntentId: string): { status: string; details: any } {
    return {
      status: 'succeeded',
      details: {
        id: paymentIntentId,
        amount: 5000,
        currency: 'CRC',
        status: 'succeeded',
      },
    };
  }
}
