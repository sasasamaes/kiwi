import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MerchantsModule } from './merchants/merchants.module';
import { DriversModule } from './drivers/drivers.module';
import { OrdersModule } from './orders/orders.module';
import { MenuModule } from './menu/menu.module';
import { KYCModule } from './kyc/kyc.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { RoutingModule } from './routing/routing.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    // Environment config
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    UsersModule,
    MerchantsModule,
    DriversModule,
    OrdersModule,
    MenuModule,
    KYCModule,
    EventsModule,
    NotificationsModule,
    PaymentsModule,
    AnalyticsModule,
    WithdrawalsModule,
    GeocodingModule,
    RoutingModule,
    SecurityModule,
  ],
})
export class AppModule {}
