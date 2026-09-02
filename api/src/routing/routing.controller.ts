import { Controller, Post, Get, Put, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { RoutingService } from './routing.service';
import { TrafficService } from './traffic.service';
import { TrafficAlertsService } from './traffic-alerts.service';
import { TrafficHistoryService } from './traffic-history.service';
import { RouteSuggestionsService } from './route-suggestions.service';
import { TrafficPredictionsService } from './traffic-predictions.service';

@ApiTags('Routing')
@Controller('routing')
export class RoutingController {
  constructor(
    private readonly routingService: RoutingService,
    private readonly trafficService: TrafficService,
    private readonly trafficAlertsService: TrafficAlertsService,
    private readonly trafficHistoryService: TrafficHistoryService,
    private readonly routeSuggestionsService: RouteSuggestionsService,
    private readonly trafficPredictionsService: TrafficPredictionsService,
  ) {}

  @Post('optimize')
  @ApiOperation({ summary: 'Optimize route for multiple deliveries' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        startLocation: {
          type: 'object',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' },
          },
        },
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              orderId: { type: 'string' },
              pickup: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
              },
              delivery: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
              },
              pickupAddress: { type: 'string' },
              deliveryAddress: { type: 'string' },
              merchantName: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async optimizeRoute(
    @Body() body: {
      startLocation: { lat: number; lng: number };
      orders: Array<{
        orderId: string;
        pickup: { lat: number; lng: number };
        delivery: { lat: number; lng: number };
        pickupAddress: string;
        deliveryAddress: string;
        merchantName: string;
      }>;
    },
  ) {
    return this.routingService.optimizeRoute(body.startLocation, body.orders);
  }

  @Get('route')
  @ApiOperation({ summary: 'Calculate route between two points' })
  async calculateRoute(
    @Query('originLat') originLat: string,
    @Query('originLng') originLng: string,
    @Query('destLat') destLat: string,
    @Query('destLng') destLng: string,
  ) {
    return this.routingService.calculateRoute(
      { lat: parseFloat(originLat), lng: parseFloat(originLng) },
      { lat: parseFloat(destLat), lng: parseFloat(destLng) },
    );
  }

  @Post('distance-matrix')
  @ApiOperation({ summary: 'Calculate distance matrix between multiple points' })
  async calculateDistanceMatrix(
    @Body() body: { locations: Array<{ lat: number; lng: number }> },
  ) {
    return this.routingService.calculateDistanceMatrix(body.locations);
  }

  // ============================================
  // 🚦 TRAFFIC ENDPOINTS
  // ============================================

  @Get('traffic')
  @ApiOperation({ summary: 'Get current traffic conditions' })
  async getTrafficConditions(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const latNum = lat ? parseFloat(lat) : undefined;
    const lngNum = lng ? parseFloat(lng) : undefined;
    return this.trafficService.getTrafficConditions(latNum, lngNum);
  }

  @Get('traffic/eta')
  @ApiOperation({ summary: 'Get traffic-adjusted ETA' })
  async getTrafficAdjustedETA(
    @Query('duration') duration: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const baseDuration = parseFloat(duration);
    const latNum = lat ? parseFloat(lat) : undefined;
    const lngNum = lng ? parseFloat(lng) : undefined;
    return this.trafficService.getTrafficAdjustedETA(baseDuration, latNum, lngNum);
  }

  @Get('traffic/delivery-estimate')
  @ApiOperation({ summary: 'Get delivery estimate with traffic' })
  async getDeliveryEstimate(
    @Query('pickupLat') pickupLat: string,
    @Query('pickupLng') pickupLng: string,
    @Query('deliveryLat') deliveryLat: string,
    @Query('deliveryLng') deliveryLng: string,
    @Query('distance') distance: string,
  ) {
    return this.trafficService.getDeliveryEstimate(
      parseFloat(pickupLat),
      parseFloat(pickupLng),
      parseFloat(deliveryLat),
      parseFloat(deliveryLng),
      parseFloat(distance),
    );
  }

  @Post('traffic/compare-routes')
  @ApiOperation({ summary: 'Compare traffic on multiple routes' })
  async compareRouteTraffic(
    @Body() body: {
      routes: Array<{
        distance: number;
        duration: number;
        startLat: number;
        startLng: number;
        endLat: number;
        endLng: number;
      }>;
    },
  ) {
    return this.trafficService.compareRouteTraffic(body.routes);
  }

  @Post('traffic/updates')
  @ApiOperation({ summary: 'Get real-time traffic updates for route points' })
  async getTrafficUpdates(
    @Body() body: {
      points: Array<{ lat: number; lng: number }>;
    },
  ) {
    return this.trafficService.getTrafficUpdates(body.points);
  }

  // ============================================
  // 🚨 TRAFFIC ALERTS ENDPOINTS
  // ============================================

  @Get('alerts')
  @ApiOperation({ summary: 'Get active traffic alerts for driver' })
  async getDriverAlerts(
    @Query('driverId') driverId: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const latNum = lat ? parseFloat(lat) : undefined;
    const lngNum = lng ? parseFloat(lng) : undefined;
    return this.trafficAlertsService.getActiveAlertsForDriver(driverId, latNum, lngNum);
  }

  @Get('alerts/system')
  @ApiOperation({ summary: 'Get all system alerts' })
  async getSystemAlerts() {
    return this.trafficAlertsService.getSystemAlerts();
  }

  @Post('alerts')
  @ApiOperation({ summary: 'Create manual traffic alert (admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['congestion', 'accident', 'road_closed', 'weather', 'event', 'alternative_route'] },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        title: { type: 'string' },
        message: { type: 'string' },
        location: {
          type: 'object',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' },
            address: { type: 'string' },
          },
        },
        radius: { type: 'number' },
        durationMinutes: { type: 'number' },
        alternativeRoute: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            estimatedTimeSaved: { type: 'number' },
          },
        },
      },
    },
  })
  async createAlert(
    @Body() body: {
      type: 'congestion' | 'accident' | 'road_closed' | 'weather' | 'event' | 'alternative_route';
      severity: 'low' | 'medium' | 'high' | 'critical';
      title: string;
      message: string;
      location: { lat: number; lng: number; address: string };
      radius: number;
      durationMinutes: number;
      alternativeRoute?: { description: string; estimatedTimeSaved: number };
    },
  ) {
    return this.trafficAlertsService.createManualAlert(body);
  }

  @Put('alerts/:alertId/dismiss')
  @ApiOperation({ summary: 'Dismiss an alert for driver' })
  async dismissAlert(
    @Param('alertId') alertId: string,
    @Body() body: { driverId: string },
  ) {
    await this.trafficAlertsService.dismissAlert(body.driverId, alertId);
    return { success: true };
  }

  @Put('alerts/:alertId/read')
  @ApiOperation({ summary: 'Mark alert as read' })
  async markAlertAsRead(
    @Param('alertId') alertId: string,
    @Body() body: { driverId: string },
  ) {
    await this.trafficAlertsService.markAlertAsRead(body.driverId, alertId);
    return { success: true };
  }

  @Get('alerts/stats')
  @ApiOperation({ summary: 'Get alert statistics' })
  async getAlertStats() {
    return this.trafficAlertsService.getAlertStats();
  }

  @Post('alerts/alternative-route')
  @ApiOperation({ summary: 'Get alternative route suggestion' })
  async getAlternativeRoute(
    @Body() body: {
      originLat: number;
      originLng: number;
      destLat: number;
      destLng: number;
    },
  ) {
    return this.trafficAlertsService.getAlternativeRoute(
      body.originLat,
      body.originLng,
      body.destLat,
      body.destLng,
    );
  }

  // ============================================
  // 📊 TRAFFIC HISTORY ENDPOINTS
  // ============================================

  @Get('history')
  @ApiOperation({ summary: 'Get traffic history' })
  async getTrafficHistory(
    @Query('zone') zone?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const limitNum = limit ? parseInt(limit) : 100;
    return this.trafficHistoryService.getTrafficHistory(zone, start, end, limitNum);
  }

  @Get('history/patterns')
  @ApiOperation({ summary: 'Get traffic patterns by hour and day' })
  async getTrafficPatterns(
    @Query('zone') zone?: string,
    @Query('daysBack') daysBack?: string,
  ) {
    const days = daysBack ? parseInt(daysBack) : 30;
    return this.trafficHistoryService.getTrafficPatterns(zone, days);
  }

  @Get('history/trends')
  @ApiOperation({ summary: 'Get traffic trends' })
  async getTrafficTrends(
    @Query('zone') zone?: string,
    @Query('period') period?: string,
  ) {
    const periodType = (period as 'day' | 'week' | 'month') || 'week';
    return this.trafficHistoryService.getTrafficTrends(zone, periodType);
  }

  @Get('history/heatmap')
  @ApiOperation({ summary: 'Get traffic heatmap data' })
  async getTrafficHeatmap(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.trafficHistoryService.getTrafficHeatmap(start, end);
  }

  @Get('history/merchant/:merchantId')
  @ApiOperation({ summary: 'Get merchant traffic report' })
  async getMerchantTrafficReport(
    @Param('merchantId') merchantId: string,
    @Query('period') period?: string,
  ) {
    const periodType = (period as 'day' | 'week' | 'month') || 'week';
    return this.trafficHistoryService.getMerchantTrafficReport(merchantId, periodType);
  }

  @Get('history/best-times')
  @ApiOperation({ summary: 'Get best times for deliveries' })
  async getBestDeliveryTimes(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('daysBack') daysBack?: string,
  ) {
    const days = daysBack ? parseInt(daysBack) : 30;
    return this.trafficHistoryService.getBestDeliveryTimes(parseFloat(lat), parseFloat(lng), days);
  }

  @Get('history/worst-times')
  @ApiOperation({ summary: 'Get worst times to avoid' })
  async getWorstDeliveryTimes(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('daysBack') daysBack?: string,
  ) {
    const days = daysBack ? parseInt(daysBack) : 30;
    return this.trafficHistoryService.getWorstDeliveryTimes(parseFloat(lat), parseFloat(lng), days);
  }

  // ============================================
  // 🗺️ ROUTE SUGGESTIONS ENDPOINTS
  // ============================================

  @Get('suggestions')
  @ApiOperation({ summary: 'Get route suggestions based on traffic' })
  async getRouteSuggestions(
    @Query('originLat') originLat: string,
    @Query('originLng') originLng: string,
    @Query('destLat') destLat: string,
    @Query('destLng') destLng: string,
    @Query('prioritizeSpeed') prioritizeSpeed?: string,
    @Query('vehicleType') vehicleType?: string,
  ) {
    return this.routeSuggestionsService.getRouteSuggestions(
      parseFloat(originLat),
      parseFloat(originLng),
      parseFloat(destLat),
      parseFloat(destLng),
      {
        prioritizeSpeed: prioritizeSpeed === 'true',
        vehicleType,
      },
    );
  }

  @Get('suggestions/quick')
  @ApiOperation({ summary: 'Get quick route suggestion' })
  async getQuickSuggestion(
    @Query('originLat') originLat: string,
    @Query('originLng') originLng: string,
    @Query('destLat') destLat: string,
    @Query('destLng') destLng: string,
  ) {
    return this.routeSuggestionsService.getQuickSuggestion(
      parseFloat(originLat),
      parseFloat(originLng),
      parseFloat(destLat),
      parseFloat(destLng),
    );
  }

  @Get('suggestions/etas')
  @ApiOperation({ summary: 'Get traffic-aware ETAs for multiple routes' })
  async getTrafficAwareETAs(
    @Query('originLat') originLat: string,
    @Query('originLng') originLng: string,
    @Query('destLat') destLat: string,
    @Query('destLng') destLng: string,
  ) {
    return this.routeSuggestionsService.getTrafficAwareETAs(
      parseFloat(originLat),
      parseFloat(originLng),
      parseFloat(destLat),
      parseFloat(destLng),
    );
  }

  @Get('suggestions/with-warnings')
  @ApiOperation({ summary: 'Get route with traffic warnings' })
  async getRouteWithWarnings(
    @Query('originLat') originLat: string,
    @Query('originLng') originLng: string,
    @Query('destLat') destLat: string,
    @Query('destLng') destLng: string,
  ) {
    return this.routeSuggestionsService.getRouteWithWarnings(
      parseFloat(originLat),
      parseFloat(originLng),
      parseFloat(destLat),
      parseFloat(destLng),
    );
  }

  @Post('suggestions/blocked')
  @ApiOperation({ summary: 'Get alternative for blocked route' })
  async getAlternativeForBlockedRoute(
    @Body() body: {
      originLat: number;
      originLng: number;
      destLat: number;
      destLng: number;
      blockedRouteId: string;
    },
  ) {
    return this.routeSuggestionsService.getAlternativeForBlockedRoute(
      body.originLat,
      body.originLng,
      body.destLat,
      body.destLng,
      body.blockedRouteId,
    );
  }

  // ============================================
  // 🔮 TRAFFIC PREDICTIONS ENDPOINTS
  // ============================================

  @Get('predictions')
  @ApiOperation({ summary: 'Get traffic prediction for specific time' })
  async getPrediction(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('time') time: string,
  ) {
    return this.trafficPredictionsService.getPrediction(
      parseFloat(lat),
      parseFloat(lng),
      new Date(time),
    );
  }

  @Get('predictions/hourly')
  @ApiOperation({ summary: 'Get hourly forecast for today' })
  async getHourlyForecast(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    return this.trafficPredictionsService.getHourlyForecast(
      parseFloat(lat),
      parseFloat(lng),
    );
  }

  @Get('predictions/daily')
  @ApiOperation({ summary: 'Get daily forecast for the week' })
  async getDailyForecast(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('days') days?: string,
  ) {
    const numDays = days ? parseInt(days) : 7;
    return this.trafficPredictionsService.getDailyForecast(
      parseFloat(lat),
      parseFloat(lng),
      numDays,
    );
  }

  @Get('predictions/best-times')
  @ApiOperation({ summary: 'Get best times for delivery based on predictions' })
  async getBestDeliveryTimes(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('days') days?: string,
  ) {
    const numDays = days ? parseInt(days) : 7;
    return this.trafficPredictionsService.getBestDeliveryTimes(
      parseFloat(lat),
      parseFloat(lng),
      numDays,
    );
  }

  @Get('predictions/trend')
  @ApiOperation({ summary: 'Get traffic trend analysis' })
  async getTrafficTrend(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('timeframe') timeframe?: string,
  ) {
    const tf = (timeframe as 'hour' | 'day' | 'week') || 'day';
    return this.trafficPredictionsService.getTrafficTrend(
      parseFloat(lat),
      parseFloat(lng),
      tf,
    );
  }

  @Get('predictions/accuracy')
  @ApiOperation({ summary: 'Get prediction accuracy metrics' })
  async getPredictionAccuracy() {
    return this.trafficPredictionsService.getPredictionAccuracy();
  }

  @Get('predictions/insights')
  @ApiOperation({ summary: 'Get traffic pattern insights' })
  async getPatternInsights(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    return this.trafficPredictionsService.getPatternInsights(
      parseFloat(lat),
      parseFloat(lng),
    );
  }
}
