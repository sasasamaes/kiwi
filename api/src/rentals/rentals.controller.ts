// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RentalsService } from './rentals.service';

@ApiTags('Rentals')
@Controller('rentals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Si la prueba de alquiler está activa (admin)' })
  async status() {
    return this.rentalsService.status();
  }

  @Get('contracts')
  @ApiOperation({ summary: 'Contratos de alquiler (admin)' })
  async contracts() {
    return this.rentalsService.contracts();
  }

  @Post('contracts')
  @ApiOperation({ summary: 'Crear contrato de alquiler (admin)' })
  async create(
    @Body()
    body: {
      driverId: string;
      debtId?: string;
      weeklyPrice: number;
      deposit?: number;
      startDate: string;
      notes?: string;
    },
  ) {
    return this.rentalsService.create(body);
  }

  @Get('contracts/:id')
  @ApiOperation({ summary: 'Detalle de contrato con pagos (admin)' })
  async detail(@Param('id') id: string) {
    return this.rentalsService.detail(id);
  }

  @Post('contracts/:id/finish')
  @ApiOperation({ summary: 'Cerrar contrato como finalizado (admin)' })
  async finish(@Param('id') id: string) {
    return this.rentalsService.close(id, 'finished');
  }

  @Post('contracts/:id/cancel')
  @ApiOperation({ summary: 'Cerrar contrato como cancelado (admin)' })
  async cancel(@Param('id') id: string) {
    return this.rentalsService.close(id, 'cancelled');
  }

  @Post('contracts/:id/payments')
  @ApiOperation({ summary: 'Registrar pago de alquiler (admin)' })
  async addPayment(
    @Param('id') id: string,
    @Body() body: { amount: number; paidAt?: string; note?: string },
    @CurrentUser() user: any,
  ) {
    return this.rentalsService.addPayment(id, body, user?.sub);
  }

  @Delete('contracts/:id/payments/:paymentId')
  @ApiOperation({ summary: 'Anular un pago de alquiler (admin)' })
  async removePayment(@Param('id') id: string, @Param('paymentId') paymentId: string) {
    return this.rentalsService.removePayment(id, paymentId);
  }
}
