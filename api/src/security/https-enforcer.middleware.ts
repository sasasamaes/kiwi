import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Fuerza HTTPS en producción.
 *
 * Render termina TLS en su proxy: al contenedor llegan requests HTTP con el
 * header `x-forwarded-proto` indicando el esquema ORIGINAL. Solo redirigimos
 * cuando ese header dice 'http' explícitamente — el tráfico interno del
 * contenedor (health checks de Render, el handshake inicial de socket.io)
 * llega sin el header y pasa intacto.
 *
 * El redirect es 308 (Permanent Redirect, preserva método y body): un POST de
 * login o de creación de orden reenviado como 301/302 por algunos clientes
 * degradaría a GET y perdería el body.
 *
 * Con HSTS ya emitido (security-headers), un navegador que haya visto la
 * respuesta una vez ni siquiera llega a hacer el request http: es
 * enforcamiento local. Este middleware cubre la PRIMERA visita y clientes
 * no-navegador (curl, webhooks mal configurados).
 */
@Injectable()
export class HttpsEnforcerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }

    const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();

    if (proto === 'http') {
      const host = req.headers['x-forwarded-host'] || req.headers.host || '';
      // 308 preserva método y body (301/302 degradan POST a GET en algunos clientes).
      res.redirect(308, `https://${host}${req.originalUrl || req.url}`);
      return;
    }

    next();
  }
}
