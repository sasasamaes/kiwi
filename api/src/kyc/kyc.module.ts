import { Module } from '@nestjs/common';
import { KYCService } from './kyc.service';
import { KYCController } from './kyc.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FieldCipher } from '../security/field-cipher';

@Module({
  imports: [PrismaModule],
  providers: [KYCService, FieldCipher],
  controllers: [KYCController],
  exports: [KYCService],
})
export class KYCModule {}
