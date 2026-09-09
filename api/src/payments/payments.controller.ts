import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OnvoPayProvider } from './providers/onvopay.provider';
import { StellarProvider } from './providers/stellar.provider';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly onvopayProvider: OnvoPayProvider,
    private readonly stellarProvider: StellarProvider,
  ) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a payment' })
  async createPayment(
    @CurrentUser() user: any,
    @Body()
    body: {
      orderId: string;
      method: 'onvopay_card' | 'onvopay_sinpe' | 'crypto' | 'cash';
      amount: number;
      customerEmail?: string;
      customerPhone?: string;
      cryptoCoin?: 'USDC' | 'USDT';
      paymentMethodId?: string;
    },
  ) {
    return this.paymentsService.createPayment(
      {
        ...body,
        currency: body.cryptoCoin || 'CRC',
      },
      user?.sub ?? user?.id,
    );
  }

  @Post('confirm/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a payment intent' })
  async confirmPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() body: { paymentMethodId: string },
  ) {
    return this.onvopayProvider.confirmPaymentIntent(paymentIntentId, body.paymentMethodId);
  }

  @Get('status/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status' })
  async getPaymentStatus(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentStatus(orderId);
  }

  @Get('methods')
  @ApiOperation({ summary: 'Get available payment methods' })
  async getPaymentMethods() {
    return this.paymentsService.getPaymentMethods();
  }

  @Post('webhook/:provider')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle payment webhook' })
  async handleWebhook(
    @Param('provider') provider: string,
    @Req() req: any,
    @Headers('x-onvo-signature') signature?: string,
  ) {
    return this.paymentsService.handleWebhook(provider, req.body, signature);
  }

  @Get('crypto/quote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get crypto conversion quote' })
  async getCryptoQuote(
    @CurrentUser() user: any,
    @Query('amount') amount: string,
    @Query('coin') coin: 'USDC' | 'USDT',
  ) {
    return this.stellarProvider.convertToCrypto(Number(amount), coin);
  }
}
