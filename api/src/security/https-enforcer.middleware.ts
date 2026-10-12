// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
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
      // Solo el host validado por el enrutador (Host), nunca el
      // x-forwarded-host que el cliente puede inventar. Caracteres fuera de
      // [host]:[puerto] o URLs raras → redirect relativo sin host.
      const rawHost = String(req.headers.host || '');
      const hostOk = /^[A-Za-z0-9.-]+(?::\d+)?$/.test(rawHost) && rawHost.length <= 253;
      const rawUrl = req.originalUrl || req.url || '/';
      const urlOk =
        rawUrl.startsWith('/') && !/[\s\x00-\x1f\x7f]/.test(rawUrl) && rawUrl.length <= 4096;
      const target = hostOk && urlOk ? `https://${rawHost}${rawUrl}` : urlOk ? rawUrl : '/';
      // 308 preserva método y body (301/302 degradan POST a GET en algunos clientes).
      res.redirect(308, target);
      return;
    }

    next();
  }
}
