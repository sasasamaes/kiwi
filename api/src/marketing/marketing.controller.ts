// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';
import { SendBroadcastDto } from './dto/send-broadcast.dto';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Marketing')
@Controller('marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class MarketingController {
  constructor(
    private readonly marketingService: MarketingService,
    private readonly mailService: MailService,
    private readonly whatsapp: WhatsappService,
  ) {}

  /**
   * Diagnóstico de canales (admin): dice si SMTP y Kapso están configurados
   * y si el login SMTP pasa. Para dejar de adivinar por qué no sale un correo.
   */
  @Get('channels-status')
  @ApiOperation({ summary: 'Estado de SMTP y Kapso (admin)' })
  async channelsStatus() {
    return {
      smtp: await this.mailService.checkSmtp(),
      whatsapp: {
        configured: this.whatsapp.isConfigured(),
        infoTemplate: this.whatsapp.templateFor('KAPSO_TEMPLATE_INFO') ?? null,
      },
    };
  }

  @Get('templates')
  @ApiOperation({ summary: 'Plantillas informativas por rol (admin)' })
  async templates() {
    return { templates: this.marketingService.templates() };
  }

  @Post('preview')
  @ApiOperation({ summary: 'Contar destinatarios sin enviar (admin)' })
  async preview(@Body() dto: SendBroadcastDto) {
    return this.marketingService.previewRecipients(dto);
  }

  @Post('send')
  @ApiOperation({ summary: 'Enviar difusión email/WhatsApp (admin)' })
  async send(@Body() dto: SendBroadcastDto, @CurrentUser() user: any) {
    return this.marketingService.send(dto, user?.sub ?? user?.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Historial de envíos (admin)' })
  async history(@Query('take') take?: string) {
    return this.marketingService.history(take ? Number(take) : undefined);
  }
}
