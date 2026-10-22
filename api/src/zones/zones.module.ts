// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { ZonesService } from './zones.service';
import { ZonesController } from './zones.controller';

@Module({
  imports: [PrismaModule, SettingsModule],
  providers: [ZonesService],
  controllers: [ZonesController],
  exports: [ZonesService],
})
export class ZonesModule {}
