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
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OnvoPayProvider } from './providers/onvopay.provider';
import { StellarProvider } from './providers/stellar.provider';
import { CreatePaymentDto, PaymentMethodType } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

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
  @ApiBody({ type: CreatePaymentDto })
  async createPayment(@CurrentUser() user: any, @Body() dto: CreatePaymentDto) {
    // Validate amount is positive if provided
    if (dto.amount !== undefined && dto.amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor que cero');
    }

    return this.paymentsService.createPayment(
      {
        orderId: dto.orderId,
        method: dto.method,
        amount: dto.amount,
        currency: dto.method === 'crypto' ? dto.cryptoCoin || 'USDC' : 'CRC',
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
        cryptoCoin: dto.cryptoCoin,
        paymentMethodId: dto.paymentMethodId,
      },
      user?.sub ?? user?.id,
    );
  }

  @Post('confirm/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a payment intent with a payment method' })
  @ApiBody({ type: ConfirmPaymentDto })
  async confirmPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.onvopayProvider.confirmPaymentIntent(paymentIntentId, dto.paymentMethodId);
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

  @Get('onvo/status/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get OnvoPay payment intent status' })
  async getOnvoPaymentStatus(@Param('paymentIntentId') paymentIntentId: string) {
    return this.onvopayProvider.getPaymentIntentStatus(paymentIntentId);
  }

  @Post('onvo/cancel/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a payment intent' })
  async cancelOnvoPayment(@Param('paymentIntentId') paymentIntentId: string) {
    return this.onvopayProvider.cancelPaymentIntent(paymentIntentId);
  }

  @Get('onvo/methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available OnvoPay payment methods' })
  async getOnvoPaymentMethods() {
    return this.onvopayProvider.getAvailablePaymentMethods();
  }

  @Post('onvo/refund/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund a payment' })
  async refundPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() body: { amount?: number },
  ) {
    return this.onvopayProvider.refundPayment(paymentIntentId, body.amount);
  }

  @Get('onvo/intent/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment intent details' })
  async getPaymentIntentDetails(@Param('paymentIntentId') paymentIntentId: string) {
    return this.onvopayProvider.getPaymentIntent(paymentIntentId);
  }
}
