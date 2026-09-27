// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Merchants')
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

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
}
