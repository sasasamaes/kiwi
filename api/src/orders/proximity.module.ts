// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { ProximityService } from './proximity.service';

@Module({
  providers: [ProximityService],
  exports: [ProximityService],
})
export class ProximityModule {}
