// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { DriverMarketplaceService } from '../payments/marketplace/driver-marketplace.service';
import { ImageUploadService } from '../menu/image-upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@ApiTags('Drivers')
@Controller('drivers')
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly imageUpload: ImageUploadService,
    private readonly marketplace: DriverMarketplaceService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current driver profile' })
  async getMe(@CurrentUser() user: any) {
    return this.driversService.findByUserId(user.sub);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update driver profile' })
  async updateMe(@CurrentUser() user: any, @Body() updateData: UpdateDriverProfileDto) {
    return this.driversService.updateProfile(user.sub, updateData);
  }

  @Put('me/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update driver status (online/offline)' })
  async updateStatus(@CurrentUser() user: any, @Body('status') status: string) {
    return this.driversService.updateStatus(user.sub, status);
  }

  @Put('me/location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update driver location' })
  async updateLocation(@CurrentUser() user: any, @Body() data: UpdateLocationDto) {
    return this.driversService.updateLocation(user.sub, data.lat, data.lng, data.orderId);
  }

  /**
   * Foto de perfil del repartidor. Multipart (Multer memoryStorage), misma
   * validación estricta que el resto de imágenes (magic bytes, 5MB). La URL
   * https resultante se guarda en el perfil y aparece en la app del comercio
   * y en el link de seguimiento.
   */
  @Post('me/photo')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @UseInterceptors(
    FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Upload driver profile photo (multipart/form-data)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  async uploadPhoto(@CurrentUser() user: any, @UploadedFile() file: any) {
    const { url } = await this.imageUpload.uploadDriverPhoto(file);
    await this.driversService.updateProfile(user.sub, { photoUrl: url });
    return { url };
  }

  /** Estado de la subida para la UI (mostrar el picker una vez configurado). */
  @Get('me/photo-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Whether driver photo upload is configured' })
  async photoStatus() {
    return { enabled: this.imageUpload.isConfigured() };
  }

  @Post('me/marketplace/onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear cuenta conectada Onvo y obtener link de onboarding' })
  async startOnboarding(@CurrentUser() user: any) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.marketplace.startOnboarding(driver.id);
  }

  @Get('me/marketplace/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar estado de la cuenta conectada Onvo' })
  async marketplaceStatus(@CurrentUser() user: any) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.marketplace.refreshStatus(driver.id);
  }

  @Post('me/marketplace/onboarding-link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerar link de onboarding Onvo' })
  async regenerateOnboardingLink(@CurrentUser() user: any) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.marketplace.regenerateLink(driver.id);
  }

  @Get('me/marketplace/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cobros liquidados al repartidor (cuenta conectada Onvo)' })
  async marketplacePayments(@CurrentUser() user: any) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.marketplace.sellerIntents(driver.id);
  }

  @Get(':id/location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get driver location' })
  async getLocation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.driversService.getLocationForUser(id, user);
  }

  @Get('me/earnings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get driver earnings' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['today', 'yesterday', 'week', 'month', 'all', 'custom'],
  })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD (solo period=custom)' })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'YYYY-MM-DD inclusivo (solo period=custom)',
  })
  async getEarnings(
    @CurrentUser() user: any,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.driversService.getEarnings(user.sub, period || 'all', from, to);
  }

  @Get('me/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historial de pedidos del repartidor (todos los estados)' })
  async getMyOrders(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.driversService.driverOrders(user.sub, {
      status,
      take: take != null ? Number(take) : undefined,
      skip: skip != null ? Number(skip) : undefined,
    });
  }

  @Get('me/ranking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ranking interno de repartidores por velocidad (avg assigned→delivered)',
  })
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month', 'all'] })
  async getRanking(@Query('period') period?: string) {
    return this.driversService.getRanking(period || 'week');
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Repartidores para filtros del admin (id + nombre)' })
  async adminList() {
    return this.driversService.adminList();
  }

  @Get('me/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get driver schedule' })
  async getSchedule(@CurrentUser() user: any) {
    return this.driversService.getSchedules(user.sub);
  }

  @Put('me/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update driver schedule' })
  async updateSchedule(@CurrentUser() user: any, @Body() body: UpdateScheduleDto) {
    return this.driversService.updateSchedule(user.sub, body.schedules);
  }

  @Get('live')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Repartidores con GPS reciente (mapa vivo admin)' })
  async getLive() {
    return this.driversService.getLiveDrivers();
  }

  @Get('available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available drivers' })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'lng', required: false })
  async getAvailable(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('testOnly') testOnly?: string,
  ) {
    const latitude = lat ? parseFloat(lat) : undefined;
    const longitude = lng ? parseFloat(lng) : undefined;
    return this.driversService.getAvailableDrivers(latitude, longitude, {
      testOnly: testOnly === 'true',
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get driver by ID' })
  async getDriver(@Param('id') id: string) {
    return this.driversService.findById(id);
  }
}
