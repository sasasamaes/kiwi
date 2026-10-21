// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DebtsService } from './debts.service';

@ApiTags('Debts')
@Controller('debts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get('drivers')
  @ApiOperation({ summary: 'Repartidores para aportes (admin)' })
  async drivers() {
    return this.debtsService.drivers();
  }

  @Get()
  @ApiOperation({ summary: 'Deudas con su resumen (admin)' })
  async list() {
    return this.debtsService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Crear una deuda (admin)' })
  async create(
    @Body()
    body: {
      title: string;
      description?: string;
      totalAmount: number;
      monthlyAmount: number;
      downPayment?: number;
      startDate: string;
      termMonths?: number;
    },
  ) {
    return this.debtsService.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de deuda con pagos y aportes (admin)' })
  async detail(@Param('id') id: string) {
    return this.debtsService.detail(id);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Registrar cuota, aporte o extra (admin)' })
  async addPayment(
    @Param('id') id: string,
    @Body()
    body: { amount: number; kind?: string; driverId?: string; note?: string; paidAt?: string },
    @CurrentUser() user: any,
  ) {
    return this.debtsService.addPayment(id, body, user?.sub);
  }

  @Delete(':id/payments/:paymentId')
  @ApiOperation({ summary: 'Anular un pago mal registrado (admin)' })
  async removePayment(@Param('id') id: string, @Param('paymentId') paymentId: string) {
    return this.debtsService.removePayment(id, paymentId);
  }
}
