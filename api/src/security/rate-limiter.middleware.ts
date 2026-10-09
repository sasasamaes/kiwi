// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

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
    'POST:/api/auth/login': {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
      message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.',
    },

    // Subida de imágenes: cada request cuesta bandwidth + storage en el
    // proveedor. 15/15min por IP cubre con holgura la carga manual de un
    // comercio armando su menú; mata scripts que suban en loop.
    'POST:/api/menu/my/image': {
      windowMs: 15 * 60 * 1000,
      maxRequests: 15,
      message: 'Demasiadas subidas de imagen. Espera unos minutos.',
    },
    // Foto de perfil del repartidor: mismo costo que el resto de imágenes.
    'POST:/api/drivers/me/photo': {
      windowMs: 15 * 60 * 1000,
      maxRequests: 15,
      message: 'Demasiadas subidas de imagen. Espera unos minutos.',
    },
    'POST:/api/auth/register': {
      windowMs: 60 * 60 * 1000,
      maxRequests: 3,
      message: 'Demasiados registros. Intenta de nuevo en 1 hora.',
    },
    // Refresh rotativo: un cliente sano lo usa cada ~15 min. Techo holgado
    // que frena loops de reintento y fuerza bruta sobre tokens opacos.
    'POST:/api/auth/refresh': {
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: 'Demasiadas renovaciones de sesión. Intenta de nuevo en un momento.',
    },

    // Contacto público (landing, sin auth): 5 por hora por IP — un humano
    // no manda 5 mensajes en una hora; un spammer sí.
    'POST:/api/contact': {
      windowMs: 60 * 60 * 1000,
      maxRequests: 5,
      message: 'Demasiados mensajes enviados. Intenta de nuevo más tarde.',
    },

    // Geocoding - proxies to Nominatim (OpenStreetMap), que BANEA abusadores.
    // AddressInput ya debounced 300ms: 20/min por IP sobra para escribir una
    // dirección y mata el scraping masivo del proxy.
    'GET:/api/geocoding/search': {
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: 'Demasiadas búsquedas de dirección. Espera un momento.',
    },
    'GET:/api/geocoding/search/nicoya': {
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: 'Demasiadas búsquedas de dirección. Espera un momento.',
    },
    'GET:/api/geocoding/reverse': {
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: 'Demasiadas búsquedas de dirección. Espera un momento.',
    },
    'GET:/api/geocoding/distance': {
      windowMs: 60 * 1000,
      maxRequests: 30,
      message: 'Demasiadas peticiones de distancia. Espera un momento.',
    },

    // Tracking público (link compartido): el polling de invitados corre cada
    // 15s = 4/min por pestaña. 12/min permite 3 pestañas y corta la enumeración.
    'GET:/api/orders/track/:id': {
      windowMs: 60 * 1000,
      maxRequests: 12,
      message: 'Demasiadas consultas de seguimiento. Espera un momento.',
    },
    'GET:/api/orders/track/:id/location': {
      windowMs: 60 * 1000,
      maxRequests: 12,
      message: 'Demasiadas consultas de ubicación. Espera un momento.',
    },

    // Menú público: lo más scrapeable. 30/min por IP permite un navegador
    // normal navegando comercios; un scraper se topa con el muro rápido.
    'GET:/api/menu/merchant/:id': {
      windowMs: 60 * 1000,
      maxRequests: 30,
      message: 'Demasiadas peticiones. Espera un momento.',
    },

    // Order creation - moderate limits
    'POST:/api/orders': {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Demasiados pedidos. Espera un momento.',
    },

    // Guest order creation (link público, sin auth): mismo techo que el
    // flujo logueado. El UUID del comercio no es secreto; el freno al
    // spam es este límite + validación estricta en el servicio.
    'POST:/api/orders/guest': {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Demasiados pedidos. Espera un momento.',
    },

    // Payment endpoints - strict limits
    'POST:/api/payments/create': {
      windowMs: 60 * 1000,
      maxRequests: 5,
      message: 'Demasiados intentos de pago. Espera un momento.',
    },

    // Guest payment (checkout invitado): mismo techo estricto.
    'POST:/api/payments/guest': {
      windowMs: 60 * 1000,
      maxRequests: 5,
      message: 'Demasiados intentos de pago. Espera un momento.',
    },

    // Driver status - frequent updates allowed
    'PUT:/api/drivers/me/status': {
      windowMs: 60 * 1000,
      maxRequests: 30,
      message: 'Demasiadas actualizaciones de estado.',
    },
    'PUT:/api/drivers/me/location': {
      windowMs: 60 * 1000,
      maxRequests: 60,
      message: 'Demasiadas actualizaciones de ubicación.',
    },

    // Menu operations
    'POST:/api/menu/my': {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Demasiadas creaciones de menú.',
    },

    // Withdrawal requests
    'POST:/api/withdrawals/request': {
      windowMs: 60 * 60 * 1000,
      maxRequests: 3,
      message: 'Demasiadas solicitudes de retiro. Intenta de nuevo en 1 hora.',
    },

    // Webhooks de pago: cada POST dispara verificación on-chain (Stellar) o
    // firma + updates (Onvo). Sin bucket propio caían en el default 100/min:
    // 10/min por IP sobra para un proveedor real y frena amplificación.
    'POST:/api/payments/webhook/:provider': {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Demasiadas notificaciones de pago. Espera un momento.',
    },
  };

  // Default rate limit — per route per IP. Cada app consulta su propio set
  // de rutas (dashboard del merchant, driver activo, polling de tracking),
  // así que 100/min por ruta está holgado para el uso real y solo muerde a
  // scripts. El techo por IP (token bucket) es el que corta a un atacante
  // que martillea rutas distintas simultáneamente.
  private readonly defaultLimit: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Demasiadas peticiones. Espera un momento.',
  };

  // Techo global por IP: 240 req/min sostenidos (4/s). Los buckets por ruta
  // no limitan a quien rota entre 20 rutas; esto sí. Un usuario real con la
  // app abierta ronda <10 req/min; 240 es un techo de emergencia, no de uso.
  private readonly ipTotalLimit: RateLimitConfig = {
    windowMs: 60 * 1000,
    maxRequests: 240,
    message: 'Demasiadas peticiones desde tu conexión. Espera un momento.',
  };

  // El store crece con (IP × ruta): sin techo, un atacante con IPs rotantes
  // llena la memoria del solo instanciar entradas. Máx 20k entradas vivas.
  private static readonly MAX_STORE_ENTRIES = 20_000;

  private readonly logger = new Logger(RateLimiterMiddleware.name);
  /**
   * Store compartido entre instancias (Redis) cuando hay REDIS_URL. Sin
   * Redis, cada instancia cuenta por su cuenta: los límites valen por
   * instancia y se resetean con cada restart/deploy. Para login existe
   * además el throttle por cuenta en DB, que sí es global.
   */
  private redis: Redis | null = null;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    const url = process.env.REDIS_URL;
    if (url) {
      try {
        const client = new Redis(url, {
          lazyConnect: true,
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
        });
        client.on('error', (e) => this.logger.warn(`Redis rate-limit error: ${String(e)}`));
        client
          .connect()
          .then(() => this.logger.log('Rate limiter usando Redis compartido'))
          .catch((e) => this.logger.warn(`Redis no disponible, fallback en memoria: ${String(e)}`));
        this.redis = client;
      } catch (e) {
        this.logger.warn(`Redis no se pudo iniciar, fallback en memoria: ${String(e)}`);
        this.redis = null;
      }
    }
  }

  /** Solo Redis listo acepta comandos: sin conexión no se encola nada. */
  private redisReady(): Redis | null {
    const r = this.redis;
    return r && (r as any).status === 'ready' ? r : null;
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const ipKey = this.ipKey(ip);

    // 1) Techo por IP (todas las rutas suman aquí).
    const ipHit = await this.hit(ipKey, this.ipTotalLimit, now);
    if (ipHit.count > this.ipTotalLimit.maxRequests) {
      this.reject(res, this.ipTotalLimit, ipHit.resetTime, now);
      return;
    }

    // 2) Techo por ruta (configurado o default).
    const limit = this.getLimit(req);
    const routeKey = this.getKey(req);
    const routeHit = await this.hit(routeKey, limit, now);
    if (routeHit.count > limit.maxRequests) {
      this.reject(res, limit, routeHit.resetTime, now);
      return;
    }

    // Headers informativos sobre el límite por ruta (contrato original).
    res.setHeader('X-RateLimit-Limit', limit.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.maxRequests - routeHit.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(routeHit.resetTime / 1000));

    next();
  }

  /**
   * Incrementa el bucket y devuelve el estado. Redis primero (conteo global
   * entre instancias); si no hay Redis listo, el Map en memoria de siempre.
   * No lanza jamás: ante cualquier error usa memoria (fail-safe, no fail-open
   * total: el límite por instancia sigue valiendo).
   */
  private async hit(
    key: string,
    limit: RateLimitConfig,
    now: number,
  ): Promise<{ count: number; resetTime: number }> {
    const r = this.redisReady();
    if (r) {
      try {
        const namespaced = `kiwi:rl:${key}`;
        const count = await r.incr(namespaced);
        if (count === 1) {
          await r.pexpire(namespaced, limit.windowMs);
        }
        const ttl = await r.pttl(namespaced);
        return { count, resetTime: now + (ttl > 0 ? ttl : limit.windowMs) };
      } catch (e) {
        this.logger.warn(`Redis hit falló, fallback en memoria: ${String(e)}`);
      }
    }
    let entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // Store con techo: si algo llena el mapa, expulsa lo más viejo. Peor
      // caso: un atacante reinicia su propio contador — mejor que un OOM.
      if (!entry && this.store.size >= RateLimiterMiddleware.MAX_STORE_ENTRIES) {
        const oldestKey = this.store.keys().next().value as string | undefined;
        if (oldestKey !== undefined) this.store.delete(oldestKey);
      }
      entry = { count: 0, resetTime: now + limit.windowMs };
      this.store.set(key, entry);
    }

    entry.count++;
    return { count: entry.count, resetTime: entry.resetTime };
  }

  private reject(res: Response, limit: RateLimitConfig, resetTime: number, now: number) {
    const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000));
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

  /**
   * Ruta real para el bucket. Dentro de middleware montado, `req.path` es
   * relativo al mount ('/') y la ruta vive en `req.baseUrl` — usar solo
   * req.path hacía que TODAS las rutas compartieran el bucket 'GET:/' y
   * cada configuración por ruta fuera decorativa. (Detectado en bootsmoke:
   * baseUrl='/api/geocoding/search', path='/').
   */
  private getRoutePath(req: Request): string {
    const base = req.baseUrl || '';
    let rest = req.path !== undefined ? req.path : (req.url || '').split('?')[0];
    // Middleware montado por ruta: path='/' y baseUrl trae todo. Concatenar
    // directo daría '/ruta/' — sin la barra final no matchea la config.
    if (rest === '/') rest = '';
    return (base + rest).split('?')[0] || '/';
  }

  private ipKey(ip: string): string {
    return `ip-total:${ip}`;
  }

  private getKey(req: Request): string {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const route = `${req.method}:${this.getRoutePath(req)}`;
    return `${ip}:${route}`;
  }

  private getLimit(req: Request): RateLimitConfig {
    const route = `${req.method}:${this.getRoutePath(req)}`;

    // Check for exact match
    if (this.limits[route]) {
      return this.limits[route];
    }

    // Check for parameterized routes. El patrón se parte en el PRIMER
    // ':' — split(':') rompería ':id' en dos (bug latente: las rutas con
    // parámetro caían al default en silencio).
    for (const [pattern, limit] of Object.entries(this.limits)) {
      const sep = pattern.indexOf(':');
      if (sep === -1) continue;
      const method = pattern.slice(0, sep);
      const path = pattern.slice(sep + 1);
      if (method === req.method && this.matchRoute(path, this.getRoutePath(req))) {
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
