// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsPeriod, AnalyticsQueryDto } from './dto/analytics-query.dto';
import { TTLCache } from './analytics-cache';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Agregados caros sobre orders: se cachean 45s por usuario+query.
   * /live y /summary quedan fuera (pulso vivo y delegación, respectivamente).
   */
  private readonly cache = new TTLCache();

  private key(endpoint: string, userId: string, query: AnalyticsQueryDto): string {
    return `analytics:${endpoint}:${userId}:${JSON.stringify(query ?? {})}`;
  }

  @Get('merchant')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get merchant analytics' })
  async getMerchantAnalytics(@Request() req, @Query() query: AnalyticsQueryDto) {
    const userId = req.user.sub ?? req.user.id;
    return this.cache.get(this.key('merchant', userId, query), () =>
      this.analyticsService.getMerchantAnalytics(userId, query),
    );
  }

  @Get('driver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get driver analytics' })
  async getDriverAnalytics(@Request() req, @Query() query: AnalyticsQueryDto) {
    const userId = req.user.sub ?? req.user.id;
    return this.cache.get(this.key('driver', userId, query), () =>
      this.analyticsService.getDriverAnalytics(userId, query),
    );
  }

  @Get('platform')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get platform analytics (admin only)' })
  async getPlatformAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.cache.get(this.key('platform', 'admin', query), () =>
      this.analyticsService.getPlatformAnalytics(query),
    );
  }

  @Get('live')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Live pulse: online drivers, open orders, today revenue (admin only)' })
  async getLivePulse() {
    return this.analyticsService.getLivePulse();
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get analytics summary' })
  async getSummary(@Request() req) {
    const role = req.user.role;
    const userId = req.user.sub ?? req.user.id;
    if (role === 'merchant') {
      return this.analyticsService.getMerchantAnalytics(userId, { period: AnalyticsPeriod.WEEK });
    } else if (role === 'driver') {
      return this.analyticsService.getDriverAnalytics(userId, { period: AnalyticsPeriod.WEEK });
    } else if (role === 'admin') {
      return this.analyticsService.getPlatformAnalytics({ period: AnalyticsPeriod.WEEK });
    }
    throw new ForbiddenException('Rol no autorizado');
  }
}
