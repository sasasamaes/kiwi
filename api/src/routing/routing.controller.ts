import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { RoutingService } from './routing.service';

@ApiTags('Routing')
@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

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
}
