import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Cabeceras de seguridad específicas del API — SOLO las que helmet no cubre
 * o donde la política del API difiere del default de helmet:
 *
 * - helmet 8 ya emite: nosniff, X-Frame-Options(DENY), Referrer-Policy,
 *   COOP, CORP, Origin-Agent-Cluster, X-DNS-Prefetch, X-Permitted-Cross-Domain,
 *   X-Download-Options, HSTS (si no se desactiva), quita X-Powered-By y
 *   pone X-XSS-Protection: 0 (correcto para navegadores modernos).
 * - Duplicarlas aquí era inofensivo PERO este middleware pisaba
 *   X-XSS-Protection con el valor legacy `1; mode=block` — se elimina.
 *
 * Lo que SÍ vive aquí:
 * - CSP estricta del API (JSON + Swagger): helmet no pone CSP por defecto.
 * - Permissions-Policy: el API no es superficie interactiva; bloquea todo.
 * - HSTS con preload: dominio 100% HTTPS (Vercel/Render), preload es gratis.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // CSP del API: solo JSON y Swagger. Sin scripts/styles propios, la
    // política puede ser estricta de verdad.
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; '),
    );

    // El API no consume cámara/micrófono/geolocalización: el header no
    // aplica a respuestas JSON, pero declararlo no cuesta y documenta política.
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    );

    // HSTS con preload (solo prod): TLS termina en Render, el header le dice
    // al navegador que nunca baje a HTTP ni en el primer request.
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
  }
}
