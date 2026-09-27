// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Cheap, high-signal bot filtering. Runs BEFORE the rate limiter so scanner
 * noise never consumes a legit client's request budget.
 *
 * Blocks:
 *  - Known vulnerability-scanner paths (WordPress/phpMyAdmin/.env/.git/…):
 *    none of these exist in this API — every hit is automated probing.
 *  - Requests with NO User-Agent: browsers, the Next apps (fetch/XHR) and
 *    socket.io always send one; headerless clients are scripted tools.
 *  - Known bad crawler signatures (sqlmap, nikto, masscan, …).
 *
 * Deliberately NOT blocked: curl/wget (legit for debugging and deploy
 * verification), and empty-path scanners are handled by the 404 + rate-limit
 * layers instead of heuristic guessing.
 */
@Injectable()
export class BotProtectionMiddleware implements NestMiddleware {
  /** Path fragments that only ever appear in automated scanner traffic. */
  private static readonly SCANNER_PATHS = [
    '/wp-admin',
    '/wp-login',
    '/wordpress',
    '/phpmyadmin',
    '/pma',
    '/mysql',
    '/.env',
    '/.git',
    '/.aws',
    '/.ssh',
    '/config.json',
    '/backup.sql',
    '/dump.sql',
    '/adminer',
    '/shell.php',
    '/.asp',
    '/.jsp',
    '/cgi-bin',
    '/vendor/phpunit',
    '/actuator',
    '/owa/auth',
    '/autodiscover',
    '/_profiler',
    '/telescope',
    '/api.php',
  ];

  /** Tools that fingerprint themselves in User-Agent. */
  private static readonly BAD_AGENTS = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'zgrab',
    'dirbuster',
    'gobuster',
    'wfuzz',
    'ffuf',
    'acunetix',
    'nessus',
    'openvas',
    'w3af',
    'havij',
    'arachni',
  ];

  use(req: Request, res: Response, next: NextFunction) {
    const path = (req.path || req.originalUrl || '').toLowerCase();

    // 1. Scanner paths: instant 404-shaped rejection (404 instead of 403 so
    //    bots don't learn a guard exists here — nothing is hidden, it's absent).
    for (const frag of BotProtectionMiddleware.SCANNER_PATHS) {
      if (path.includes(frag)) {
        throw new HttpException(
          { statusCode: HttpStatus.NOT_FOUND, message: 'Cannot GET' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // 2. No User-Agent at all → scripted client.
    const ua = req.headers['user-agent'];
    if (!ua || typeof ua !== 'string' || ua.trim().length === 0) {
      throw new HttpException(
        { statusCode: HttpStatus.FORBIDDEN, message: 'Cliente no permitido' },
        HttpStatus.FORBIDDEN,
      );
    }

    // 3. Known attack-tool signatures.
    const uaLower = ua.toLowerCase();
    for (const bad of BotProtectionMiddleware.BAD_AGENTS) {
      if (uaLower.includes(bad)) {
        throw new HttpException(
          { statusCode: HttpStatus.FORBIDDEN, message: 'Cliente no permitido' },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    next();
  }
}
