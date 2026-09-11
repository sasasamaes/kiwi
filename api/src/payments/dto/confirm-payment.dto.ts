import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'Tokenized payment method ID' })
  @IsString()
  paymentMethodId: string;
}
