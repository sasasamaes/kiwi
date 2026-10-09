// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CustomersService } from './customers.service';

@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mi perfil de cliente' })
  async me(@CurrentUser() user: any) {
    return this.customers.me(user.sub);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil (ciudad, dirección, zona)' })
  async updateMe(@CurrentUser() user: any, @Body() body: any) {
    return this.customers.updateMe(user.sub, body);
  }
}
