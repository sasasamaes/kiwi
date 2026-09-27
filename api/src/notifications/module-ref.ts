// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

/**
 * Módulo GLOBAL que re-exporta NotificationsService.
 *
 * Existe para romper dependencias circulares: OrdersModule, WithdrawalsModule
 * y RatingsModule necesitan notificar, y NotificationsService vive en
 * NotificationsModule. Al ser @Global, cualquier módulo de la app puede
 * inyectar NotificationsService sin importar NotificationsModule (y sin
 * ciclos: este módulo solo provee el servicio ya registrado en
 * NotificationsModule — se declara UNA vez en AppModule).
 */
@Global()
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsForwardModule {}
