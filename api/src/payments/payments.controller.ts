import { Controller, Post, Get, Body, Param, UseGuards, Req, HttpCode } from '@nestjs/common';
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
    },
  ) {
    return this.paymentsService.createPayment({
      ...body,
      currency: body.cryptoCoin || 'CRC',
    });
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
  ) {
    // In production, verify webhook signature
    return this.paymentsService.handleWebhook(provider, req.body);
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
