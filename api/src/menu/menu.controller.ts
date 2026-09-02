import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ============================================
  // 🌐 PUBLIC ENDPOINTS (no auth required)
  // ============================================

  @Get('merchant/:id')
  @ApiOperation({ summary: 'Get merchant public profile' })
  async getMerchantProfile(@Param('id') id: string) {
    return this.menuService.getMerchantPublicProfile(id);
  }

  @Get('merchant/:id/items')
  @ApiOperation({ summary: 'Get merchant menu items' })
  @ApiQuery({ name: 'category', required: false })
  async getMenuItems(
    @Param('id') id: string,
    @Query('category') category?: string,
  ) {
    return this.menuService.getMenuItems(id, category);
  }

  // ============================================
  // 🔐 AUTHENTICATED ENDPOINTS (merchant only)
  // ============================================

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my menu items (merchant)' })
  async getMyMenuItems(@CurrentUser() user: any) {
    return this.menuService.getMerchantMenuItems(user.sub);
  }

  @Post('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create menu item' })
  async createMenuItem(
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.menuService.createMenuItem(user.sub, data);
  }

  @Put('my/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update menu item' })
  async updateMenuItem(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
    @Body() data: any,
  ) {
    return this.menuService.updateMenuItem(user.sub, itemId, data);
  }

  @Delete('my/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete menu item' })
  async deleteMenuItem(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
  ) {
    return this.menuService.deleteMenuItem(user.sub, itemId);
  }
}
