// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MerchantsModule } from './merchants/merchants.module';
import { DriversModule } from './drivers/drivers.module';
import { OrdersModule } from './orders/orders.module';
import { RatingsModule } from './ratings/ratings.module';
import { ContactModule } from './contact/contact.module';
import { MenuModule } from './menu/menu.module';
import { FollowsModule } from './follows/follows.module';
import { KYCModule } from './kyc/kyc.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotificationsForwardModule } from './notifications/module-ref';
import { PaymentsModule } from './payments/payments.module';
import { CreditsModule } from './credits/credits.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { RoutingModule } from './routing/routing.module';
import { SecurityModule } from './security/security.module';
import { SentryModule } from './sentry/sentry.module';
import { SettingsModule } from './settings/settings.module';
import { AdsModule } from './ads/ads.module';
import { CustomersModule } from './customers/customers.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';

@Module({
  imports: [
    // Environment config
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Database
    PrismaModule,

    // Feature flags (global — KYC_REQUIRED, …)
    FeatureFlagsModule,

    // Health probes (liveness, DB, schema drift)
    HealthModule,

    // Feature modules
    AuthModule,
    UsersModule,
    MerchantsModule,
    DriversModule,
    OrdersModule,
    RatingsModule,
    ContactModule,
    MenuModule,
    FollowsModule,
    KYCModule,
    EventsModule,
    NotificationsModule,
    NotificationsForwardModule,
    PaymentsModule,
    CreditsModule,
    AnalyticsModule,
    WithdrawalsModule,
    GeocodingModule,
    RoutingModule,
    SecurityModule,
    SentryModule,
    SettingsModule,
    AdsModule,
    CustomersModule,
  ],
})
export class AppModule {}
