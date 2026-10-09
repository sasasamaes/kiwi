// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { AdsModule } from '../ads/ads.module';
import { ImageUploadService } from '../menu/image-upload.service';

@Module({
  imports: [AdsModule],
  providers: [MerchantsService, ImageUploadService],
  controllers: [MerchantsController],
  exports: [MerchantsService],
})
export class MerchantsModule {}
