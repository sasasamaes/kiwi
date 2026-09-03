import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import { ProfilingIntegration } from '@sentry/profiling-node';
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

async function bootstrap() {
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
