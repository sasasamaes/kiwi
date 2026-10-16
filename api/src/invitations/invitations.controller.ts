// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear invitación y enviar el correo (admin)' })
  async create(@Body() dto: CreateInvitationDto, @CurrentUser() user: any) {
    return this.invitationsService.create(dto, user?.sub ?? user?.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar invitaciones (admin)' })
  async list(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.invitationsService.list({
      role,
      status,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  /**
   * Valida el token del link (público, sin auth): la página de registro lo
   * usa para mostrar el banner de invitación y pre-llenar el email.
   */
  @Public()
  @Get('validate')
  @ApiOperation({ summary: 'Validar un token de invitación (público)' })
  async validate(
    @Query('token') token?: string,
    @Query('email') email?: string,
    @Query('role') role?: string,
  ) {
    return this.invitationsService.validateToken(token ?? '', email, role);
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reenviar invitación con link nuevo (admin)' })
  async resend(@Param('id') id: string) {
    return this.invitationsService.resend(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revocar invitación (admin)' })
  async revoke(@Param('id') id: string) {
    return this.invitationsService.revoke(id);
  }
}
