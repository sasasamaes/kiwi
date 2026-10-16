// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Public } from '../auth/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { ImageUploadService } from './image-upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Menu')
@Controller('menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly imageUpload: ImageUploadService,
  ) {}

  // ============================================
  // 📸 Imagen de producto
  // ============================================

  /**
   * Subida de imagen de producto. Multipart (Multer memoryStorage), validación
   * estricta en el service (magic bytes, 5MB, allow-list), y rate limit propio
   * (registrado en rate-limiter.middleware.ts).
   */
  @Post('my/image')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @UseInterceptors(
    FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Upload product image (multipart/form-data)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  async uploadImage(@UploadedFile() file: any) {
    return this.imageUpload.uploadProductImage(file);
  }

  /** Estado de la subida para la UI (pintar el picker una vez configurado). */
  @Get('my/image-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiOperation({ summary: 'Whether image upload is configured' })
  async imageStatus() {
    return { enabled: this.imageUpload.isConfigured() };
  }

  // ============================================
  // 🌐 PUBLIC ENDPOINTS (no auth required)
  // ============================================

  @Public()
  @Get('merchant/:id')
  @ApiOperation({ summary: 'Get merchant public profile' })
  async getMerchantProfile(@Param('id') id: string) {
    return this.menuService.getMerchantPublicProfile(id);
  }

  @Public()
  @Get('merchant/:id/items')
  @ApiOperation({ summary: 'Get merchant menu items' })
  @ApiQuery({ name: 'category', required: false })
  async getMenuItems(@Param('id') id: string, @Query('category') category?: string) {
    return this.menuService.getMenuItems(id, category);
  }

  @Public()
  @Get('tomorrow')
  @ApiOperation({ summary: 'Vitrina de mañana: qué se vende mañana (preventa)' })
  @ApiQuery({ name: 'city', required: false })
  async tomorrowPreview(@Query('city') city?: string) {
    return this.menuService.tomorrowPreview(city || 'nicoya');
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
  async createMenuItem(@CurrentUser() user: any, @Body() data: any) {
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
  async deleteMenuItem(@CurrentUser() user: any, @Param('itemId') itemId: string) {
    return this.menuService.deleteMenuItem(user.sub, itemId);
  }

  // ============================================
  // 🏪 KIOSKOS (puestos dentro del comercio)
  // ============================================

  @Get('my/kiosks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar mis kioskos (panel del comercio)' })
  async listMyKiosks(@CurrentUser() user: any) {
    return this.menuService.listMyKiosks(user.sub);
  }

  @Post('my/kiosks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear kiosko' })
  async createKiosk(@CurrentUser() user: any, @Body() data: any) {
    return this.menuService.createKiosk(user.sub, data);
  }

  @Put('my/kiosks/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar kiosko' })
  async updateKiosk(@CurrentUser() user: any, @Param('id') id: string, @Body() data: any) {
    return this.menuService.updateKiosk(user.sub, id, data);
  }

  @Delete('my/kiosks/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Borrar kiosko (los productos quedan)' })
  async deleteKiosk(@CurrentUser() user: any, @Param('id') id: string) {
    return this.menuService.deleteKiosk(user.sub, id);
  }
}
