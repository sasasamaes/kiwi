// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
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
import { MerchantInvoicesService } from './merchant-invoices.service';
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
    private readonly merchantInvoices: MerchantInvoicesService,
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

  @Get('admin/crypto/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List pending crypto payments for reconciliation (admin only)' })
  async listPendingCryptoAdmin(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.paymentsService.listPendingCryptoAdmin({
      take: take != null ? Number(take) : undefined,
      skip: skip != null ? Number(skip) : undefined,
    });
  }

  @Post('admin/merchant-invoices/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Preview weekly billing cut for a merchant (admin only)' })
  async previewMerchantInvoice(@Body() body: { merchantId: string; week?: string }) {
    if (!body?.merchantId) throw new BadRequestException('merchantId requerido');
    return this.merchantInvoices.preview(body.merchantId, body.week);
  }

  @Post('admin/merchant-invoices/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate weekly billing receipt for a merchant (admin only)' })
  async generateMerchantInvoice(
    @CurrentUser() user: any,
    @Body() body: { merchantId: string; week?: string },
  ) {
    if (!body?.merchantId) throw new BadRequestException('merchantId requerido');
    return this.merchantInvoices.generate(user.sub ?? user.id, body.merchantId, body.week);
  }

  @Get('admin/merchant-invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List merchant invoices (admin only)' })
  async listMerchantInvoices(
    @Query('merchantId') merchantId?: string,
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.merchantInvoices.listForAdmin({
      merchantId,
      status,
      take: take != null ? Number(take) : undefined,
      skip: skip != null ? Number(skip) : undefined,
    });
  }

  @Get('admin/merchant-invoices/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Merchant invoice receipt with lines (admin only)' })
  async getMerchantInvoice(@Param('id') id: string) {
    return this.merchantInvoices.detail(id);
  }

  @Post('admin/merchant-invoices/:id/mark-paid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark merchant invoice as paid (admin only)' })
  async markMerchantInvoicePaid(@CurrentUser() user: any, @Param('id') id: string) {
    return this.merchantInvoices.markPaid(user.sub ?? user.id, id);
  }

  @Get('me/merchant-invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My weekly billing receipts (merchant only)' })
  async listMyMerchantInvoices(
    @CurrentUser() user: any,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const merchant = await this.paymentsService.merchantIdForUser(user.sub ?? user.id);
    return this.merchantInvoices.listForMerchant(
      merchant,
      take != null ? Number(take) : 30,
      skip != null ? Number(skip) : 0,
    );
  }

  @Get('me/merchant-invoices/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My weekly billing receipt detail (merchant only)' })
  async getMyMerchantInvoice(@CurrentUser() user: any, @Param('id') id: string) {
    const merchant = await this.paymentsService.merchantIdForUser(user.sub ?? user.id);
    return this.merchantInvoices.detail(id, merchant);
  }

  @Post('admin/crypto/reverify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Force on-chain re-verification for a crypto payment (admin only)' })
  async adminReverifyCrypto(@Body() body: { orderId: string }) {
    if (!body?.orderId || typeof body.orderId !== 'string') {
      throw new BadRequestException('orderId requerido');
    }
    return this.paymentsService.adminReverifyCrypto(body.orderId);
  }

  @Get('admin/fx/health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'FX sources health + last cached rate (admin only)' })
  async getFxHealth() {
    return this.stellarProvider.getFxHealth();
  }

  @Public()
  @Get('crypto/rate')
  @ApiOperation({ summary: 'Current CRC/USD rate from the backend FX oracle (transparency)' })
  async getCryptoRate() {
    return this.stellarProvider.getExchangeRateInfo();
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
    return this.paymentsService.cancelOnvoPayment(paymentIntentId, user);
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
    return this.paymentsService.refundOnvoPayment(paymentIntentId, body?.amount, user);
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
