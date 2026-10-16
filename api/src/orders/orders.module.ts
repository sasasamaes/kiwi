// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { DriversModule } from '../drivers/drivers.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { ProximityModule } from './proximity.module';
import { SettingsModule } from '../settings/settings.module';
import { ImageUploadService } from '../menu/image-upload.service';
import { AssignmentSweeper } from './assignment-sweeper.service';
import { ZonesModule } from '../zones/zones.module';
import { CoverageModule } from '../service-area/coverage.module';

@Module({
  // NotificationsService llega vía NotificationsForwardModule (@Global).
  imports: [
    PrismaModule,
    EventsModule,
    DriversModule,
    GeocodingModule,
    ProximityModule,
    SettingsModule,
    ZonesModule,
    CoverageModule,
  ],
  providers: [OrdersService, ImageUploadService, AssignmentSweeper],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
