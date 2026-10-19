// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('payments')
  @ApiOperation({ summary: 'Métodos de pago habilitados (público)' })
  async paymentAvailability() {
    return this.settingsService.getPaymentAvailability();
  }

  @Public()
  @Get('driver-commission')
  @ApiOperation({ summary: '% comisión del repartidor (público, espejo de pricing)' })
  async driverCommission() {
    return { pct: await this.settingsService.getDriverCommissionPct() };
  }

  @Public()
  @Get('platform-fees')
  @ApiOperation({ summary: 'Tasas del cargo por servicio (público, espejo de pricing)' })
  async platformFees() {
    const [standardPct, homeCookPct] = await Promise.all([
      this.settingsService.getDriverCommissionPct(),
      this.settingsService.getHomeCookCommissionPct(),
    ]);
    return { standardPct, homeCookPct };
  }

  @Public()
  @Get('features')
  @ApiOperation({ summary: 'Feature flags públicos (público)' })
  async features() {
    const [encomiendaEnabled, mercaditoEnabled, bannersEnabled, clientAppEnabled] =
      await Promise.all([
        this.settingsService.getEncomiendaEnabled(),
        this.settingsService.getMercaditoEnabled(),
        this.settingsService.getBannersEnabled(),
        this.settingsService.getClientAppEnabled(),
      ]);
    return { encomiendaEnabled, mercaditoEnabled, bannersEnabled, clientAppEnabled };
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Todos los ajustes (admin)' })
  async getAll() {
    return this.settingsService.getAll();
  }
  @Put('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Guardar ajustes (admin)' })
  async saveAll(@Body() body: any) {
    return this.settingsService.saveAll(body ?? {});
  }

  @Get('scenario-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Historial mensual de escenarios fijados (reporte Real vs Proyección)',
  })
  async listScenarioHistory() {
    return this.settingsService.listScenarioSnapshots();
  }

  @Put('scenario-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fijar (o re-fijar) el escenario proyectado de un mes YYYY-MM',
  })
  async upsertScenarioSnapshot(@Body() body: any) {
    return this.settingsService.upsertScenarioSnapshot(body ?? {});
  }
}
