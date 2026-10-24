// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { DeliveryLinksService } from './delivery-links.service';
import { DeliveryLinksController } from './delivery-links.controller';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { ZonesModule } from '../zones/zones.module';

@Module({
  // Sin ciclo: ningún módulo importa a DeliveryLinksModule.
  imports: [OrdersModule, PaymentsModule, ZonesModule],
  controllers: [DeliveryLinksController],
  providers: [DeliveryLinksService],
  exports: [DeliveryLinksService],
})
export class DeliveryLinksModule {}
