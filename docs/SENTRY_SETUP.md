# 🐛 Sentry Error Tracking - Kiwi

## Overview

Sentry is configured for all Kiwi apps:

- **API** (`@sentry/nestjs`) — Server-side error tracking with performance monitoring
- **Web/Driver/Client** (`@sentry/react`) — Client-side error tracking with session replay

## Setup Instructions

### 1. Create Sentry Account

1. Go to [sentry.io](https://sentry.io)
2. Sign up for free (50K events/month)
3. Create a new project: **Next.js** for web, **NestJS** for API

### 2. Get Your DSN

After creating the project, Sentry gives you a DSN:

```
https://your-key@o123456.ingest.sentry.io/123456
```

### 3. Configure Environment Variables

**API** (add to `api/.env`):

```bash
SENTRY_DSN="https://your-key@o123456.ingest.sentry.io/123456"
```

**Web/Driver/Client** (add to `.env.local` or `.env`):

```bash
NEXT_PUBLIC_SENTRY_DSN="https://your-key@o123456.ingest.sentry.io/123456"
NEXT_PUBLIC_SENTRY_ORG="your-org"
NEXT_PUBLIC_SENTRY_PROJECT="kiwi-web"
```

### 4. Upload Source Maps (Production)

For readable stack traces in production:

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Login
sentry-login

# Upload source maps after build
cd delivery-app
npx @sentry/cli releases files YOUR_RELEASE upload-sourcemaps . --rewrite
```

## What Gets Captured

### API (Automatic)

- ✅ All unhandled exceptions
- ✅ HTTP request errors
- ✅ Database errors (Prisma)
- ✅ Authentication failures
- ✅ Slow requests (>2s)
- ✅ WebSocket errors

### Client (Automatic)

- ✅ React component errors (ErrorBoundary)
- ✅ Unhandled promise rejections
- ✅ Network errors
- ✅ Console errors
- ✅ Performance metrics (LCP, FID, CLS)

### Sensitive Data (Sanitized)

- ❌ Passwords
- ❌ JWT tokens
- ❌ Authorization headers
- ❌ Cookies

## Custom Error Capturing

### In API Code

```typescript
import * as Sentry from '@sentry/nestjs';

try {
  await processPayment(orderId, amount);
} catch (error) {
  Sentry.withScope((scope) => {
    scope.setTag('orderId', orderId);
    scope.setTag('paymentMethod', 'onvopay');
    scope.setExtra('amount', amount);
    Sentry.captureException(error);
  });
  throw error;
}
```

### In React Code

```typescript
import { captureException, captureMessage } from '@kiwi/ui/sentry';

// Capture error with context
try {
  await submitOrder(orderData);
} catch (error) {
  captureException(error, {
    orderId: orderData.id,
    merchantId: orderData.merchantId,
    action: 'checkout',
  });
}

// Capture message
captureMessage('Payment webhook received', 'info', {
  paymentId: 'pay_123',
  status: 'completed',
});
```

### Set User Context

```typescript
import { setSentryUser } from '@kiwi/ui/sentry';

// After login
setSentryUser({
  id: user.id,
  email: user.email,
  name: user.fullName,
});
```

## Alerts Configuration

### Critical Alerts (Immediate)

- 500 errors
- Authentication failures
- Payment errors
- Database connection errors

### Warning Alerts (Daily Digest)

- Slow requests (>2s)
- Client-side errors
- Failed API calls

### Setup in Sentry Dashboard

1. Go to **Alerts** → **Create Alert Rule**
2. Set conditions:
   - Event frequency > 10 in 5 minutes
   - Or error level = fatal
3. Add email/Slack notification

## Performance Monitoring

Sentry automatically tracks:

- **API Response Times** — Average, P95, P99
- **Database Queries** — Slow queries (>500ms)
- **HTTP Requests** — Success rate, latency
- **Frontend Performance** — LCP, FID, CLS
- **WebSocket** — Connection stability

### View in Sentry Dashboard

1. Go to **Performance** → **Transactions**
2. Filter by operation: `http.server`, `db.query`, `frontend`
3. Click on transaction to see span breakdown

## Cost Estimation

### Free Tier (Sufficient for Beta)

- 50K events/month
- 1 user
- 1GB storage
- 30-day retention

### For Production

- **Team Plan**: $26/month — 5 users, 100K events
- **Business Plan**: $80/month — 50 users, 500K events

## Troubleshooting

### "Sentry DSN not configured"

- Make sure `SENTRY_DSN` is set in your `.env` file
- Restart the API/web server after adding the env var

### No Source Maps

- Run `npx @sentry/cli releases files YOUR_RELEASE upload-sourcemaps .`
- Make sure `dist/` folder exists after build

### Too Many Events

- Adjust `tracesSampleRate` in `main.ts` (API) or `sentry.ts` (client)
- Use `beforeSend` to filter out noise

---

**Sentry Dashboard**: https://sentry.io/organizations/YOUR_ORG/projects/

**Status**: ✅ Configured, awaiting DSN credentials
