import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GeocodingService } from './geocoding.service';

@ApiTags('Geocoding')
@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search for addresses' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default: 5)' })
  @ApiQuery({ name: 'country', required: false, description: 'Country code filter' })
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('country') country?: string,
  ) {
    const maxResults = limit ? parseInt(limit) : 5;
    
    if (country === 'cr') {
      return this.geocodingService.searchCostaRica(query, maxResults);
    }
    
    return this.geocodingService.search(query, maxResults);
  }

  @Get('search/nicoya')
  @ApiOperation({ summary: 'Search for addresses in Nicoya' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default: 5)' })
  async searchNicoya(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    const maxResults = limit ? parseInt(limit) : 5;
    return this.geocodingService.searchNicoya(query, maxResults);
  }

  @Get('reverse')
  @ApiOperation({ summary: 'Reverse geocode coordinates to address' })
  @ApiQuery({ name: 'lat', required: true, description: 'Latitude' })
  @ApiQuery({ name: 'lng', required: true, description: 'Longitude' })
  async reverseGeocode(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return { error: 'Invalid coordinates' };
    }
    
    return this.geocodingService.reverseGeocode(latitude, longitude);
  }

  @Get('distance')
  @ApiOperation({ summary: 'Calculate distance between two points' })
  @ApiQuery({ name: 'lat1', required: true })
  @ApiQuery({ name: 'lng1', required: true })
  @ApiQuery({ name: 'lat2', required: true })
  @ApiQuery({ name: 'lng2', required: true })
  async calculateDistance(
    @Query('lat1') lat1: string,
    @Query('lng1') lng1: string,
    @Query('lat2') lat2: string,
    @Query('lng2') lng2: string,
  ) {
    const distance = this.geocodingService.calculateDistance(
      parseFloat(lat1),
      parseFloat(lng1),
      parseFloat(lat2),
      parseFloat(lng2),
    );
    
    return {
      distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
      unit: 'km',
    };
  }
}
