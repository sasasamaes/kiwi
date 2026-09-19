import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateRatingDto } from './dto/create-rating.dto';

@ApiTags('Ratings')
@Controller('ratings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @ApiOperation({ summary: 'Rate the driver of a delivered order (merchant only)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateRatingDto) {
    return this.ratingsService.create(user.sub, dto);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get the rating of an order (if any) and whether the caller can rate' })
  async findByOrder(@Param('orderId') orderId: string, @CurrentUser() user: any) {
    return this.ratingsService.findByOrder(orderId, user.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
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
