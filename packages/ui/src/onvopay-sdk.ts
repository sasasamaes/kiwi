/**
 * 🔌 OnvoPay SDK for Kiwi
 *
 * Client-side SDK for OnvoPay payment integration
 */

interface OnvoPayConfig {
  publishableKey: string;
  baseUrl?: string;
}

interface CardToken {
  id: string;
  object: 'token';
  card: {
    id: string;
    object: 'card';
    brand: string;
    country: string;
    currency: string;
    customer: string | null;
    cvc_check: 'pass' | 'fail' | 'unchecked' | 'unavailable';
    dynamic_last4: string | null;
    exp_month: number;
    exp_year: number;
    funding: string;
    last4: string;
    name: string | null;
    tokenization_method: string | null;
  };
  client_ip: string | null;
  created: number;
  livemode: boolean;
  type: 'card';
  used: boolean;
}

interface PaymentMethod {
  id: string;
  object: 'payment_method';
  type: 'card' | 'sinpe';
  card?: {
    brand: string;
    country: string;
    exp_month: number;
    exp_year: number;
    last4: string;
  };
  sinpe?: {
    phone: string;
  };
  customer: string | null;
  created: number;
  livemode: boolean;
}

interface PaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  amount_capturable: number;
  amount_received: number;
  application: string | null;
  application_fee_amount: number | null;
  canceled_at: number | null;
  cancellation_reason: string | null;
  capture_method: 'automatic' | 'manual';
  client_secret: string;
  confirmation_method: 'automatic' | 'manual';
  created: number;
  currency: string;
  customer: string | null;
  description: string | null;
  invoice: string | null;
  last_payment_error: any | null;
  latest_charge: string | null;
  metadata: Record<string, string>;
  next_action: any | null;
  on_behalf_of: string | null;
  payment_method: string | null;
  payment_method_options: any;
  payment_method_types: string[];
  receiver: string | null;
  receipt_email: string | null;
  receipt_number: string | null;
  receipt_url: string | null;
  reduced_exposure: boolean;
  recurring: boolean;
  report_late_payment: boolean;
  setup_future_usage: string | null;
  shipping: any | null;
  source: string | null;
  statement_descriptor: string | null;
  statement_descriptor_suffix: string | null;
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_capture'
    | 'requires_action'
    | 'processing'
    | 'succeeded'
    | 'canceled';
  transfer_data: any | null;
  transfer_group: string | null;
}

export class OnvoPay {
  private publishableKey: string;
  private baseUrl: string;

  constructor(config: OnvoPayConfig) {
    if (!config.publishableKey) {
      throw new Error('OnvoPay publishable key is required');
    }

    this.publishableKey = config.publishableKey;
    this.baseUrl = config.baseUrl || 'https://api.onvopay.com/v1';
  }

  /**
   * Get the publishable key
   */
  getPublishableKey(): string {
    return this.publishableKey;
  }

  /**
   * Create a card token (for card payments)
   */
  async createToken(
    type: 'card',
    cardData: {
      number: string;
      exp_month: number;
      exp_year: number;
      cvc: string;
      holderName?: string;
    },
  ): Promise<CardToken> {
    const response = await fetch(`${this.baseUrl}/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.publishableKey}`,
      },
      body: JSON.stringify({
        type: 'card',
        card: cardData,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create token');
    }

    return response.json();
  }

  /**
   * Create a payment method (tokenized payment method)
   */
  async createPaymentMethod(
    type: 'card' | 'sinpe',
    data: {
      card?: {
        number: string;
        exp_month: number;
        exp_year: number;
        cvc: string;
        holderName?: string;
      };
      sinpe?: {
        phone: string;
      };
    },
  ): Promise<PaymentMethod> {
    const response = await fetch(`${this.baseUrl}/payment-methods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.publishableKey}`,
      },
      body: JSON.stringify({
        type,
        [type]: data[type],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create payment method');
    }

    return response.json();
  }

  /**
   * Create a customer
   */
  async createCustomer(data: {
    email?: string;
    phone?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<{ id: string; customer: any }> {
    const response = await fetch(`${this.baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.publishableKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create customer');
    }

    return response.json();
  }

  /**
   * Get payment methods for a customer
   */
  async listPaymentMethods(customerId: string): Promise<{ data: PaymentMethod[] }> {
    const response = await fetch(`${this.baseUrl}/customers/${customerId}/payment-methods`, {
      headers: {
        Authorization: `Bearer ${this.publishableKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to list payment methods');
    }

    return response.json();
  }

  /**
   * Get payment intent status
   */
  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    const response = await fetch(`${this.baseUrl}/payment-intents/${paymentIntentId}`, {
      headers: {
        Authorization: `Bearer ${this.publishableKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get payment intent');
    }

    return response.json();
  }

  /**
   * Confirm payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string,
  ): Promise<PaymentIntent> {
    const response = await fetch(`${this.baseUrl}/payment-intents/${paymentIntentId}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.publishableKey}`,
      },
      body: JSON.stringify({
        payment_method: paymentMethodId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to confirm payment intent');
    }

    return response.json();
  }

  /**
   * Cancel payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    const response = await fetch(`${this.baseUrl}/payment-intents/${paymentIntentId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.publishableKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel payment intent');
    }

    return response.json();
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(data: {
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, string>;
    customer?: string;
    payment_method_types?: string[];
    return_url?: string;
    cancel_url?: string;
  }): Promise<PaymentIntent> {
    const response = await fetch(`${this.baseUrl}/payment-intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.publishableKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create payment intent');
    }

    return response.json();
  }

  /**
   * Get available payment methods
   */
  async getAvailablePaymentMethods(): Promise<{ methods: string[] }> {
    // This is typically a server-side call, but we can provide defaults
    return {
      methods: ['card', 'sinpe'],
    };
  }
}

// Singleton instance (client-side)
let onvoPayInstance: OnvoPay | null = null;

export function getOnvoPay(): OnvoPay {
  if (!onvoPayInstance) {
    const publishableKey = process.env.NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.warn('NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY not set. Payment functionality may not work.');
      return new OnvoPay({
        publishableKey: 'pk_test_placeholder',
        baseUrl: 'https://api.onvopay.com/v1',
      });
    }
    onvoPayInstance = new OnvoPay({
      publishableKey,
    });
  }
  return onvoPayInstance;
}

// Export default instance
export default getOnvoPay;
