# 🔌 OnvoPay Payment Gateway Integration

This document describes the complete OnvoPay integration for Kiwi delivery platform.

## 📋 Overview

OnvoPay is a payment gateway that supports:

- 🄯 Credit/Debit Cards
- 📱 SINPE Móvil (Costa Rica)
- 💳 QR Code payments
- 🔁 Recurring payments

## 🔑 API Keys

### Test Environment

```bash
# API .env file (api/.env)
ONVO_SECRET_KEY="onvo_test_secret_key_****[OCULTA — pide la clave real a OnvoPay y ponla solo en api/.env o en las variables de entorno de Render. Nunca la commites.]"
ONVO_PUBLISHABLE_KEY="onvo_test_publishable_key_****[OCULTA — ponla en las variables de entorno de Vercel (NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY)]"
ONVO_WEBHOOK_SECRET="your_webhook_secret_here"
ONVO_BASE_URL="https://api.onvopay.com/v1"
```

### Production

Replace `onvo_test_` prefixes with `onvo_live_` for production.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Kiwi Client App                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  1. User selects payment method (Card/SINPE)              │  │
│  │  2. Client creates payment intent via API                 │  │
│  │  3. Redirect to OnvoPay hosted checkout or embedded form  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             │ HTTP/HTTPS                         │
│                             ▼                                    │
┌─────────────────────────────────────────────────────────────────┐
│                       Kiwi API (NestJS)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  /api/payments/create                                      │  │
│  │  └─> Create Payment Intent on OnvoPay                     │  │
│  │  └─> Return checkout URL and client secret                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             │ Webhook                            │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  /api/payments/webhook/onvopay                            │  │
│  │  └─> Verify webhook signature                             │  │
│  │  └─> Update payment status in database                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       OnvoPay Server                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Payment Processing                                        │  │
│  │  └─> Card processing                                       │  │
│  │  └─> SINPE integration                                     │  │
│  │  └─> QR Code generation                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 📡 API Endpoints

### Backend (NestJS)

#### 1. Create Payment Intent

```bash
POST /api/payments/create
Authorization: Bearer <JWT_TOKEN>

Request Body:
{
  "orderId": "order_123",
  "method": "onvopay_card" | "onvopay_sinpe",
  "amount": 5000,
  "customerEmail": "customer@example.com",
  "customerPhone": "8888-1234"
}

Response:
{
  "success": true,
  "paymentId": "pi_123456",
  "checkoutUrl": "https://checkout.onvopay.com/pay/pi_123456",
  "clientSecret": "pi_123456_secret_abc123"
}
```

#### 2. Confirm Payment Intent

```bash
POST /api/payments/confirm/:paymentIntentId
Authorization: Bearer <JWT_TOKEN>

Request Body:
{
  "paymentMethodId": "pm_card_visa"
}

Response:
{
  "success": true,
  "status": "succeeded"
}
```

#### 3. Get Payment Status

```bash
GET /api/payments/status/:orderId
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "id": "payment_123",
  "orderId": "order_123",
  "amount": 5000,
  "currency": "CRC",
  "method": "onvopay_card",
  "status": "pending" | "completed" | "failed" | "canceled",
  "onvoPaymentId": "pi_123456",
  "createdAt": "2026-09-10T19:00:00Z"
}
```

#### 4. Webhook Handler

```bash
POST /api/payments/webhook/onvopay
X-Onvo-Signature: <webhook_signature>

Request Body:
{
  "type": "payment_intent.succeeded" | "payment_intent.canceled",
  "data": {
    "id": "pi_123456",
    "metadata": {
      "orderId": "order_123"
    }
  }
}
```

### Frontend (Client App)

#### 1. API Client Methods

```typescript
import { api } from '@kiwi/ui';

// Create payment
const payment = await api.createPayment({
  orderId: order.id,
  method: 'onvopay_card',
  amount: total,
  customerPhone: phoneNumber,
  customerEmail: `${phoneNumber}@guest.checkout.invalid`,
});

// Redirect to OnvoPay checkout
if (payment.checkoutUrl) {
  window.location.href = payment.checkoutUrl;
}

// Get payment status
const status = await api.getPaymentStatus(order.id);
```

#### 2. OnvoPayCheckout Component

```tsx
import { OnvoPayCheckout } from '@kiwi/ui';

<OnvoPayCheckout
  paymentIntentId="pi_123456"
  clientSecret="pi_123456_secret_abc123"
  checkoutUrl="https://checkout.onvopay.com/pay/pi_123456"
  amount={5000}
  currency="CRC"
  onSuccess={(paymentId) => console.log('Payment complete:', paymentId)}
  onError={(error) => console.error('Payment error:', error)}
  onCancel={() => console.log('Payment canceled')}
/>;
```

## 🔐 Security

### Webhook Signature Verification

The API verifies webhook signatures using HMAC-SHA256:

```typescript
const webhookSecret = process.env.ONVO_WEBHOOK_SECRET;
const payload = JSON.stringify(requestBody);
const signature = request.headers['x-onvo-signature'];

const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

const isValid = crypto.timingSafeEqual(
  Buffer.from(expected, 'utf8'),
  Buffer.from(signature, 'utf8'),
);
```

### Payment Method Tokenization

Payment methods are tokenized client-side using OnvoPay.js SDK:

```javascript
// Load OnvoPay.js SDK
const onvo = OnvoPay.publishableKey('pk_test_xxx');

// Create card token
const cardToken = await onvo.createToken('card', {
  number: '4242424242424242',
  exp_month: 12,
  exp_year: 2027,
  cvc: '123',
  holderName: 'John Doe',
});

// Send token to backend
await api.createPayment({
  orderId: order.id,
  method: 'onvopay_card',
  paymentMethodId: cardToken.id,
});
```

## 🔄 Payment Flow

### 1. Card Payment Flow

```
User → Select Card → Enter Card Details → Create Payment Intent
     → OnvoPay Tokenizes Card → Confirm Payment → Success Webhook
     → API Updates Order → User Redirected to Success Page
```

### 2. SINPE Móvil Flow

```
User → Select SINPE → Enter Phone → Create Payment Intent
     → OnvoPay Generates Payment Link → User Receives SMS
     → User Completes Payment on SINPE → Success Webhook
     → API Updates Order → User Redirected to Success Page
```

### 3. Success Flow

```
Payment Intent Created
     ↓
User Completes Payment (OnvoPay)
     ↓
OnvoPay Sends Webhook (payment_intent.succeeded)
     ↓
API Verifies Signature
     ↓
API Updates Payment Status to 'completed'
     ↓
API Updates Order Status (if applicable)
     ↓
Frontend Redirects to Success Page
```

## 🧪 Testing

### Test Card Numbers

- ✅ Success: `4242424242424242`
- ✅ 3D Secure required: `4000000000003220`
- ❌ Declined: `4000000000000002`

### Test SINPE Numbers

Use any valid Costa Rican phone number:

- `8888-1234`
- `8888-5678`

### Test Webhooks

Use OnvoPay dashboard to send test webhooks or use ngrok:

```bash
ngrok http 4000
```

Configure webhook URL in OnvoPay dashboard:

```
https://your-ngrok-url.ngrok.io/api/payments/webhook/onvopay
```

## 📊 Monitoring

### Payment Status Codes

| Status      | Description                             |
| ----------- | --------------------------------------- |
| `pending`   | Payment created, waiting for completion |
| `completed` | Payment successful                      |
| `failed`    | Payment failed                          |
| `canceled`  | Payment canceled by user or merchant    |

### Logging

```bash
# API logs
npm run dev

# Check for payment errors
grep -i "payment" api.log

# Monitor webhook deliveries
grep -i "webhook" api.log
```

## 🚨 Error Handling

### Common Errors

1. **Invalid API Key**

   ```
   Error: Unauthorized
   Solution: Check ONVO_SECRET_KEY in .env
   ```

2. **Invalid Card**

   ```
   Error: Your card number is incorrect
   Solution: Use test card 4242424242424242
   ```

3. **Webhook Signature Invalid**
   ```
   Error: Invalid signature
   Solution: Verify ONVO_WEBHOOK_SECRET matches OnvoPay dashboard
   ```

### Frontend Error Display

```tsx
if (payment.error) {
  <div className="error">
    <p>{payment.error}</p>
    <button onClick={retryPayment}>Try Again</button>
  </div>;
}
```

## 📱 Frontend Implementation

### Checkout Page Integration

```typescript
// apps/client/app/order/checkout/page.tsx

const placeOrder = async () => {
  // 1. Create order first
  const order = await api.createOrder(orderData);

  // 2. Create payment intent
  const payment = await api.createPayment({
    orderId: order.id,
    method: 'onvopay_card', // or 'onvopay_sinpe'
    amount: total,
    customerPhone: phoneNumber,
  });

  // 3. Redirect to OnvoPay checkout
  if (payment.checkoutUrl) {
    window.location.href = payment.checkoutUrl;
  }

  // 4. Or use embedded checkout component
  return (
    <OnvoPayCheckout
      paymentIntentId={payment.paymentId!}
      clientSecret={payment.clientSecret!}
      checkoutUrl={payment.checkoutUrl}
      amount={total}
      currency="CRC"
      onSuccess={(paymentId) => {
        // Update UI
        setPaymentStatus('completed');
      }}
      onError={(error) => {
        // Show error
        setError(error);
      }}
    />
  );
};
```

## 🎯 Best Practices

1. **Always verify webhook signatures** before updating payment status
2. **Use test keys during development** - never use live keys in dev
3. **Handle payment timeouts** - implement retry logic
4. **Log all payment events** for debugging and auditing
5. **Show loading states** during payment processing
6. **Provide clear error messages** to users
7. **Implement payment confirmation** before delivering goods/services

## 📚 Resources

- [OnvoPay API Documentation](https://docs.onvopay.com/)
- [OnvoPay Dashboard](https://dashboard.onvopay.com/)
- [Test Card Numbers](https://docs.onvopay.com/docs/test-cards)
- [Webhook Documentation](https://docs.onvopay.com/docs/webhooks)

## 🆘 Troubleshooting

### Payment Not Completing

1. Check API keys in `.env`
2. Verify webhook URL is accessible
3. Check OnvoPay dashboard for errors
4. Review browser console for client errors

### Webhook Not Received

1. Use ngrok for local testing
2. Verify webhook URL in OnvoPay dashboard
3. Check webhook delivery logs in OnvoPay dashboard
4. Test with webhook retry

### Test Payment Always Fails

1. Use correct test card number: `4242424242424242`
2. Use future expiration date
3. Check CVV format (3 digits)
4. Verify amount is in cents (CRC doesn't use decimals)

---

## 🔮 Future Enhancements

- [ ] Support for recurring payments
- [ ] Save payment methods for returning customers
- [ ] Payment methods management UI
- [ ] Refund processing UI
- [ ] Payment analytics dashboard
- [ ] Multi-currency support
- [ ] Split payments for marketplace
