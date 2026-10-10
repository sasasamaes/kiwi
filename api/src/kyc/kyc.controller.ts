// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KYCService } from './kyc.service';

@ApiTags('KYC')
@Controller('kyc')
export class KYCController {
  constructor(private readonly kycService: KYCService) {}

  // ============================================
  // 🔐 USER ENDPOINTS
  // ============================================

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC status for current user' })
  async getStatus(@Request() req) {
    const userId = req.user.sub ?? req.user.id;
    const userVerification = await this.kycService.getVerificationByUserId(userId);
    return userVerification || { status: 'not_submitted' };
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit KYC documents' })
  async submitDocuments(@Request() req, @Body() data: any) {
    return this.kycService.submitDocuments(req.user.sub ?? req.user.id, data);
  }

  // ============================================
  // 🤖 Didit hosted KYC
  // ============================================

  @Post('didit/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start Didit hosted verification (returns url)' })
  async startDidit(@Request() req) {
    return this.kycService.startDiditSession(req.user.sub ?? req.user.id);
  }

  @Post('didit/refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pull Didit decision manually (webhook fallback)' })
  async refreshDidit(@Request() req) {
    return this.kycService.refreshDiditSession(req.user.sub ?? req.user.id);
  }

  @Post('webhook/didit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Didit webhook (signed, public)' })
  async diditWebhook(@Request() req, @Headers('x-signature-v2') signature: string) {
    // El body ya viene parseado; la firma V2 se verifica sobre el canónico
    // re-serializado (sobrevive re-encodeo del middleware).
    return this.kycService.handleDiditWebhook(signature || '', req.body);
  }

  // ============================================
  // 🛡️ ADMIN ENDPOINTS
  // ============================================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all KYC verifications (admin)' })
  @ApiQuery({ name: 'status', required: false })
  async getAllVerifications(@Query('status') status?: string) {
    return this.kycService.getAllVerifications(status);
  }

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending KYC verifications (admin)' })
  async getPendingVerifications() {
    return this.kycService.getPendingVerifications();
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC statistics (admin)' })
  async getStats() {
    return this.kycService.getVerificationStats();
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC verification by ID (admin)' })
  async getVerificationById(@Param('id') id: string) {
    return this.kycService.getVerificationById(id);
  }

  @Put('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve KYC verification (admin)' })
  async approveVerification(@Param('id') id: string, @Request() req) {
    return this.kycService.approveVerification(id, req.user.sub ?? req.user.id);
  }

  @Put('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject KYC verification (admin)' })
  async rejectVerification(
    @Param('id') id: string,
    @Request() req,
    @Body('reason') reason: string,
  ) {
    return this.kycService.rejectVerification(id, req.user.sub ?? req.user.id, reason);
  }
}
