// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Envío de emails transaccionales por SMTP (recupero de contraseña).
 *
 * Sin SMTP_HOST/SMTP_USER configurados el servicio queda deshabilitado y
 * send() devuelve false (fail-soft): los endpoints responden igual para no
 * enumerar cuentas, y el log avisa qué falta configurar en el entorno.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.configService.get<string>('SMTP_PORT') ?? 587),
        secure: Number(this.configService.get<string>('SMTP_PORT') ?? 587) === 465,
        auth: {
          user,
          pass: this.configService.get<string>('SMTP_PASS') ?? '',
        },
      });
    } else {
      this.logger.warn('SMTP no configurado (SMTP_HOST/SMTP_USER): emails deshabilitados');
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Password reset para ${to} no enviado: SMTP sin configurar`);
      return false;
    }
    const from = this.configService.get<string>('SMTP_USER');
    try {
      await this.transporter.sendMail({
        from: `"Kiwi" <${from}>`,
        to,
        subject: 'Recuperá tu contraseña de Kiwi',
        text:
          `Pediste restablecer tu contraseña de Kiwi.\n\n` +
          `Abrí este link (vale 1 hora, un solo uso):\n${resetUrl}\n\n` +
          `Si no fuiste vos, ignorá este mensaje.`,
        html:
          `<p>Pediste restablecer tu contraseña de Kiwi.</p>` +
          `<p><a href="${resetUrl}">Elegí una contraseña nueva</a> (vale 1 hora, un solo uso).</p>` +
          `<p>Si no fuiste vos, ignorá este mensaje.</p>`,
      });
      return true;
    } catch (error) {
      this.logger.error(`No se pudo enviar el reset a ${to}: ${(error as Error)?.message}`);
      return false;
    }
  }
}
