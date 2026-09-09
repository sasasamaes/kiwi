import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { AppModule } from './app.module';

// Initialize Sentry before anything else
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express(),
      new ProfilingIntegration(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Don't send events in test
      if (process.env.NODE_ENV === 'test') return null;
      // Sanitize sensitive data
      if (event.request?.data) {
        const data = event.request.data;
        delete data.password;
        delete data.passwordHash;
        delete data.token;
        delete data.accessToken;
      }
      return event;
    },
  });
}

/**
 * Ensure the database is reachable, migrated and seeded before serving traffic.
 *
 * Render's deploy pipeline only runs `start:prod` — nothing applies Prisma
 * migrations or seeds demo data, so a fresh database means every DB-backed
 * route 500s (P2021/P2022 "table does not exist") until someone runs
 * migrations by hand. This makes a fresh deploy self-heal instead.
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
    // P2021/P2022: tables missing — apply migrations, then re-probe and seed.
    const code = error?.code;
    if (code === 'P2021' || code === 'P2022') {
      console.log('🛠️  Schema missing — applying pending migrations...');
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        cwd: join(__dirname, '..'), // prisma/ lives one level above dist/
      });

      const userCount = await prisma.user.count();
      console.log(`🗄️  Migrations applied (${userCount} users)`);

      const seedFlagAfter = process.env.SEED_DEMO_DATA;
      const isProdAfter = process.env.NODE_ENV === 'production';
      const shouldSeedAfter =
        seedFlagAfter === 'true' || (!isProdAfter && seedFlagAfter !== 'false');
      if (userCount === 0 && shouldSeedAfter) {
        console.log('🌱 Empty database — seeding demo data...');
        execSync('npx prisma db seed', { stdio: 'inherit', cwd: join(__dirname, '..') });
      }
    } else {
      // Unreachable DB, bad credentials, etc. Log loudly but keep serving so
      // Render doesn't flap the deploy while the DB comes back online.
      console.error(`❌ Database bootstrap failed (${code ?? 'unknown'}): ${error?.message}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function bootstrap() {
  await ensureDatabaseReady();

  const app = await NestFactory.create(AppModule);

  // Sentry request handler (must be first middleware)
  if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: [
      'http://localhost:3000', // Web dashboard
      'http://localhost:3001', // Driver app
      'http://localhost:3002', // Client app
      process.env.CLIENT_URL, // Production client
      process.env.WEB_URL, // Production web
    ].filter(Boolean),
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

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Kiwi API')
    .setDescription('Kiwi Delivery Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Sentry error handler (must be after routes)
  if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
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
