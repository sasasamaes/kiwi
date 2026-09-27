// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';

@Module({
  providers: [CreditsService, OnvoPayProvider],
  controllers: [CreditsController],
  exports: [CreditsService],
})
export class CreditsModule {}
