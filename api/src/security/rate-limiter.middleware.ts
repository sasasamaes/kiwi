import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private store = new Map<string, RateLimitEntry>();
  private readonly cleanupInterval: NodeJS.Timeout;

  // Per-route rate limits
  private readonly limits: Record<string, RateLimitConfig> = {
    // Auth endpoints - strict limits
    'POST:/api/auth/login': { windowMs: 15 * 60 * 1000, maxRequests: 5, message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.' },
    'POST:/api/auth/register': { windowMs: 60 * 60 * 1000, maxRequests: 3, message: 'Demasiados registros. Intenta de nuevo en 1 hora.' },
    
    // Order creation - moderate limits
    'POST:/api/orders': { windowMs: 60 * 1000, maxRequests: 10, message: 'Demasiados pedidos. Espera un momento.' },
    
    // Payment endpoints - strict limits
    'POST:/api/payments/create': { windowMs: 60 * 1000, maxRequests: 5, message: 'Demasiados intentos de pago. Espera un momento.' },
    
    // Driver status - frequent updates allowed
    'PUT:/api/drivers/me/status': { windowMs: 60 * 1000, maxRequests: 30, message: 'Demasiadas actualizaciones de estado.' },
    'PUT:/api/drivers/me/location': { windowMs: 60 * 1000, maxRequests: 60, message: 'Demasiadas actualizaciones de ubicación.' },
    
    // Menu operations
    'POST:/api/menu/my': { windowMs: 60 * 1000, maxRequests: 10, message: 'Demasiadas creaciones de menú.' },
    
    // Withdrawal requests
    'POST:/api/withdrawals/request': { windowMs: 60 * 60 * 1000, maxRequests: 3, message: 'Demasiadas solicitudes de retiro. Intenta de nuevo en 1 hora.' },
  };

  // Default rate limit
  private readonly defaultLimit: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Demasiadas peticiones. Espera un momento.',
  };

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  use(req: Request, res: Response, next: NextFunction) {
    const key = this.getKey(req);
    const limit = this.getLimit(req);
    const now = Date.now();

    let entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + limit.windowMs };
      this.store.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > limit.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: limit.message,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }

  private getKey(req: Request): string {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const route = `${req.method}:${req.path}`;
    return `${ip}:${route}`;
  }

  private getLimit(req: Request): RateLimitConfig {
    const route = `${req.method}:${req.path}`;
    
    // Check for exact match
    if (this.limits[route]) {
      return this.limits[route];
    }

    // Check for parameterized routes
    for (const [pattern, limit] of Object.entries(this.limits)) {
      const [method, path] = pattern.split(':');
      if (method === req.method && this.matchRoute(path, req.path)) {
        return limit;
      }
    }

    return this.defaultLimit;
  }

  private matchRoute(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return false;

    return patternParts.every((part, i) => {
      if (part.startsWith(':')) return true; // Parameter
      return part === pathParts[i];
    });
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }
}
