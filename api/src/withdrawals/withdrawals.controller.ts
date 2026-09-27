// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WithdrawalsService } from './withdrawals.service';

@ApiTags('Withdrawals')
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  // ============================================
  // 🛵 DRIVER ENDPOINTS
  // ============================================

  @Get('balance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get driver balance' })
  async getBalance(@Request() req) {
    return this.withdrawalsService.getBalance(req.user.sub ?? req.user.id);
  }

  @Post('request')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request withdrawal' })
  async requestWithdrawal(
    @Request() req,
    @Body()
    data: {
      amount: number;
      paymentMethod: 'sinpe' | 'bank_transfer';
      sinpePhone?: string;
      sinpeName?: string;
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
    },
  ) {
    return this.withdrawalsService.requestWithdrawal(req.user.sub ?? req.user.id, data);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my withdrawals' })
  @ApiQuery({ name: 'status', required: false })
  async getMyWithdrawals(@Request() req, @Query('status') status?: string) {
    return this.withdrawalsService.getMyWithdrawals(req.user.sub ?? req.user.id, status);
  }

  @Get('my/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get withdrawal by ID' })
  async getWithdrawalById(@Param('id') id: string, @Request() req) {
    return this.withdrawalsService.getWithdrawalById(id, req.user.sub ?? req.user.id);
  }

  @Put('my/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel withdrawal' })
  async cancelWithdrawal(@Param('id') id: string, @Request() req) {
    return this.withdrawalsService.cancelWithdrawal(id, req.user.sub ?? req.user.id);
  }

  // ============================================
  // 🛡️ ADMIN ENDPOINTS
  // ============================================

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending withdrawals (admin)' })
  async getPendingWithdrawals() {
    return this.withdrawalsService.getAllPendingWithdrawals();
  }

  @Put('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve withdrawal (admin)' })
  async approveWithdrawal(
    @Param('id') id: string,
    @Request() req,
    @Body('transactionId') transactionId?: string,
  ) {
    return this.withdrawalsService.approveWithdrawal(
      id,
      req.user.sub ?? req.user.id,
      transactionId,
    );
  }

  @Put('admin/:id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete withdrawal (admin)' })
  async completeWithdrawal(@Param('id') id: string, @Body('transactionId') transactionId: string) {
    return this.withdrawalsService.completeWithdrawal(id, transactionId);
  }

  @Put('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject withdrawal (admin)' })
  async rejectWithdrawal(@Param('id') id: string, @Request() req, @Body('reason') reason: string) {
    return this.withdrawalsService.rejectWithdrawal(id, req.user.sub ?? req.user.id, reason);
  }
}
