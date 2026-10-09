// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [AdsService],
  controllers: [AdsController],
  exports: [AdsService],
})
export class AdsModule {}
