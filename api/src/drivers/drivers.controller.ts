import { Controller, Get, Put, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Drivers')
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

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
  async updateMe(@CurrentUser() user: any, @Body() updateData: any) {
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
  async updateLocation(
    @CurrentUser() user: any,
    @Body() data: { lat: number; lng: number; orderId?: string },
  ) {
    return this.driversService.updateLocation(user.sub, data.lat, data.lng, data.orderId);
  }

  @Get(':id/location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get driver location' })
  async getLocation(@Param('id') id: string) {
    return this.driversService.getLocation(id);
  }

  @Get('me/earnings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get driver earnings' })
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month', 'all'] })
  async getEarnings(
    @CurrentUser() user: any,
    @Query('period') period?: string,
  ) {
    return this.driversService.getEarnings(user.sub, period || 'all');
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
  async updateSchedule(@CurrentUser() user: any, @Body() schedules: any[]) {
    return this.driversService.updateSchedule(user.sub, schedules);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available drivers' })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'lng', required: false })
  async getAvailable(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const latitude = lat ? parseFloat(lat) : undefined;
    const longitude = lng ? parseFloat(lng) : undefined;
    return this.driversService.getAvailableDrivers(latitude, longitude);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get driver by ID' })
  async getDriver(@Param('id') id: string) {
    return this.driversService.findById(id);
  }
}
