import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimiterMiddleware } from './rate-limiter.middleware';
import { SecurityHeadersMiddleware } from './security-headers.middleware';
import { InputSanitizationMiddleware } from './input-sanitization.middleware';
import { BotProtectionMiddleware } from './bot-protection.middleware';
import { HttpsEnforcerMiddleware } from './https-enforcer.middleware';
import { GlobalJwtAuthGuard } from '../auth/guards/global-jwt-auth.guard';

@Module({
  providers: [
    // Default-deny: all routes require JWT unless marked @Public().
    // Registered globally so new controllers can't ship unprotected.
    { provide: APP_GUARD, useClass: GlobalJwtAuthGuard },
  ],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // HTTPS redirect BEFORE anything else: nothing should spend work on a
    // request that must be re-sent over https anyway.
    consumer.apply(HttpsEnforcerMiddleware).forRoutes('*');

    // Bot filtering FIRST: scanner noise never reaches/consumes the limiter.
    consumer.apply(BotProtectionMiddleware).forRoutes('*');

    // Apply rate limiting to all routes
    consumer.apply(RateLimiterMiddleware).forRoutes('*');

    // Apply security headers
    consumer.apply(SecurityHeadersMiddleware).forRoutes('*');

    // Apply input sanitization
    consumer.apply(InputSanitizationMiddleware).forRoutes('*');
  }
}
