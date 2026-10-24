// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Post, Get, Delete, Body, Param, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { DeliveryLinksService } from './delivery-links.service';

@ApiTags('DeliveryLinks')
@Controller('delivery-links')
export class DeliveryLinksController {
  constructor(private readonly deliveryLinks: DeliveryLinksService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear link de reparto (el comercio elige barrio y paga el viaje)' })
  async create(
    @CurrentUser() user: any,
    @Body() body: { deliveryZone: string; paymentMethod: string },
  ) {
    return this.deliveryLinks.create(user.sub, body);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mis links de reparto (comercio)' })
  async mine(@CurrentUser() user: any) {
    return this.deliveryLinks.listMine(user.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revocar un link de reparto pendiente (comercio)' })
  async cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.deliveryLinks.cancel(user.sub, id);
  }

  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'Ver un link de reparto público (comercio, barrio, precio)' })
  async getPublic(@Param('token') token: string) {
    return this.deliveryLinks.getPublic(token);
  }

  @Public()
  @Post(':token/submit')
  @ApiOperation({ summary: 'Enviar datos del cliente y crear el pedido del link (sin auth)' })
  async submit(
    @Param('token') token: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const dto = idempotencyKey && !body?.idempotencyKey ? { ...body, idempotencyKey } : body;
    return this.deliveryLinks.submit(token, dto ?? {}, idempotencyKey);
  }
}
