import { Controller, Post, Get, Body, Param, UseGuards, Req, HttpCode, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a payment' })
  async createPayment(
    @CurrentUser() user: any,
    @Body() body: {
      orderId: string;
      method: 'onvopay_card' | 'onvopay_sinpe' | 'crypto' | 'cash';
      amount: number;
      customerEmail?: string;
      customerPhone?: string;
      cryptoCoin?: 'USDC' | 'USDT';
      paymentMethodId?: string;
    },
  ) {
    return this.paymentsService.createPayment({
      ...body,
      currency: body.cryptoCoin || 'CRC',
    });
  }

  @Post('confirm/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a payment intent' })
  async confirmPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() body: { paymentMethodId: string },
  ) {
    const { OnvoPayProvider } = await import('./providers/onvopay.provider');
    const provider = new OnvoPayProvider(null as any);
    return provider.confirmPaymentIntent(paymentIntentId, body.paymentMethodId);
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
    @Body() body: { amount: number; coin: 'USDC' | 'USDT' },
  ) {
    const { StellarProvider } = await import('./providers/stellar.provider');
    const provider = new StellarProvider(null as any);
    return provider.convertToCrypto(body.amount, body.coin);
  }
}
