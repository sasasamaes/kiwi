// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import * as express from 'express';
import { AppModule } from './app.module';

// Initialize Sentry before anything else
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Don't send events in test
      if (process.env.NODE_ENV === 'test') return null;
      // Sanitize sensitive data
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>;
        if (data && typeof data === 'object') {
          delete data['password'];
          delete data['passwordHash'];
          delete data['token'];
          delete data['accessToken'];
        }
      }
      return event;
    },
  });
}

/**
 * Ensure the database is reachable, migrated and seeded before serving traffic.
 *
 * Render's deploy pipeline only runs `start:prod` — nothing applies Prisma
 * migrations. `prisma migrate deploy` is idempotent, so we run it on EVERY
 * boot: probing user rows alone cannot detect column-level drift (a new
 * Prisma Client selecting columns the prod DB lacks, e.g. the flete fields,
 * 500s every orders query while user.count() keeps succeeding).
 */
async function ensureDatabaseReady(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('⚠️  DATABASE_URL not set — skipping database bootstrap');
    return;
  }

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const apiRoot = join(__dirname, '..'); // prisma/ and package.json live at the api root

  try {
    // 0. Apply pending migrations on every boot (no-op when up to date).
    console.log('🛠️  Applying pending migrations (if any)...');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: apiRoot,
    });

    // 1. Reachability + schema probe.
    const userCount = await prisma.user.count();
    console.log(`🗄️  Database reachable (${userCount} users)`);

    // 2. Demo data: seed an empty database (fresh prod deploys, preview envs).
    // Opt-IN in production (seeding wipes/replaces data) to avoid ever
    // seeding demo rows into a real prod DB by accident; opt-out otherwise.
    const seedFlag = process.env.SEED_DEMO_DATA;
    const isProd = process.env.NODE_ENV === 'production';
    const shouldSeed = seedFlag === 'true' || (!isProd && seedFlag !== 'false');
    if (userCount === 0 && shouldSeed) {
      console.log('🌱 Empty database — seeding demo data...');
      execSync('npx prisma db seed', { stdio: 'inherit', cwd: apiRoot });
    }
  } catch (error: any) {
    // Migrations already ran unconditionally above; if we still get here the
    // DB is unreachable or credentials are bad. Log loudly but keep serving so
    // Render doesn't flap the deploy while the DB comes back online.
    console.error(`❌ Database bootstrap failed (${error?.code ?? 'unknown'}): ${error?.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function bootstrap() {
  await ensureDatabaseReady();

  const app = await NestFactory.create(AppModule, {
    // Cap JSON bodies at 256KB. These parsers register BEFORE Nest's built-in
    // ones (which happen at listen()), so this limit is the one that applies.
    // Largest legitimate payloads are order/menu writes; uploads don't exist.
    bodyParser: true,
  });
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (k: string, v: unknown) => void;
    use: (...handlers: any[]) => void;
  };
  expressApp.use(
    express.json({
      limit: '256kb',
      // El HMAC del webhook (Onvo firma los bytes crudos) debe calcularse
      // sobre el body original: re-serializar el JSON parseado cambia
      // whitespace y rompe firmas válidas. Se guarda el crudo para el
      // controller del webhook.
      verify: (req: any, _res, buf) => {
        req.rawBody = buf?.toString('utf8');
      },
    }),
  );
  expressApp.use(express.urlencoded({ extended: true, limit: '256kb' }));

  // Render terminates TLS/routes via one proxy hop: trust X-Forwarded-For so
  // req.ip is the real client IP. Without this, every client shares the
  // proxy's IP and the login rate limit locks out the whole platform.
  const httpAdapter = app.getHttpAdapter().getInstance() as {
    set: (k: string, v: unknown) => void;
  };
  httpAdapter.set('trust proxy', 1);

  // Security headers (HSTS, no-sniff, frameguard, referrer-policy, …).
  // CSP stays off here: the API serves JSON + Swagger only.
  app.use(helmet());

  // Sentry request handling is automatic via httpIntegration/expressIntegration.
  // No manual request middleware needed in @sentry/nestjs v10.

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS: localhost + prod Vercel URLs + env override.
  // Render debe tener CLIENT_URL/WEB_URL/DRIVER_URL o CORS_ORIGIN seteados;
  // los defaults cubren prod aunque falten las vars (ese era el register bloqueado).
  const envOrigins = [
    process.env.CLIENT_URL, // Production client
    process.env.WEB_URL, // Production web
    process.env.DRIVER_URL, // Production driver
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
  ]
    .map((o) => o?.trim())
    .filter(Boolean) as string[];
  app.enableCors({
    origin: [
      'http://localhost:3000', // Web dashboard
      'http://localhost:3001', // Driver app
      'http://localhost:3002', // Client app
      'https://kiwi-merchant.vercel.app',
      'https://kiwi-client-tau.vercel.app',
      'https://kiwi-driver.vercel.app',
      // Dominio propio (transición: se mantienen los vercel.app arriba).
      // www es el canónico (el apex no tiene cert válido ni DNS estable).
      'https://kiwicr.express',
      'https://www.kiwicr.express',
      'https://negocios.kiwicr.express',
      'https://repartidores.kiwicr.express',
      'https://api.kiwicr.express',
      ...envOrigins,
    ],
    credentials: true,
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation — solo fuera de producción: no publica el mapa
  // completo de endpoints (y sus formas de payload) a internet.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Kiwi API')
      .setDescription('Kiwi Delivery Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // Sentry error handler (must be after routes)
  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  const port = parseInt(process.env.PORT, 10) || 3000;
  await app.listen(port);

  console.log(`🚀 Kiwi API running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/docs`);
  if (process.env.SENTRY_DSN) {
    console.log(`🐛 Sentry error tracking enabled`);
  }
}
bootstrap();
