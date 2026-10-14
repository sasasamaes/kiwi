// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GeocodingService } from './geocoding.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Geocoding')
// Público a propósito: el menú QR (apps/client) es anónimo y usa la búsqueda
// de direcciones en el checkout guest. Son lookups de solo lectura (Nominatim/OSRM).
@Public()
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
    const maxResults = Math.min(Math.max(parseInt(limit ?? '') || 5, 1), 20);

    if (country === 'cr') {
      return this.geocodingService.searchCostaRica(query, maxResults);
    }

    return this.geocodingService.search(query, maxResults);
  }

  @Get('search/nicoya')
  @ApiOperation({ summary: 'Search for addresses in Nicoya' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default: 5)' })
  async searchNicoya(@Query('q') query: string, @Query('limit') limit?: string) {
    const maxResults = Math.min(Math.max(parseInt(limit ?? '') || 5, 1), 20);
    return this.geocodingService.searchNicoya(query, maxResults);
  }

  @Get('resolve-link')
  @ApiOperation({ summary: 'Resolve a shared/shortened map link to coordinates' })
  @ApiQuery({
    name: 'url',
    required: true,
    description: 'Shared map URL (goo.gl, maps.app.goo.gl, google maps…)',
  })
  async resolveLink(@Query('url') url: string) {
    if (!url || typeof url !== 'string') {
      return { error: 'Missing url parameter' };
    }
    const result = await this.geocodingService.resolveMapLink(url);
    if (!result) {
      return { error: 'No se pudo abrir ese link. Pedí el link completo de Google Maps.' };
    }
    return result;
  }

  @Get('reverse')
  @ApiOperation({ summary: 'Reverse geocode coordinates to address' })
  @ApiQuery({ name: 'lat', required: true, description: 'Latitude' })
  @ApiQuery({ name: 'lng', required: true, description: 'Longitude' })
  async reverseGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return { error: 'Invalid coordinates' };
    }

    return this.geocodingService.reverseGeocode(latitude, longitude);
  }

  @Get('nearest-zone')
  @ApiOperation({
    summary:
      'Zona de referencia más cercana (GPS → zona → tarifa). referenceOnly hasta tener polígonos.',
  })
  @ApiQuery({ name: 'lat', required: true, description: 'Latitude (WGS84)' })
  @ApiQuery({ name: 'lng', required: true, description: 'Longitude (WGS84)' })
  async nearestZone(@Query('lat') lat: string, @Query('lng') lng: string) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return { error: 'Invalid coordinates' };
    }

    const match = this.geocodingService.nearestZone(latitude, longitude);
    if (!match) {
      return { error: 'No hay zonas con punto de referencia' };
    }
    return match;
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
    const coords = [lat1, lng1, lat2, lng2].map(Number);
    if (coords.some((n) => !Number.isFinite(n))) {
      throw new BadRequestException('Coordenadas inválidas');
    }
    const distance = this.geocodingService.calculateDistance(
      coords[0],
      coords[1],
      coords[2],
      coords[3],
    );

    return {
      distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
      unit: 'km',
    };
  }
}
