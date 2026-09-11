import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OnvoPayWebhookDto {
  @ApiProperty({ description: 'Webhook event type' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Payment intent data' })
  @IsObject()
  data: any;

  @ApiProperty({ description: 'Webhook signature header' })
  @IsString()
  @IsOptional()
  signature?: string;
}

export class WebhookResponse {
  received: boolean;
  success?: boolean;
  unknownOrder?: boolean;
  error?: string;
}
