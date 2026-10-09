// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Put, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { AdsService } from '../ads/ads.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Merchants')
@Controller('merchants')
export class MerchantsController {
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly adsService: AdsService,
  ) {}

  // OJO orden: esta ruta estática debe declararse ANTES de GET ':id'.
  // Express matchea por orden de registro y ':id' (solo admin) se tragaría
  // 'discover' devolviendo 401 a invitados (fue el 401 en prod).
  @Public()
  @Get('discover')
  @ApiOperation({ summary: 'Feed público de comercios (sponsored primero, por ciudad)' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'lng', required: false })
  @ApiQuery({ name: 'category', required: false })
  async discover(
    @Query('city') city?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('category') category?: string,
  ) {
    // Ubicación del cliente (opcional): ordena por cercanía. Sin coords o
    // inválidas se ignora y ordena por rating — nunca 400 por esto.
    const flat = lat != null ? Number(lat) : NaN;
    const flng = lng != null ? Number(lng) : NaN;
    const valid =
      Number.isFinite(flat) &&
      Number.isFinite(flng) &&
      Math.abs(flat) <= 90 &&
      Math.abs(flng) <= 180;
    return this.adsService.discover(
      city || 'nicoya',
      q,
      take ? Number(take) : 20,
      valid ? flat : undefined,
      valid ? flng : undefined,
      category,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current merchant profile' })
  async getMe(@CurrentUser() user: any) {
    return this.merchantsService.findByUserId(user.sub);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update merchant profile' })
  async updateMe(@CurrentUser() user: any, @Body() updateData: any) {
    return this.merchantsService.updateProfile(user.sub, updateData);
  }

  @Get('me/favorites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get favorite drivers' })
  async getFavorites(@CurrentUser() user: any) {
    const merchant = await this.merchantsService.findByUserId(user.sub);
    return this.merchantsService.getFavoriteDrivers(merchant.id);
  }

  @Post('me/favorites/:driverId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add favorite driver' })
  async addFavorite(@CurrentUser() user: any, @Param('driverId') driverId: string) {
    const merchant = await this.merchantsService.findByUserId(user.sub);
    return this.merchantsService.addFavoriteDriver(merchant.id, driverId);
  }

  @Delete('me/favorites/:driverId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove favorite driver' })
  async removeFavorite(@CurrentUser() user: any, @Param('driverId') driverId: string) {
    const merchant = await this.merchantsService.findByUserId(user.sub);
    return this.merchantsService.removeFavoriteDriver(merchant.id, driverId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get merchant by ID' })
  async getMerchant(@Param('id') id: string) {
    return this.merchantsService.findById(id);
  }

  @Put(':id/visibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mostrar/ocultar comercio en la lista pública (test)' })
  async setVisibility(@Param('id') id: string, @Body() body: { listed: boolean }) {
    return this.merchantsService.setListed(id, body?.listed !== false);
  }
}
