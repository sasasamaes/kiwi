// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateRatingDto } from './dto/create-rating.dto';

@ApiTags('Ratings')
@Controller('ratings')
@ApiBearerAuth()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Rate the driver of a delivered order (merchant only)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateRatingDto) {
    return this.ratingsService.create(user.sub, dto);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the rating of an order (if any) and whether the caller can rate' })
  async findByOrder(@Param('orderId') orderId: string, @CurrentUser() user: any) {
    return this.ratingsService.findByOrder(orderId, user.sub);
  }

  @Public()
  @Get('public/:orderId')
  @ApiOperation({ summary: 'Public rating lookup for the order link (guests)' })
  async findByOrderPublic(@Param('orderId') orderId: string) {
    return this.ratingsService.findByOrderPublic(orderId);
  }

  @Public()
  @Post('public')
  @ApiOperation({ summary: 'Submit a rating from the order link (guests, once, delivered only)' })
  async createPublic(@Body() dto: CreateRatingDto) {
    return this.ratingsService.createPublic(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'List ratings with comments (admin only)' })
  async listForAdmin(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('minRating') minRating?: string,
    @Query('maxRating') maxRating?: string,
    @Query('onlyWithComment') onlyWithComment?: string,
  ) {
    return this.ratingsService.listForAdmin({
      take: take != null ? Number(take) : undefined,
      skip: skip != null ? Number(skip) : undefined,
      minRating: minRating != null ? Number(minRating) : undefined,
      maxRating: maxRating != null ? Number(maxRating) : undefined,
      onlyWithComment: onlyWithComment === 'true' || onlyWithComment === '1',
    });
  }
}
