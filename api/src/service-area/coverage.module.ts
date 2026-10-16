// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { CoverageService } from './coverage.service';
import { CoverageController } from './coverage.controller';

@Module({
  controllers: [CoverageController],
  providers: [CoverageService],
  exports: [CoverageService],
})
export class CoverageModule {}
