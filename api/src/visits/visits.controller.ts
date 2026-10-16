// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Visits')
@Controller('visits')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar visita de venta (admin)' })
  async create(@Body() dto: CreateVisitDto, @CurrentUser() user: any) {
    return this.visitsService.create(dto, user?.sub ?? user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar visitas (admin)' })
  async list(
    @Query('outcome') outcome?: string,
    @Query('search') search?: string,
    @Query('followUp') followUp?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.visitsService.list({
      outcome,
      search,
      followUp,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar visita (admin)' })
  async update(@Param('id') id: string, @Body() dto: CreateVisitDto) {
    return this.visitsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar visita (admin)' })
  async remove(@Param('id') id: string) {
    return this.visitsService.remove(id);
  }
}
