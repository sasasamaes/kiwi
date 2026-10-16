// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertReferralDto } from './dto/upsert-referral.dto';

export interface RoleOffer {
  title: string;
  detail: string;
}

const ROLES = ['merchant', 'driver', 'customer'] as const;

/**
 * Códigos de referido (KIKO, WICHO, …). El código viaja en mayúsculas; cada
 * rol tiene su propia oferta y el registro la muestra antes de crear la
 * cuenta. El conteo de usos sale de users.referred_by_code (sin tabla extra).
 */
@Injectable()
export class ReferralsService {
  constructor(private prisma: PrismaService) {}

  normalize(code: unknown): string {
    return String(code ?? '')
      .trim()
      .toUpperCase();
  }

  /** Ofertas saneadas: solo roles conocidos, title/detail strings cortos. */
  sanitizeOffers(raw: unknown): Record<string, RoleOffer> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, RoleOffer> = {};
    for (const role of ROLES) {
      const entry = (raw as any)[role];
      if (!entry || typeof entry !== 'object') continue;
      const title = String(entry.title ?? '')
        .trim()
        .slice(0, 120);
      const detail = String(entry.detail ?? '')
        .trim()
        .slice(0, 500);
      if (title || detail) out[role] = { title, detail };
    }
    return out;
  }

  async create(dto: UpsertReferralDto, createdBy?: string) {
    const code = this.normalize(dto.code);
    if (!/^[A-Z0-9]{2,20}$/.test(code)) {
      throw new BadRequestException('Código inválido (2-20 letras/números)');
    }
    const existing: any = await (this.prisma as any).referralCode.findUnique({
      where: { code },
    });
    if (existing) throw new BadRequestException('Ese código ya existe');
    const row: any = await (this.prisma as any).referralCode.create({
      data: {
        code,
        offers: this.sanitizeOffers(dto.offers),
        active: dto.active ?? true,
        createdBy,
      },
    });
    return { referral: row, uses: 0 };
  }

  async list() {
    const rows: any[] = await (this.prisma as any).referralCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const counts: any[] = await (this.prisma as any).user.groupBy({
      by: ['referredByCode'],
      where: { referredByCode: { not: null } },
      _count: { referredByCode: true },
    });
    const usesByCode = new Map(
      (counts ?? []).map((c: any) => [c.referredByCode, c._count?.referredByCode ?? 0]),
    );
    return {
      referrals: rows.map((r: any) => ({ ...r, uses: usesByCode.get(r.code) ?? 0 })),
    };
  }

  async update(id: string, dto: UpsertReferralDto) {
    const row: any = await (this.prisma as any).referralCode.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Código no encontrado');
    const data: any = {};
    if (dto.offers !== undefined) data.offers = this.sanitizeOffers(dto.offers);
    if (dto.active !== undefined) data.active = dto.active;
    // El código no se renombra: es la llave que ya circula en la calle.
    const updated: any = await (this.prisma as any).referralCode.update({
      where: { id },
      data,
    });
    const uses = await (this.prisma as any).user.count({
      where: { referredByCode: updated.code },
    });
    return { referral: updated, uses };
  }

  async setActive(id: string, active: boolean) {
    const row: any = await (this.prisma as any).referralCode.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Código no encontrado');
    const updated: any = await (this.prisma as any).referralCode.update({
      where: { id },
      data: { active },
    });
    return { referral: updated };
  }

  /** Endpoint público: el registro muestra la oferta de SU app al tipearlo. */
  async validateForRole(code: string, role: string) {
    const normalized = this.normalize(code);
    if (!normalized) return { valid: false as const };
    const row: any = await (this.prisma as any).referralCode.findUnique({
      where: { code: normalized },
    });
    if (!row || !row.active) return { valid: false as const };
    const offers = this.sanitizeOffers(row.offers);
    return { valid: true as const, code: row.code, offer: offers[role] ?? null };
  }

  /**
   * Valida ANTES de crear la cuenta (igual que la invitación: nada de cuenta
   * creada con un 400 después). Devuelve el código normalizado o undefined.
   */
  async assertValidForRegister(code: unknown, role: string): Promise<string | undefined> {
    const normalized = this.normalize(code);
    if (!normalized) return undefined;
    const row: any = await (this.prisma as any).referralCode.findUnique({
      where: { code: normalized },
    });
    if (!row || !row.active) {
      throw new BadRequestException('Código de referido inválido');
    }
    return normalized;
  }
}
