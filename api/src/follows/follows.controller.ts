// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Follows')
@Controller('follows')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
@ApiBearerAuth()
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Get()
  @ApiOperation({ summary: 'Comercios que sigo' })
  async mine(@CurrentUser() user: any) {
    return this.follows.myFollows(user.sub);
  }

  @Post(':merchantId')
  @ApiOperation({ summary: 'Seguir un comercio (avisos de ventas y stock)' })
  async follow(@CurrentUser() user: any, @Param('merchantId') merchantId: string) {
    return this.follows.follow(user.sub, merchantId);
  }

  @Delete(':merchantId')
  @ApiOperation({ summary: 'Dejar de seguir un comercio' })
  async unfollow(@CurrentUser() user: any, @Param('merchantId') merchantId: string) {
    return this.follows.unfollow(user.sub, merchantId);
  }
}
