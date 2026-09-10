import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new order' })
  async create(@CurrentUser() user: any, @Body() createOrderDto: any) {
    return this.ordersService.create(user.sub, createOrderDto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my orders (merchant or driver)' })
  @ApiQuery({ name: 'status', required: false })
  async getMyOrders(@CurrentUser() user: any, @Query('status') status?: string) {
    if (user.role === 'merchant') {
      return this.ordersService.findByMerchant(user.sub, status);
    } else {
      return this.ordersService.findByDriver(user.sub, status);
    }
  }

  @Get('available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available orders for drivers' })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'lng', required: false })
  async getAvailable(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    const latitude = lat ? parseFloat(lat) : undefined;
    const longitude = lng ? parseFloat(lng) : undefined;
    return this.ordersService.getAvailableOrders(latitude, longitude);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.findById(id, user.sub);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(id, status, user.sub);
  }

  @Put(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign driver to order' })
  async assignDriver(
    @Param('id') id: string,
    @Body('driverId') driverId: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.assignDriver(id, driverId, user.sub);
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Driver accepts a pending order' })
  async acceptOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.acceptOrderAsDriver(id, user.sub);
  }

  @Post(':id/proposals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit proposal for scheduled order' })
  async submitProposal(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() proposalDto: any,
  ) {
    return this.ordersService.submitProposal(id, user.sub, proposalDto);
  }

  @Put(':orderId/proposals/:proposalId/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept driver proposal' })
  async acceptProposal(
    @Param('orderId') orderId: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.acceptProposal(orderId, proposalId, user.sub);
  }
}
