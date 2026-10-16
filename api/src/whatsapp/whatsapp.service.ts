// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SendResult } from '../mail/mail.service';

/**
 * WhatsApp por Kapso (Meta Cloud API vía Kapso).
 *
 * POST https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages
 * con header X-API-Key. Sin KAPSO_API_KEY/KAPSO_PHONE_NUMBER_ID el servicio
 * queda deshabilitado y send* devuelve false (fail-soft, igual que el mail).
 *
 * REGLA META: a un contacto frío (fuera de la ventana de 24h) solo se le
 * puede escribir con una PLANTILLA aprobada. Por eso la invitación y la
 * difusión usan template cuando hay uno configurado (KAPSO_TEMPLATE_*);
 * el texto libre solo sirve con conversación abierta o en sandbox.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('KAPSO_API_KEY') &&
      this.configService.get<string>('KAPSO_PHONE_NUMBER_ID'),
    );
  }

  private endpoint(): string {
    const phoneNumberId = this.configService.get<string>('KAPSO_PHONE_NUMBER_ID');
    return `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`;
  }

  private async post(payload: Record<string, unknown>): Promise<SendResult> {
    const apiKey = this.configService.get<string>('KAPSO_API_KEY');
    if (!apiKey) return { sent: false, reason: 'not-configured' };
    try {
      const res = await fetch(this.endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const reason = `Kapso ${res.status}: ${text.slice(0, 200)}`;
        this.logger.warn(reason);
        return { sent: false, reason };
      }
      return { sent: true };
    } catch (error) {
      const reason = `Kapso no respondió: ${(error as Error)?.message}`;
      this.logger.error(reason);
      return { sent: false, reason: reason.slice(0, 300) };
    }
  }

  /** Texto libre (ventana de 24h abierta o sandbox). */
  async sendText(to: string, body: string): Promise<SendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(`WhatsApp a ${to} no enviado: Kapso sin configurar`);
      return { sent: false, reason: 'not-configured' };
    }
    return this.post({
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body },
    });
  }

  /**
   * Plantilla aprobada (contactos fríos). `params` rellena los {{1}}, {{2}}…
   * del cuerpo en orden.
   */
  async sendTemplate(
    to: string,
    templateName: string,
    params: string[] = [],
    language = 'es',
  ): Promise<SendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(`WhatsApp a ${to} no enviado: Kapso sin configurar`);
      return { sent: false, reason: 'not-configured' };
    }
    return this.post({
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: params.length
          ? [
              {
                type: 'body',
                parameters: params.map((text) => ({ type: 'text', text })),
              },
            ]
          : [],
      },
    });
  }

  /** Nombre de plantilla configurado para un uso, o undefined. */
  templateFor(key: string): string | undefined {
    return this.configService.get<string>(key) || undefined;
  }
}
