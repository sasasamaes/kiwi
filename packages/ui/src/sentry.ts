// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * 🥝 Kiwi Sentry — carga PEREZOSA.
 *
 * Antes: `import * as Sentry from '@sentry/react'` estático metía ~200KB de
 * Sentry en el bundle inicial de las tres apps (via barrel → SentryProvider),
 * aunque el DSN ni siquiera esté configurado.
 *
 * Ahora: el SDK se descarga bajo demanda, la primera vez que se necesita
 * (initSentry o el primer capture*). Si no hay DSN configurado, nunca se
 * descarga. Mantiene la MISMA superficie pública: initSentry, captureException,
 * captureMessage, setSentryUser y el namespace `Sentry` (proxy delegado).
 */
import type { SeverityLevel } from '@sentry/react';
import { cookieConsent } from './cookie-consent';

type SentryModule = typeof import('@sentry/react');

let sentryPromise: Promise<SentryModule | null> | null = null;
let sentryReady = false;

function getSentry(): Promise<SentryModule | null> {
  if (!sentryPromise) {
    sentryPromise = import('@sentry/react').catch(() => null);
  }
  return sentryPromise;
}

/**
 * Initialize Sentry for React apps
 *
 * Import this in the entry point of each app:
 *   import { initSentry } from '@kiwi/ui';
 *
 * Or call initSentry() in your index.tsx
 */
export async function initSentry(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.log('🐛 Sentry DSN not configured, error tracking disabled');
    return;
  }

  const environment = process.env.NODE_ENV || 'development';
  const S = await getSentry();
  if (!S) return;

  S.init({
    dsn,
    environment,

    integrations: [S.browserTracingIntegration()],

    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.2 : 1.0,

    // Session replay: SOLO con consentimiento de analítica (grabar la sesión
    // sin preguntar sería telemetría intrusiva). La captura de errores sí
    // corre siempre: es diagnóstico técnico y beforeSend la anonimiza.
    replaysSessionSampleRate:
      environment === 'production' && cookieConsent.allowsAnalytics() ? 0.1 : 0,
    replaysOnErrorSampleRate: cookieConsent.allowsAnalytics() ? 1.0 : 0,

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

  sentryReady = true;
  console.log(`🐛 Sentry initialized (${environment})`);
}

/**
 * Capture an exception with context
 *
 * Usage:
 *   captureException(error, { orderId: '123', action: 'checkout' });
 */
export async function captureException(error: Error | unknown, context?: Record<string, any>) {
  if (!sentryReady) return;
  const S = await getSentry();
  if (!S) return;

  S.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, String(value));
      });
    }
    S.captureException(error);
  });
}

/**
 * Capture a message with level
 *
 * Usage:
 *   captureMessage('Payment failed', 'error', { orderId: '123' });
 */
export async function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context?: Record<string, any>,
) {
  if (!sentryReady) return;
  const S = await getSentry();
  if (!S) return;

  S.withScope((scope) => {
    scope.setLevel(level);
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, String(value));
      });
    }
    S.captureMessage(message);
  });
}

/**
 * Set user context for error tracking
 *
 * Usage:
 *   setSentryUser({ id: 'user-123' }); // solo ID interno — nunca email
 */
export async function setSentryUser(user: { id: string; email?: string; name?: string }) {
  if (!sentryReady) return;
  // Sin consentimiento de analítica, los errores se reportan anónimos:
  // la política de cookies lo promete y hay que cumplirlo.
  if (!cookieConsent.allowsAnalytics()) return;
  const S = await getSentry();
  if (!S) return;

  S.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
}

/**
 * Namespace `Sentry` compatible: delega cada llamada a la carga perezosa.
 * Los métodos se resuelven como promesas (fire-and-forget es seguro).
 */
export const Sentry = new Proxy({} as SentryModule, {
  get(_target, prop: string) {
    return async (...args: unknown[]) => {
      const S = await getSentry();
      if (!S) return undefined;
      const value = (S as unknown as Record<string, unknown>)[prop];
      if (typeof value === 'function') {
        return (value as (...a: unknown[]) => unknown).apply(S, args);
      }
      return value;
    };
  },
});
