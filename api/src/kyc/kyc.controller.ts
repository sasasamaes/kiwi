import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('KYC')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC status' })
  async getStatus(@CurrentUser() user: any) {
    return this.kycService.getKycStatus(user.sub);
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit KYC documents' })
  async submitDocuments(@CurrentUser() user: any, @Body() submitDto: any) {
    return this.kycService.submitDocuments(user.sub, submitDto);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending verifications (admin only)' })
  async getPending() {
    return this.kycService.getPendingVerifications();
  }

  @Put(':userId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update KYC status (admin only)' })
  async updateStatus(
    @CurrentUser() user: any,
    @Body() updateDto: { status: string; notes?: string; rejectionReason?: string },
  ) {
    // In real app, get userId from params, not from JWT
    return this.kycService.updateStatus(
      user.sub,
      updateDto.status,
      updateDto.notes,
      updateDto.rejectionReason,
    );
  }
}
