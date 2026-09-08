import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry for React apps
 *
 * Import this in the entry point of each app:
 *   import '@kiwi/ui/sentry';
 *
 * Or call initSentry() in your index.tsx:
 *   import { initSentry } from '@kiwi/ui/sentry';
 *   initSentry();
 */

export function initSentry() {
  const dsn = process.env?.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.log('🐛 Sentry DSN not configured, error tracking disabled');
    return;
  }

  const environment = process.env?.NODE_ENV || 'development';

  Sentry.init({
    dsn,
    environment,

    integrations: [Sentry.browserTracingIntegration()],

    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.2 : 1.0,

    // Session replay for debugging
    replaysSessionSampleRate: environment === 'production' ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,

    // Before send hook to sanitize sensitive data
    beforeSend(event) {
      if (environment === 'test') return null;

      // Remove sensitive data from events
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>;
        delete data.password;
        delete data.token;
        delete data.accessToken;
      }

      // Remove cookies and auth headers
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
      }

      return event;
    },

    // Ignore common non-error exceptions
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection',
      'Network request failed',
      'Loading chunk.*failed',
      'ChunkLoadError',
    ],
  });

  console.log(`🐛 Sentry initialized (${environment})`);
}

/**
 * Capture an exception with context
 *
 * Usage:
 *   captureException(error, { orderId: '123', action: 'checkout' });
 */
export function captureException(error: Error | unknown, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, String(value));
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture a message with level
 *
 * Usage:
 *   captureMessage('Payment failed', 'error', { orderId: '123' });
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>,
) {
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, String(value));
      });
    }
    Sentry.captureMessage(message);
  });
}

/**
 * Set user context for error tracking
 *
 * Usage:
 *   setSentryUser({ id: 'user-123', email: 'luis@kiwi.app' });
 */
export function setSentryUser(user: { id: string; email?: string; name?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
}

export { Sentry };
