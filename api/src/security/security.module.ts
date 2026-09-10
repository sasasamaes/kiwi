import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RateLimiterMiddleware } from './rate-limiter.middleware';
import { SecurityHeadersMiddleware } from './security-headers.middleware';
import { InputSanitizationMiddleware } from './input-sanitization.middleware';

@Module({})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply rate limiting to all routes
    consumer.apply(RateLimiterMiddleware).forRoutes('*');

    // Apply security headers
    consumer.apply(SecurityHeadersMiddleware).forRoutes('*');

    // Apply input sanitization
    consumer.apply(InputSanitizationMiddleware).forRoutes('*');
  }
}
