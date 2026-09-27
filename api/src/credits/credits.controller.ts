// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreditsService } from './credits.service';

@ApiTags('Credits')
@Controller('credits')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance')
  @UseGuards(RolesGuard)
  @Roles('merchant')
  @ApiOperation({ summary: 'Mi saldo de crédito prepago' })
  async balance(@CurrentUser() user: any) {
    return this.creditsService.getBalance(user.sub);
  }

  @Get('history')
  @UseGuards(RolesGuard)
  @Roles('merchant')
  @ApiOperation({ summary: 'Mis movimientos de crédito' })
  async history(
    @CurrentUser() user: any,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.creditsService.getHistory(
      user.sub,
      take != null ? Number(take) : undefined,
      skip != null ? Number(skip) : undefined,
    );
  }

  @Post('topup')
  @UseGuards(RolesGuard)
  @Roles('merchant')
  @ApiOperation({ summary: 'Recargar mi crédito con tarjeta (Onvo Checkout)' })
  async topup(@CurrentUser() user: any, @Body('amount') amount: number) {
    return this.creditsService.createTopup(user.sub, Number(amount));
  }

  @Get('topup/:id')
  @UseGuards(RolesGuard)
  @Roles('merchant')
  @ApiOperation({ summary: 'Estado de mi recarga con tarjeta' })
  async topupStatus(@CurrentUser() user: any, @Param('id') id: string) {
    return this.creditsService.getTopup(user.sub, id);
  }

  @Get('admin/merchants')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Comercios con su saldo (admin)' })
  async merchants() {
    return this.creditsService.listMerchants();
  }

  @Get('admin/merchants/:id/history')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Movimientos de un comercio (admin)' })
  async merchantHistory(
    @Param('id') id: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.creditsService.adminHistory(
      id,
      take != null ? Number(take) : undefined,
      skip != null ? Number(skip) : undefined,
    );
  }

  @Post('admin/merchants/:id/recharge')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Recargar crédito a un comercio (admin)' })
  async recharge(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.creditsService.recharge(id, Number(amount), user.sub, reason);
  }

  @Post('admin/merchants/:id/refund')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Devolver crédito a un comercio (admin)' })
  async refund(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.creditsService.refund(id, Number(amount), user.sub, reason);
  }
}
