// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SentryInterceptor } from './sentry.interceptor';

/**
 * Sentry Module
 *
 * Registers the Sentry interceptor globally.
 * Only active when SENTRY_DSN env var is set.
 *
 * Usage in app.module.ts:
 *   @Module({ imports: [SentryModule] })
 *
 * Or manually register the interceptor:
 *   providers: [
 *     { provide: APP_INTERCEPTOR, useClass: SentryInterceptor },
 *   ]
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
  ],
  exports: [],
})
export class SentryModule {}
