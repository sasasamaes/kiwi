// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CoverageService } from './coverage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Coverage')
@Controller('coverage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class CoverageController {
  constructor(private readonly coverageService: CoverageService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Demanda por ciudad para decidir dónde abrir (admin)' })
  async summary() {
    return this.coverageService.summary();
  }

  @Post('notify')
  @ApiOperation({ summary: 'Avisar por correo a los interesados de una ciudad (admin)' })
  async notify(@Body() body: { city?: string }, @CurrentUser() user: any) {
    return this.coverageService.notifyCity(body?.city ?? '', user?.sub ?? user?.id);
  }
}
