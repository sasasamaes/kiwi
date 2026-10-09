// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { ImageUploadService } from '../menu/image-upload.service';

@Module({
  providers: [DriversService, ImageUploadService],
  controllers: [DriversController],
  exports: [DriversService],
})
export class DriversModule {}
