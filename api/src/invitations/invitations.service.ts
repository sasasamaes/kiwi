// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { normalizeCRPhone } from '../common/phone';
import { CreateInvitationDto } from './dto/create-invitation.dto';

export type InvitationRole = 'merchant' | 'driver';

/** El link de invitación vale 30 días (igual que el texto del correo). */
const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  /**
   * Base del link según rol: el comercio se registra en la app web, el
   * repartidor en la app driver (DRIVER_URL; cae a WEB_URL si falta).
   */
  private baseUrlFor(role: string): string {
    const web =
      this.configService.get<string>('WEB_URL') ??
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:3000';
    if (role === 'driver') {
      return this.configService.get<string>('DRIVER_URL') ?? web;
    }
    return web;
  }

  private buildInviteUrl(role: string, email: string, rawToken: string): string {
    const base = this.baseUrlFor(role).replace(/\/$/, '');
    return `${base}/register?email=${encodeURIComponent(email)}&invitation=${rawToken}`;
  }

  private newToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('hex');
    return { raw, hash: createHash('sha256').update(raw).digest('hex') };
  }

  /** La fila sin el hash: el token crudo solo viaja en el link del correo. */
  private sanitize(row: any) {
    const { tokenHash: _tokenHash, ...rest } = row ?? {};
    return rest;
  }

  /**
   * Crea la invitación y manda el correo. Si ya existe una pendiente para ese
   * email+rol, la renueva (token nuevo + reenvío) en vez de duplicar: el
   * vendedor pasa dos veces por el mismo negocio y no debe haber dos links.
   */
  async create(dto: CreateInvitationDto, createdBy?: string) {
    const email = String(dto.email ?? '')
      .trim()
      .toLowerCase();
    if (!EMAIL_RE.test(email)) throw new BadRequestException('Email inválido');
    const role = dto.role as InvitationRole;
    if (role !== 'merchant' && role !== 'driver') {
      throw new BadRequestException('role debe ser "merchant" o "driver"');
    }
    const phoneNorm = dto.phone?.trim() ? (normalizeCRPhone(dto.phone.trim()) ?? null) : undefined;
    if (dto.phone?.trim() && !phoneNorm) {
      throw new BadRequestException('Formato de teléfono inválido');
    }
    const name = dto.name?.trim() || undefined;
    const { raw, hash } = this.newToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const existing: any = await (this.prisma as any).invitation.findFirst({
      where: { email, role, status: 'pending' },
    });
    const row: any = existing
      ? await (this.prisma as any).invitation.update({
          where: { id: existing.id },
          data: {
            phone: phoneNorm ?? existing.phone,
            name: name ?? existing.name,
            tokenHash: hash,
            expiresAt,
            createdBy: createdBy ?? existing.createdBy,
          },
        })
      : await (this.prisma as any).invitation.create({
          data: {
            email,
            phone: phoneNorm,
            name,
            role,
            tokenHash: hash,
            status: 'pending',
            expiresAt,
            createdBy,
          },
        });

    const inviteUrl = this.buildInviteUrl(role, email, raw);
    const emailSent = await this.mailService.sendInvitation(email, role, inviteUrl, name);
    if (emailSent) {
      await (this.prisma as any).invitation.update({
        where: { id: row.id },
        data: { sentAt: new Date() },
      });
    } else {
      this.logger.warn(`Invitación ${row.id} creada pero el correo no salió (SMTP sin configurar)`);
    }
    return {
      invitation: this.sanitize({ ...row, sentAt: emailSent ? new Date() : row.sentAt }),
      inviteUrl,
      emailSent,
    };
  }

  async list(params: { role?: string; status?: string; take?: number; skip?: number }) {
    const where: any = {};
    if (params.role === 'merchant' || params.role === 'driver') where.role = params.role;
    if (['pending', 'accepted', 'revoked'].includes(params.status ?? '')) {
      where.status = params.status;
    }
    const take = Math.min(Math.max(Number(params.take) || 50, 1), 100);
    const skip = Math.max(Number(params.skip) || 0, 0);
    const [rows, total] = await Promise.all([
      (this.prisma as any).invitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      (this.prisma as any).invitation.count({ where }),
    ]);
    return { invitations: rows.map((r: any) => this.sanitize(r)), total };
  }

  /**
   * Reenvía el correo con un token NUEVO (el link viejo muere): el crudo no
   * se guarda, así que reenviar siempre rota. Renueva la vigencia 30 días.
   */
  async resend(id: string) {
    const row: any = await (this.prisma as any).invitation.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Invitación no encontrada');
    if (row.status !== 'pending') {
      throw new BadRequestException('Solo se puede reenviar una invitación pendiente');
    }
    const { raw, hash } = this.newToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const updated: any = await (this.prisma as any).invitation.update({
      where: { id },
      data: { tokenHash: hash, expiresAt },
    });
    const inviteUrl = this.buildInviteUrl(row.role, row.email, raw);
    const emailSent = await this.mailService.sendInvitation(
      row.email,
      row.role,
      inviteUrl,
      row.name ?? undefined,
    );
    const finalRow: any = emailSent
      ? await (this.prisma as any).invitation.update({
          where: { id },
          data: { sentAt: new Date() },
        })
      : updated;
    return {
      invitation: this.sanitize(finalRow),
      inviteUrl,
      emailSent,
    };
  }

  async revoke(id: string) {
    const row: any = await (this.prisma as any).invitation.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Invitación no encontrada');
    if (row.status !== 'pending') {
      throw new BadRequestException('Solo se puede revocar una invitación pendiente');
    }
    const updated: any = await (this.prisma as any).invitation.update({
      where: { id },
      data: { status: 'revoked' },
    });
    return { invitation: this.sanitize(updated) };
  }

  /** Endpoint público: la página de registro muestra el banner que toca. */
  async validateToken(token: string, email?: string, role?: string) {
    if (typeof token !== 'string' || token.length < 32) {
      return { valid: false as const };
    }
    const hash = createHash('sha256').update(token).digest('hex');
    const row: any = await (this.prisma as any).invitation.findUnique({
      where: { tokenHash: hash },
    });
    if (!row || row.status !== 'pending' || new Date(row.expiresAt).getTime() <= Date.now()) {
      return { valid: false as const };
    }
    if (email && String(email).trim().toLowerCase() !== row.email) {
      return { valid: false as const };
    }
    if (role && role !== row.role) {
      return { valid: false as const };
    }
    return { valid: true as const, email: row.email, role: row.role, name: row.name };
  }

  /**
   * Valida el token ANTES de crear la cuenta (el registro lo llama primero
   * para no dejar una cuenta creada con un 400 después).
   */
  async assertValidForRegister(token: string, email: string, role: string): Promise<void> {
    const hash = createHash('sha256').update(token).digest('hex');
    const row: any = await (this.prisma as any).invitation.findUnique({
      where: { tokenHash: hash },
    });
    if (
      !row ||
      row.status !== 'pending' ||
      new Date(row.expiresAt).getTime() <= Date.now() ||
      row.email !==
        String(email ?? '')
          .trim()
          .toLowerCase() ||
      row.role !== role
    ) {
      throw new BadRequestException('Invitación inválida o vencida');
    }
  }

  /**
   * Marca la invitación como aceptada al registrarse. Con token: estricto
   * (link adulterado = 400). Sin token: best-effort por email+rol (el
   * invitado que escribe la URL a mano igual cuenta como aceptado).
   */
  async consumeOnRegister(opts: { token?: string; email: string; role: string }): Promise<void> {
    const email = String(opts.email ?? '')
      .trim()
      .toLowerCase();
    if (opts.token) {
      await this.assertValidForRegister(opts.token, email, opts.role);
      const hash = createHash('sha256').update(opts.token).digest('hex');
      await (this.prisma as any).invitation.update({
        where: { tokenHash: hash },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
      return;
    }
    try {
      await (this.prisma as any).invitation.updateMany({
        where: { email, role: opts.role, status: 'pending' },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
    } catch {
      // best-effort: el registro nunca se bloquea por esto
    }
  }
}
