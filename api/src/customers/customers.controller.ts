// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import { ImageUploadService } from '../menu/image-upload.service';

@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly imageUpload: ImageUploadService,
  ) {}

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
  @ApiOperation({ summary: 'Actualizar perfil (ciudad, dirección, zona, avatar)' })
  async updateMe(@CurrentUser() user: any, @Body() body: any) {
    return this.customers.updateMe(user.sub, body);
  }

  /**
   * Foto de perfil del cliente (opcional). Multipart (Multer memoryStorage),
   * misma validación estricta que el resto de imágenes (magic bytes, 5MB).
   * La URL https resultante se guarda como avatarUrl del perfil.
   */
  @Post('me/avatar')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @UseInterceptors(
    FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Subir foto de perfil del cliente (multipart/form-data)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  async uploadAvatar(@CurrentUser() user: any, @UploadedFile() file: any) {
    const { url } = await this.imageUpload.uploadCustomerAvatar(file);
    await this.customers.updateMe(user.sub, { avatarUrl: url });
    return { url };
  }

  /** Estado de la subida para la UI (mostrar el picker una vez configurado). */
  @Get('me/avatar-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Whether customer avatar upload is configured' })
  async avatarStatus() {
    return { enabled: this.imageUpload.isConfigured() };
  }

  // ============================================
  // 📍 Libreta de direcciones
  // ============================================

  @Get('me/addresses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mis lugares guardados' })
  async listAddresses(@CurrentUser() user: any) {
    return this.customers.listAddresses(user.sub);
  }

  @Post('me/addresses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Guardar un lugar (Casa, Casa de mamá…)' })
  async createAddress(@CurrentUser() user: any, @Body() body: any) {
    return this.customers.createAddress(user.sub, body ?? {});
  }

  @Put('me/addresses/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar un lugar guardado' })
  async updateAddress(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.customers.updateAddress(user.sub, id, body ?? {});
  }

  @Delete('me/addresses/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Borrar un lugar guardado' })
  async deleteAddress(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customers.deleteAddress(user.sub, id);
  }

  @Post('me/addresses/:id/default')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar lugar como predeterminado' })
  async setDefaultAddress(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customers.setDefaultAddress(user.sub, id);
  }
}
