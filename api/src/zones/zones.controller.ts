// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import { CreateZoneDto, UpdateZoneDto } from './dto/zone.dto';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('DeliveryZones')
@Controller('delivery-zones')
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  /** Zonas activas (para los selectores de las apps). Público. */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Zonas de entrega activas' })
  list() {
    return this.zones.list();
  }

  /** Resolver zona+precio para un punto (polígono más específico, o referencia). */
  @Public()
  @Get('resolve')
  @ApiOperation({ summary: 'Zona/precio de envío para una coordenada' })
  async resolve(@Query('lat') lat: string, @Query('lng') lng: string) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Coordenadas inválidas');
    }
    const r = await this.zones.resolvePriceAt(latitude, longitude);
    if (!r) return { zone: null, source: null };
    return {
      zone: { id: r.zone.id, label: r.zone.label, price: r.zone.price },
      source: r.source,
    };
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Todas las zonas (incluye inactivas) — admin' })
  listAll() {
    return this.zones.listAll();
  }

  @Get('price-model')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modelo precio-vs-distancia para abrir zonas — admin' })
  priceModel() {
    return this.zones.priceModel();
  }

  @Get('suggest-price')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Precio sugerido para una zona nueva — admin' })
  suggestPrice(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.zones.suggestPrice(Number(lat), Number(lng));
  }

  @Get('cost-model')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Costo real por km + fórmulas del cobro inteligente — admin' })
  costModel() {
    return this.zones.costModel();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear zona — admin' })
  create(@Body() dto: CreateZoneDto) {
    return this.zones.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar zona — admin' })
  update(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.zones.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar zona (soft delete) — admin' })
  deactivate(@Param('id') id: string) {
    return this.zones.deactivate(id);
  }
}
