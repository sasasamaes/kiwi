import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
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
    const verifications = await this.kycService.getAllVerifications();
    const userVerification = verifications.find(v => v.userId === req.user.id);
    return userVerification || { status: 'not_submitted' };
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit KYC documents' })
  async submitDocuments(@Request() req, @Body() data: any) {
    return this.kycService.submitDocuments(req.user.id, data);
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
    return this.kycService.approveVerification(id, req.user.id);
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
    return this.kycService.rejectVerification(id, req.user.id, reason);
  }
}
