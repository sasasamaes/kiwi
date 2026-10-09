// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { ImageUploadService } from '../menu/image-upload.service';

@Module({
  providers: [CustomersService, ImageUploadService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
