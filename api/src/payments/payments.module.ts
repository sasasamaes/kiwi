import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OnvoPayProvider } from './providers/onvopay.provider';
import { StellarProvider } from './providers/stellar.provider';
import { FxRateProvider } from './providers/fx-rate.provider';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [CreditsModule],
  providers: [PaymentsService, OnvoPayProvider, StellarProvider, FxRateProvider],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
