import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { DriversModule } from '../drivers/drivers.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { ProximityModule } from './proximity.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  // NotificationsService llega vía NotificationsForwardModule (@Global).
  imports: [
    PrismaModule,
    EventsModule,
    DriversModule,
    GeocodingModule,
    ProximityModule,
    SettingsModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
