// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module, forwardRef } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { ShiftsService } from './shifts.service';
import { DriversController } from './drivers.controller';
import { ImageUploadService } from '../menu/image-upload.service';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  // forwardRef: PaymentsModule → OrdersModule → DriversModule → PaymentsModule.
  imports: [forwardRef(() => PaymentsModule), SettingsModule],
  providers: [DriversService, ImageUploadService, ShiftsService],
  controllers: [DriversController],
  exports: [DriversService],
})
export class DriversModule {}
