// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { UpsertReferralDto } from './dto/upsert-referral.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear código de referido (admin)' })
  async create(@Body() dto: UpsertReferralDto, @CurrentUser() user: any) {
    return this.referralsService.create(dto, user?.sub ?? user?.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar códigos con usos (admin)' })
  async list() {
    return this.referralsService.list();
  }

  /** Público: el registro muestra la oferta de su app al tipear el código. */
  @Public()
  @Get('validate')
  @ApiOperation({ summary: 'Validar un código para un rol (público)' })
  async validate(@Query('code') code?: string, @Query('role') role?: string) {
    return this.referralsService.validateForRole(code ?? '', role ?? '');
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar ofertas de un código (admin)' })
  async update(@Param('id') id: string, @Body() dto: UpsertReferralDto) {
    return this.referralsService.update(id, dto);
  }

  @Put(':id/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activar/pausar un código (admin)' })
  async setActive(@Param('id') id: string, @Body('active') active: boolean) {
    return this.referralsService.setActive(id, active !== false);
  }
}
