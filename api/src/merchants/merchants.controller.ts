// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { AdsService } from '../ads/ads.service';
import { MarketplaceService } from '../payments/marketplace/marketplace.service';
import { ImageUploadService } from '../menu/image-upload.service';
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
    private readonly imageUpload: ImageUploadService,
    private readonly marketplace: MarketplaceService,
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

  @Put('me/visibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mostrar/ocultar mi comercio en la app cliente (modo prueba)' })
  async setOwnVisibility(@CurrentUser() user: any, @Body() body: { listed: boolean }) {
    const merchant = await this.merchantsService.findByUserId(user.sub);
    return this.merchantsService.setListed(merchant.id, body?.listed !== false);
  }

  @Get('me/followers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cuántos clientes me siguen (avisos)' })
  async followersCount(@CurrentUser() user: any) {
    const merchant = await this.merchantsService.findByUserId(user.sub);
    return this.merchantsService.followersCount(merchant.id);
  }

  @Post('me/announce')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Avisar a mis seguidores (venta por fecha o stock, máx 3/día)' })
  async announce(@CurrentUser() user: any, @Body() body: { title?: string; body?: string }) {
    return this.merchantsService.announceToFollowers(user.sub, body ?? {});
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

  @Put(':id/card-payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activar cobro con tarjeta/SINPE (tras KYC de Onvo)' })
  async setCardPayments(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.merchantsService.setCardPayments(id, body?.enabled === true);
  }

  @Put(':id/home-cook')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar/desmarcar como cocina casera (emprendedores)' })
  async setHomeCook(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.merchantsService.setHomeCook(id, body?.enabled === true);
  }

  /**
   * Logo del comercio (foto de perfil). Multipart (Multer memoryStorage),
   * misma validación estricta que el resto de imágenes (magic bytes, 5MB).
   * Se ve en la app cliente (lista y menú).
   */
  @Post('me/logo')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @UseInterceptors(
    FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Subir logo del comercio (multipart/form-data)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  async uploadLogo(@CurrentUser() user: any, @UploadedFile() file: any) {
    const { url } = await this.imageUpload.uploadMerchantLogo(file);
    await this.merchantsService.updateProfile(user.sub, { logoUrl: url });
    return { url };
  }

  /** Estado de la subida para la UI (mostrar el picker una vez configurado). */
  @Get('me/logo-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Whether merchant logo upload is configured' })
  async logoStatus() {
    return { enabled: this.imageUpload.isConfigured() };
  }

  @Post('me/marketplace/onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear cuenta conectada Onvo y obtener link de onboarding' })
  async startOnboarding(@CurrentUser() user: any) {
    const merchant = await this.merchantsService.findByUserId(user.sub);
    return this.marketplace.startOnboarding(merchant.id);
  }

  @Get('me/marketplace/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estado de onboarding Onvo del comercio' })
  async onboardingStatus(@CurrentUser() user: any) {
    const merchant = await this.merchantsService.findByUserId(user.sub);
    return this.marketplace.refreshStatus(merchant.id);
  }

  @Post('me/marketplace/onboarding-link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerar link de onboarding Onvo' })
  async onboardingLink(@CurrentUser() user: any) {
    const merchant = await this.merchantsService.findByUserId(user.sub);
    return this.marketplace.regenerateLink(merchant.id);
  }

  @Get('me/marketplace/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cobros liquidados al comercio (cuenta conectada Onvo)' })
  async marketplacePayments(@CurrentUser() user: any) {
    const merchant = await this.merchantsService.findByUserId(user.sub);
    return this.marketplace.sellerIntents(merchant.id);
  }
}
