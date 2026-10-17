// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Param,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.sub);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(@CurrentUser() user: any, @Body() updateData: any) {
    return this.usersService.updateProfile(user.sub, updateData);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  async getUser(@Param('id') id: string, @CurrentUser() user: any) {
    // Users expose email/phone: only self or admin may read another profile.
    const requesterId = user?.sub ?? user?.id;
    if (id !== requesterId && user?.role !== 'admin') {
      throw new ForbiddenException('No tienes permiso para ver este perfil');
    }
    return this.usersService.findById(id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List users (admin)' })
  async listUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.usersService.listUsers({
      role,
      status,
      search,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate/deactivate a user (admin)' })
  async setStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.setStatus(id, status, user?.sub ?? user?.id);
  }

  @Put(':id/password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a user password (admin support)' })
  async setPassword(@Param('id') id: string, @Body('password') password: string) {
    return this.usersService.setPassword(id, password);
  }

  @Put(':id/unlock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear login throttle for a user (admin support)' })
  async unlockLogin(@Param('id') id: string) {
    return this.usersService.unlockLogin(id);
  }

  @Put(':id/merchant-location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a merchant pickup GPS point (admin)' })
  async setMerchantLocation(
    @Param('id') id: string,
    @Body() body: { latitude?: number | null; longitude?: number | null },
  ) {
    return this.usersService.setMerchantLocation(id, body ?? {});
  }

  @Put(':id/merchant-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update merchant basic info (admin support setup)' })
  async updateMerchantProfile(
    @Param('id') id: string,
    @Body()
    body: {
      businessName?: string;
      address?: string | null;
      description?: string | null;
      logoUrl?: string | null;
      phone?: string;
    },
  ) {
    return this.usersService.updateMerchantProfileAdmin(id, body ?? {});
  }
}
