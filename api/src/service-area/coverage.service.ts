// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/** Radio operativo: Nicoya y alrededores. Fuera de esto va a lista de espera. */
export const SERVICE_RADIUS_KM = 25;
const NICOYA_LAT = 10.1467;
const NICOYA_LNG = -85.452;

export interface InterestInput {
  email?: string;
  phone?: string;
  city: string;
  zone?: string;
  latitude?: number;
  longitude?: number;
  source: 'register-customer' | 'register-merchant' | 'register-driver' | 'order-blocked';
}

/**
 * Cobertura y lista de espera: dónde quieren usar Kiwi pero aún no operamos.
 * El registro y los pedidos anotan interés (best-effort, nunca bloquea); el
 * admin ve la demanda por ciudad y avisa por correo al expandirse.
 */
@Injectable()
export class CoverageService {
  private readonly logger = new Logger(CoverageService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  /** true si el punto está dentro del área operativa (Nicoya + alrededores). */
  static inServiceArea(lat: unknown, lng: unknown): boolean {
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const h =
      Math.sin(toRad(la - NICOYA_LAT) / 2) ** 2 +
      Math.cos(toRad(NICOYA_LAT)) * Math.cos(toRad(la)) * Math.sin(toRad(ln - NICOYA_LNG) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h)) <= SERVICE_RADIUS_KM;
  }

  /** Normaliza "san-jose" → "San Jose" para agrupar la demanda. */
  static normalizeCity(raw: unknown): string {
    return String(raw ?? '')
      .trim()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 80)
      .split(' ')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');
  }

  /** Anota interés. Best-effort: jamás revienta el flujo que la llama. */
  async recordInterest(input: InterestInput): Promise<void> {
    try {
      const city = CoverageService.normalizeCity(input.city);
      if (!city) return;
      const email = input.email?.trim().toLowerCase() || undefined;
      if (email) {
        const existing: any = await (this.prisma as any).coverageInterest.findFirst({
          where: { email, city },
        });
        if (existing) return;
      }
      await (this.prisma as any).coverageInterest.create({
        data: {
          email,
          phone: input.phone?.trim() || undefined,
          city,
          zone: input.zone?.trim().slice(0, 120) || undefined,
          latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : undefined,
          longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : undefined,
          source: input.source,
        },
      });
    } catch (error) {
      this.logger.warn(`No se pudo anotar interés: ${(error as Error)?.message}`);
    }
  }

  /** Demanda agrupada por ciudad para decidir dónde abrir. */
  async summary() {
    const rows: any[] = await (this.prisma as any).coverageInterest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const byCity = new Map<
      string,
      { city: string; total: number; notified: number; pending: number; emails: string[] }
    >();
    for (const r of rows) {
      let entry = byCity.get(r.city);
      if (!entry) {
        entry = { city: r.city, total: 0, notified: 0, pending: 0, emails: [] };
        byCity.set(r.city, entry);
      }
      entry.total++;
      if (r.notified) entry.notified++;
      else {
        entry.pending++;
        if (r.email && entry.emails.length < 20) entry.emails.push(r.email);
      }
    }
    const cities: any[] = await (this.prisma as any).city.findMany({
      select: { slug: true, name: true, active: true },
      orderBy: { name: 'asc' },
    });
    return {
      cities,
      demand: [...byCity.values()].sort((a, b) => b.pending - a.pending || b.total - a.total),
    };
  }

  /**
   * Avisa por correo a los pendientes de una ciudad (al abrir cobertura).
   * Marca notified solo a los que salieron bien.
   */
  async notifyCity(city: string, sentBy?: string) {
    const norm = CoverageService.normalizeCity(city);
    if (!norm) return { sent: 0, failed: 0 };
    const pending: any[] = await (this.prisma as any).coverageInterest.findMany({
      where: { city: norm, notified: false },
      take: 1000,
    });
    const web =
      this.configService.get<string>('WEB_URL') ??
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:3000';
    let sent = 0;
    let failed = 0;
    for (const row of pending) {
      if (!row.email) {
        failed++;
        continue;
      }
      const res = await this.mailService.sendMarketing(
        row.email,
        `¡Kiwi llegó a ${norm}! 🥝`,
        `Hola,\n\nNos pediste que te avisáramos: Kiwi ya opera en ${norm}.\n\nCreá tu cuenta acá:\n${web.replace(/\/$/, '')}/register\n\nNos vemos.`,
      );
      if (res.sent) {
        sent++;
        await (this.prisma as any).coverageInterest
          .update({ where: { id: row.id }, data: { notified: true } })
          .catch(() => undefined);
      } else {
        failed++;
      }
    }
    this.logger.log(`Aviso de cobertura ${norm}: ${sent} enviados por ${sentBy ?? 'admin'}`);
    return { sent, failed };
  }
}
