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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
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
      user?.role,
    );
  }

  @Public()
  @Post('guest')
  @ApiOperation({ summary: 'Guest checkout payment (order link holders, no auth)' })
  async createGuestPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createGuestPayment({
      orderId: dto.orderId,
      method: dto.method,
      amount: dto.amount,
      currency: dto.method === 'crypto' ? dto.cryptoCoin || 'USDC' : 'CRC',
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
      cryptoCoin: dto.cryptoCoin,
    });
  }

  @Post('confirm/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a payment intent with a payment method' })
  @ApiBody({ type: ConfirmPaymentDto })
  async confirmPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser() user: any,
  ) {
    await this.paymentsService.assertIntentAccess(paymentIntentId, user);
    return this.onvopayProvider.confirmPaymentIntent(paymentIntentId, dto.paymentMethodId);
  }

  @Get('status/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status' })
  async getPaymentStatus(@Param('orderId') orderId: string, @CurrentUser() user: any) {
    return this.paymentsService.getPaymentStatusForUser(orderId, user);
  }

  @Public()
  @Get('public-status/:orderId')
  @ApiOperation({ summary: 'Coarse paid status for the order link (guests)' })
  async getPublicPaidStatus(@Param('orderId') orderId: string) {
    return this.paymentsService.getPublicPaidStatus(orderId);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all payments with summary (admin only)' })
  async listForAdmin(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
  ) {
    return this.paymentsService.listForAdmin({
      take: take != null ? Number(take) : undefined,
      skip: skip != null ? Number(skip) : undefined,
      status,
      method,
    });
  }

  @Public()
  @Get('methods')
  @ApiOperation({ summary: 'Get available payment methods' })
  async getPaymentMethods() {
    return this.paymentsService.getPaymentMethods();
  }

  @Public()
  @Post('webhook/:provider')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle payment webhook' })
  async handleWebhook(
    @Param('provider') provider: string,
    @Req() req: any,
    @Headers('x-onvo-signature') signature?: string,
  ) {
    return this.paymentsService.handleWebhook(provider, req.body, signature, req.rawBody);
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
  async getOnvoPaymentStatus(
    @Param('paymentIntentId') paymentIntentId: string,
    @CurrentUser() user: any,
  ) {
    await this.paymentsService.assertIntentAccess(paymentIntentId, user);
    return this.onvopayProvider.getPaymentIntentStatus(paymentIntentId);
  }

  @Post('onvo/cancel/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a payment intent' })
  async cancelOnvoPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @CurrentUser() user: any,
  ) {
    await this.paymentsService.assertIntentAccess(paymentIntentId, user);
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
    @CurrentUser() user: any,
  ) {
    await this.paymentsService.assertIntentAccess(paymentIntentId, user, true);
    return this.onvopayProvider.refundPayment(paymentIntentId, body.amount);
  }

  @Get('onvo/intent/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment intent details' })
  async getPaymentIntentDetails(
    @Param('paymentIntentId') paymentIntentId: string,
    @CurrentUser() user: any,
  ) {
    await this.paymentsService.assertIntentAccess(paymentIntentId, user);
    return this.onvopayProvider.getPaymentIntent(paymentIntentId);
  }
}
