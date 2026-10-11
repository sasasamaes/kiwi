// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OnvoPayProvider } from './providers/onvopay.provider';
import { MarketplaceService } from './marketplace/marketplace.service';
import { DriverMarketplaceService } from './marketplace/driver-marketplace.service';
import { StellarProvider } from './providers/stellar.provider';
import { FxRateProvider } from './providers/fx-rate.provider';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [CreditsModule],
  providers: [
    PaymentsService,
    OnvoPayProvider,
    MarketplaceService,
    DriverMarketplaceService,
    StellarProvider,
    FxRateProvider,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, MarketplaceService, DriverMarketplaceService, OnvoPayProvider],
})
export class PaymentsModule {}
