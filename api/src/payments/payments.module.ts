import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OnvoPayProvider } from './providers/onvopay.provider';
import { StellarProvider } from './providers/stellar.provider';

@Module({
  providers: [PaymentsService, OnvoPayProvider, StellarProvider],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
