// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';

@Module({
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
