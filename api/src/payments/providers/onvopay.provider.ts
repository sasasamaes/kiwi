import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  error?: string;
}

@Injectable()
export class OnvoPayProvider {
  private readonly logger = new Logger(OnvoPayProvider.name);
  private readonly apiKey: string;
  private readonly merchantId: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ONVOPAY_API_KEY', '');
    this.merchantId = this.configService.get<string>('ONVOPAY_MERCHANT_ID', '');
    this.baseUrl = this.configService.get<string>('ONVOPAY_BASE_URL', 'https://api.onvopay.com/v1');
  }

  async createPayment(request: OnvoPayPaymentRequest): Promise<OnvoPayPaymentResponse> {
    try {
      this.logger.log(`Creating OnvoPay payment for order ${request.orderId}`);

      // In production, this would call the actual OnvoPay API
      // For now, we'll simulate the response
      if (!this.apiKey) {
        this.logger.warn('OnvoPay API key not configured, using mock response');
        return this.mockCreatePayment(request);
      }

      const response = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Merchant-Id': this.merchantId,
        },
        body: JSON.stringify({
          amount: request.amount,
          currency: request.currency,
          description: request.description,
          reference: request.orderId,
          customer: {
            email: request.customerEmail,
            phone: request.customerPhone,
          },
          callbacks: {
            success: request.returnUrl,
            cancel: request.cancelUrl,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Payment creation failed');
      }

      return {
        success: true,
        paymentId: data.id,
        checkoutUrl: data.checkout_url,
      };
    } catch (error) {
      this.logger.error('OnvoPay payment creation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<{ status: string; details?: any }> {
    try {
      if (!this.apiKey) {
        return this.mockGetPaymentStatus(paymentId);
      }

      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Merchant-Id': this.merchantId,
        },
      });

      const data = await response.json();
      return { status: data.status, details: data };
    } catch (error) {
      this.logger.error('Failed to get payment status:', error);
      return { status: 'error', details: { error: error.message } };
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.apiKey) {
        return { success: true };
      }

      const response = await fetch(`${this.baseUrl}/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Merchant-Id': this.merchantId,
        },
        body: JSON.stringify({ amount }),
      });

      return { success: response.ok };
    } catch (error) {
      this.logger.error('Refund failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Mock methods for development
  private mockCreatePayment(request: OnvoPayPaymentRequest): OnvoPayPaymentResponse {
    const paymentId = `onvo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      success: true,
      paymentId,
      checkoutUrl: `https://checkout.onvopay.com/pay/${paymentId}`,
    };
  }

  private mockGetPaymentStatus(paymentId: string): { status: string; details: any } {
    return {
      status: 'completed',
      details: { id: paymentId, amount: 2500, currency: 'CRC' },
    };
  }
}
