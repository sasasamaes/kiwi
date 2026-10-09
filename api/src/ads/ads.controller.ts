// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdsService } from './ads.service';
import { CreateCampaignDto, CreateBroadcastDto, RecordAdEventDto } from './dto';

@ApiTags('Ads')
@Controller()
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Public()
  @Get('merchants/discover')
  @ApiOperation({ summary: 'Feed público de comercios (sponsored primero, segmentado por ciudad)' })
  async discover(
    @Query('city') city?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
  ) {
    return this.ads.discover(city || 'nicoya', q, take ? Number(take) : 20);
  }

  @Public()
  @Get('ads/banners')
  @ApiOperation({ summary: 'Banners activos para el carrusel home' })
  async banners(@Query('city') city?: string) {
    return this.ads.banners(city || 'nicoya');
  }

  @Public()
  @Post('ads/events')
  @ApiOperation({ summary: 'Registra impresión/click (métrica para el comercio)' })
  async recordEvent(@Body() dto: RecordAdEventDto) {
    return this.ads.recordEvent(dto);
  }

  @Get('ads/my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mis campañas (comercio)' })
  async myCampaigns(@CurrentUser() user: any) {
    return this.ads.myCampaigns(user.sub);
  }

  @Post('ads/campaigns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear campaña spotlight|banner (queda pending, se cobra al aprobar)' })
  async createCampaign(@CurrentUser() user: any, @Body() dto: CreateCampaignDto) {
    return this.ads.createCampaign(user.sub, dto);
  }

  @Get('ads/admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar campañas (admin)' })
  async adminList(@Query('status') status?: string, @Query('city') city?: string) {
    return this.ads.adminList(status, city);
  }

  @Put('ads/campaigns/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aprobar (cobra) o rechazar campaña' })
  async reviewCampaign(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { approve: boolean },
  ) {
    return this.ads.reviewCampaign(user.sub, id, body.approve !== false);
  }

  @Put('ads/campaigns/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pausar/activar/finalizar campaña' })
  async setStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { status: 'paused' | 'active' | 'ended' },
  ) {
    return this.ads.setCampaignStatus(user.sub, id, body.status);
  }

  @Get('offers/my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mis ofertas push (comercio)' })
  async myBroadcasts(@CurrentUser() user: any) {
    return this.ads.myBroadcasts(user.sub);
  }

  @Post('offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear oferta push (queda pending)' })
  async createBroadcast(@CurrentUser() user: any, @Body() dto: CreateBroadcastDto) {
    return this.ads.createBroadcast(user.sub, dto);
  }

  @Put('offers/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aprobar o rechazar oferta' })
  async reviewBroadcast(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { approve: boolean },
  ) {
    return this.ads.reviewBroadcast(user.sub, id, body.approve !== false);
  }

  @Post('offers/:id/send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enviar push segmentado por ciudad/zona (cobra tarifa push)' })
  async sendBroadcast(@Param('id') id: string) {
    return this.ads.sendBroadcast(id);
  }
}
