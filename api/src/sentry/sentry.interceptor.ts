import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/nestjs';

/**
 * Sentry Interceptor
 *
 * Automatically captures:
 * - Exceptions with full context (user, request, params)
 * - Performance traces for all HTTP requests
 * - Slow requests (>2s) as performance issues
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler().name;
    const controller = context.getClass().name;

    // Set user context for Sentry
    if (request.user) {
      Sentry.setUser({
        id: request.user.sub || request.user.id,
        email: request.user.email,
        username: request.user.fullName,
      });
    }

    // Set request context
    Sentry.setContext('HTTP Request', {
      method: request.method,
      url: request.url,
      controller,
      handler,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.connection?.remoteAddress,
    });

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        // Track slow requests
        if (duration > 2000) {
          Sentry.withScope((scope) => {
            scope.setLevel('warning');
            scope.setContext('Performance', {
              controller,
              handler,
              duration: `${duration}ms`,
              url: request.url,
            });
            Sentry.captureMessage(
              `Slow request: ${controller}.${handler} took ${duration}ms`,
              'warning',
            );
          });
        }
      }),
      catchError((error) => {
        // Add context to the exception
        Sentry.withScope((scope) => {
          scope.setTag('controller', controller);
          scope.setTag('handler', handler);
          scope.setTag('method', request.method);
          scope.setTag('url', request.url);

          scope.setContext('Request', {
            params: request.params,
            query: request.query,
            body: this.sanitizeBody(request.body),
          });

          if (request.user) {
            scope.setUser({
              id: request.user.sub || request.user.id,
              email: request.user.email,
            });
          }

          scope.setExtra('statusCode', error.status || 500);

          Sentry.captureException(error);
        });

        throw error;
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'passwordHash', 'token', 'accessToken', 'secret'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
