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
import { KYCModule } from './kyc/kyc.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotificationsForwardModule } from './notifications/module-ref';
import { PaymentsModule } from './payments/payments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { RoutingModule } from './routing/routing.module';
import { SecurityModule } from './security/security.module';
import { SentryModule } from './sentry/sentry.module';

@Module({
  imports: [
    // Environment config
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Database
    PrismaModule,

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
    KYCModule,
    EventsModule,
    NotificationsModule,
    NotificationsForwardModule,
    PaymentsModule,
    AnalyticsModule,
    WithdrawalsModule,
    GeocodingModule,
    RoutingModule,
    SecurityModule,
    SentryModule,
  ],
})
export class AppModule {}
