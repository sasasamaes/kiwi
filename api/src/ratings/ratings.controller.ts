import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
}
