// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { toE164Phone } from '../common/e164';
import { normalizeCRPhone } from '../common/phone';
import { INFO_TEMPLATES } from './templates';
import { SendBroadcastDto } from './dto/send-broadcast.dto';

const VALID_ROLES = ['merchant', 'driver', 'customer'] as const;
/** Tope por envío: difusión de ventas, no spam industrial. */
const MAX_RECIPIENTS = 1000;
const CONCURRENCY = 5;

interface Recipient {
  email?: string;
  phone?: string;
  name?: string;
  registerUrl: string;
}

/**
 * Difusión del equipo de ventas: correos/WhatsApp informativos a comercios,
 * repartidores y clientes (registrados o contactos sueltos). Todo envío
 * queda en broadcast_logs para auditoría.
 */
@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private whatsapp: WhatsappService,
    private configService: ConfigService,
  ) {}

  templates() {
    const web = (
      this.configService.get<string>('WEB_URL') ??
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const driver = (this.configService.get<string>('DRIVER_URL') ?? web).replace(/\/$/, '');
    const client = (this.configService.get<string>('CLIENT_URL') ?? web).replace(/\/$/, '');
    return INFO_TEMPLATES.map((t) => ({
      ...t,
      registerUrl:
        t.role === 'driver'
          ? `${driver}/register`
          : t.role === 'customer'
            ? `${client}/register`
            : `${web}/register`,
    }));
  }

  private render(text: string, r: Recipient): string {
    return String(text ?? '')
      .replace(/{{name}}/g, r.name?.trim() || 'hola')
      .replace(/{{\s*name\s*}}/g, r.name?.trim() || 'hola')
      .replace(/{{registerUrl}}/g, r.registerUrl);
  }

  private registerUrlFor(role: string): string {
    const web = (
      this.configService.get<string>('WEB_URL') ??
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const driver = (this.configService.get<string>('DRIVER_URL') ?? web).replace(/\/$/, '');
    const client = (this.configService.get<string>('CLIENT_URL') ?? web).replace(/\/$/, '');
    if (role === 'driver') return `${driver}/register`;
    if (role === 'customer') return `${client}/register`;
    return `${web}/register`;
  }

  async previewRecipients(dto: SendBroadcastDto): Promise<{ count: number }> {
    const recipients = await this.resolveRecipients(dto);
    return { count: recipients.length };
  }

  async send(dto: SendBroadcastDto, sentBy?: string) {
    const channel = dto.channel;
    if (!['email', 'whatsapp', 'both'].includes(channel)) {
      throw new BadRequestException('channel debe ser email, whatsapp o both');
    }
    const roles = (dto.roles ?? []).filter((r): r is (typeof VALID_ROLES)[number] =>
      (VALID_ROLES as readonly string[]).includes(r),
    );
    if (!roles.length && !(dto.extraEmails?.length || dto.extraPhones?.length)) {
      throw new BadRequestException('Elegí al menos un rol o contactos extra');
    }
    const recipients = await this.resolveRecipients({ ...dto, roles });
    if (!recipients.length) throw new BadRequestException('Sin destinatarios');
    if (recipients.length > MAX_RECIPIENTS) {
      throw new BadRequestException(`Máximo ${MAX_RECIPIENTS} destinatarios por envío`);
    }
    if (dto.dryRun) {
      return { dryRun: true as const, count: recipients.length };
    }

    let sent = 0;
    let failed = 0;
    const useEmail = channel === 'email' || channel === 'both';
    const useWa = channel === 'whatsapp' || channel === 'both';
    const waTemplate = this.whatsapp.templateFor('KAPSO_TEMPLATE_INFO');

    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      const batch = recipients.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (r) => {
          let ok = true;
          if (useEmail) {
            if (!r.email) ok = false;
            else {
              const okMail = await this.mailService.sendMarketing(
                r.email,
                dto.subject,
                this.render(dto.body, r),
              );
              if (!okMail) ok = false;
            }
          }
          if (useWa) {
            const e164 = r.phone ? toE164Phone(r.phone) : null;
            if (!e164) ok = false;
            else {
              const text = `${dto.subject}\n\n${this.render(dto.body, r)}`;
              const okWa = waTemplate
                ? await this.whatsapp.sendTemplate(e164, waTemplate, [
                    r.name?.trim() || 'hola',
                    r.registerUrl,
                  ])
                : await this.whatsapp.sendText(e164, text);
              if (!okWa) ok = false;
            }
          }
          return ok;
        }),
      );
      for (const ok of results) {
        if (ok) sent++;
        else failed++;
      }
    }

    const audience = roles.length === 1 ? roles[0] : roles.length > 1 ? 'mixed' : 'custom';
    const log: any = await (this.prisma as any).broadcastLog.create({
      data: {
        channel,
        audience,
        subject: dto.subject?.slice(0, 150),
        preview: dto.body?.slice(0, 200),
        count: sent,
        failed,
        sentBy,
      },
    });
    return { sent, failed, logId: log.id };
  }

  async history(take = 30) {
    const rows: any[] = await (this.prisma as any).broadcastLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(take) || 30, 1), 100),
    });
    return { logs: rows };
  }

  private async resolveRecipients(dto: SendBroadcastDto): Promise<Recipient[]> {
    const out = new Map<string, Recipient>();
    const roles = (dto.roles ?? []).filter((r) => (VALID_ROLES as readonly string[]).includes(r));
    if (roles.length) {
      const where: any = { role: { in: roles }, status: 'active' };
      if (dto.userIds?.length) where.id = { in: dto.userIds };
      const users: any[] = await (this.prisma as any).user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          merchantProfile: { select: { businessName: true } },
          driverProfile: { select: { fullName: true } },
          customerProfile: { select: { fullName: true } },
        },
        take: MAX_RECIPIENTS,
      });
      for (const u of users) {
        const key = `u:${u.id}`;
        out.set(key, {
          email: u.email ?? undefined,
          phone: u.phone ?? undefined,
          name:
            u.merchantProfile?.businessName ??
            u.driverProfile?.fullName ??
            u.customerProfile?.fullName ??
            undefined,
          registerUrl: this.registerUrlFor(u.role),
        });
      }
    }
    for (const email of dto.extraEmails ?? []) {
      const norm = String(email ?? '')
        .trim()
        .toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) continue;
      out.set(`e:${norm}`, {
        email: norm,
        registerUrl: this.registerUrlFor(roles[0] ?? 'merchant'),
      });
    }
    for (const phone of dto.extraPhones ?? []) {
      const norm = normalizeCRPhone(String(phone ?? '').trim());
      if (!norm) continue;
      const key = `p:${norm}`;
      const prev = out.get(key);
      out.set(key, {
        ...(prev ?? {}),
        phone: norm,
        registerUrl: this.registerUrlFor(roles[0] ?? 'merchant'),
      });
    }
    return [...out.values()];
  }
}
