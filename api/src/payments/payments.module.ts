// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { MerchantInvoicesService } from './merchant-invoices.service';
import { PaymentsController } from './payments.controller';
import { OnvoPayProvider } from './providers/onvopay.provider';
import { MarketplaceService } from './marketplace/marketplace.service';
import { DriverMarketplaceService } from './marketplace/driver-marketplace.service';
import { StellarProvider } from './providers/stellar.provider';
import { FxRateProvider } from './providers/fx-rate.provider';
import { CreditsModule } from '../credits/credits.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  // forwardRef: OrdersModule → DriversModule → PaymentsModule (ciclo).
  imports: [CreditsModule, forwardRef(() => OrdersModule)],
  providers: [
    PaymentsService,
    MerchantInvoicesService,
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
