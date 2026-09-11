import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export type PaymentMethodType = 'onvopay_card' | 'onvopay_sinpe' | 'crypto' | 'cash';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Order ID to pay for' })
  @IsString()
  orderId: string;

  @ApiProperty({
    description: 'Payment method to use',
    enum: ['onvopay_card', 'onvopay_sinpe', 'crypto', 'cash'],
  })
  @IsIn(['onvopay_card', 'onvopay_sinpe', 'crypto', 'cash'])
  method: PaymentMethodType;

  @ApiProperty({
    description: 'Amount to charge (will use order total if not provided)',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiProperty({
    description: 'Customer email for payment notifications',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerEmail?: string;

  @ApiProperty({
    description: 'Customer phone for SINPE payments',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiProperty({
    description: 'Crypto coin for crypto payments',
    enum: ['USDC', 'USDT'],
    required: false,
  })
  @IsString()
  @IsOptional()
  cryptoCoin?: 'USDC' | 'USDT';

  @ApiProperty({
    description: 'Tokenized payment method ID (for immediate confirmation)',
    required: false,
  })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;
}
