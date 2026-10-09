// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isMerchantCategory } from '../merchants/merchant-category';

const DEFAULT_PRICES = {
  spotlight: 1500,
  banner: 2500,
  push: 5000,
};

function daysBetween(a: Date, b: Date): number {
  return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / 86_400_000));
}

// Hora Costa Rica (UTC-6, sin DST). Quiet hours 21h–8h.
function isQuietHour(date = new Date()): boolean {
  const h = (date.getUTCHours() - 6 + 24) % 24;
  return h >= 21 || h < 8;
}

@Injectable()
export class AdsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private async priceFor(kind: 'spotlight' | 'banner' | 'push'): Promise<number> {
    try {
      const row = await this.prisma.platformSetting.findUnique({
        where: { key: `ads.price.${kind}` },
      });
      const v = (row?.value as any)?.price ?? (row?.value as any);
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) return n;
    } catch {}
    return DEFAULT_PRICES[kind];
  }

  private async resolveCity(slug?: string): Promise<string> {
    const want = (slug || 'nicoya').trim().toLowerCase();
    const city = await this.prisma.city.findUnique({ where: { slug: want } });
    if (city) return city.slug;
    return 'nicoya';
  }

  private isOpen(openingHours: any): boolean {
    if (!openingHours) return true;
    try {
      const now = new Date();
      // Formato esperado { days: { mon: [open, close] } } o array; si no se
      // entiende, no bloquear: se muestra abierto.
      if (typeof openingHours === 'object' && openingHours.days) return true;
      return true;
    } catch {
      return true;
    }
  }

  /** Haversine en km (puntos de referencia WGS84, suficiente para ordenar). */
  private distanceKm(
    fromLat: number,
    fromLng: number,
    toLat: number | null,
    toLng: number | null,
  ): number | null {
    if (toLat == null || toLng == null) return null;
    const R = 6371;
    const dLat = ((toLat - fromLat) * Math.PI) / 180;
    const dLng = ((toLng - fromLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((fromLat * Math.PI) / 180) *
        Math.cos((toLat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  }

  /**
   * Feed público: publicidad paga primero (etiquetada isSponsored, máx 3),
   * si no por cercanía al cliente (lat/lng) y si no alfabético.
   */
  async discover(
    citySlug = 'nicoya',
    q?: string,
    take = 20,
    lat?: number,
    lng?: number,
    category?: string,
  ) {
    const city = await this.resolveCity(citySlug);
    const now = new Date();
    const limit = Math.min(Math.max(Number(take) || 20, 1), 50);

    const activeSpotlight = await this.prisma.adCampaign.findMany({
      where: {
        citySlug: city,
        type: 'spotlight',
        status: 'active',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { startsAt: 'desc' },
      take: 3,
      select: { id: true, merchantId: true },
    });
    const sponsoredIds = activeSpotlight.map((c) => c.merchantId);
    const campaignByMerchant = new Map(activeSpotlight.map((c) => [c.merchantId, c.id]));

    // Feed de lanzamiento: entra todo comercio con usuario activo de rol
    // merchant (menos admin/test). El KYC verificado ordena primero pero NO
    // excluye: los comercios ya operando con la app de negocios (aunque su
    // KYC siga pending) deben verse en la app de clientes.
    const where: any = {
      citySlug: city,
      user: { status: 'active', role: 'merchant' },
      ...(isMerchantCategory(category) ? { category } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { businessName: { contains: q.trim(), mode: 'insensitive' } },
              { description: { contains: q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const merchants = await this.prisma.merchantProfile.findMany({
      where,
      select: {
        id: true,
        businessName: true,
        address: true,
        description: true,
        logoUrl: true,
        latitude: true,
        longitude: true,
        openingHours: true,
        citySlug: true,
        createdAt: true,
        kycStatus: true,
        category: true,
      },
      take: 100,
    });

    // Rating por merchant (lote pequeño; N<=100, agregación individual aceptable en MVP).
    const hasCoords =
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng);
    const withRatings = await Promise.all(
      merchants.map(async (m) => {
        const agg = await this.prisma.rating.aggregate({
          where: { merchantId: m.id },
          _avg: { rating: true },
          _count: { rating: true },
        });
        const mLat = m.latitude != null ? Number(m.latitude) : null;
        const mLng = m.longitude != null ? Number(m.longitude) : null;
        return {
          ...m,
          latitude: mLat,
          longitude: mLng,
          rating: agg._avg.rating != null ? Number(agg._avg.rating) : 5.0,
          totalRatings: agg._count.rating,
          isOpen: this.isOpen(m.openingHours),
          isSponsored: sponsoredIds.includes(m.id),
          campaignId: campaignByMerchant.get(m.id) ?? null,
          distanceKm: hasCoords ? this.distanceKm(lat as number, lng as number, mLat, mLng) : null,
        };
      }),
    );

    withRatings.sort((a, b) => {
      // 1. Publicidad paga primero (la card dice "Patrocinado").
      if (a.isSponsored !== b.isSponsored) return a.isSponsored ? -1 : 1;
      const aVerified = (a as any).kycStatus === 'approved' ? 0 : 1;
      const bVerified = (b as any).kycStatus === 'approved' ? 0 : 1;
      if (aVerified !== bVerified) return aVerified - bVerified;
      // 2. Cercanía al cliente, solo si compartió ubicación.
      if (hasCoords) {
        const ad = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const bd = b.distanceKm ?? Number.POSITIVE_INFINITY;
        if (ad !== bd) return ad - bd;
      }
      // 3. Alfabético por nombre (si no, el orden parece aleatorio).
      const alpha = a.businessName.localeCompare(b.businessName, 'es', { sensitivity: 'base' });
      if (alpha !== 0) return alpha;
      if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
      if (a.rating !== b.rating) return b.rating - a.rating;
      return 0;
    });

    return { city, sponsoredCount: sponsoredIds.length, items: withRatings.slice(0, limit) };
  }

  /** Banners activos para el carrusel home_top. */
  async banners(citySlug = 'nicoya') {
    const city = await this.resolveCity(citySlug);
    const now = new Date();
    const rows = await this.prisma.adCampaign.findMany({
      where: {
        citySlug: city,
        type: 'banner',
        status: 'active',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { startsAt: 'desc' },
      take: 5,
      include: { merchant: { select: { id: true, businessName: true, logoUrl: true } } },
    });
    return {
      city,
      items: rows.map((c) => ({
        campaignId: c.id,
        merchantId: c.merchantId,
        businessName: c.merchant.businessName,
        logoUrl: c.merchant.logoUrl,
        title: c.title,
        imageUrl: c.imageUrl,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
      })),
    };
  }

  async myCampaigns(merchantUserId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId: merchantUserId },
    });
    if (!merchant) throw new NotFoundException('Perfil de comercio no encontrado');
    return this.prisma.adCampaign.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Crea campaña en pending (se cobra al aprobar, no acá: evita reembolsos). */
  async createCampaign(merchantUserId: string, dto: any) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId: merchantUserId },
    });
    if (!merchant) throw new NotFoundException('Perfil de comercio no encontrado');
    if (merchant.kycStatus !== 'approved')
      throw new ForbiddenException('Tu comercio debe estar verificado (KYC) para pautar');
    if (merchant.citySlug && dto.citySlug && dto.citySlug !== merchant.citySlug) {
      throw new BadRequestException('Solo podés pautar en tu ciudad operativa');
    }

    const type = dto.type as 'spotlight' | 'banner';
    if (!['spotlight', 'banner'].includes(type)) throw new BadRequestException('type inválido');
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))
      throw new BadRequestException('Fechas inválidas');
    if (endsAt <= startsAt) throw new BadRequestException('endsAt debe ser posterior a startsAt');
    if (daysBetween(startsAt, endsAt) > 90)
      throw new BadRequestException('Máximo 90 días por campaña');
    if (startsAt < new Date(Date.now() - 60_000))
      throw new BadRequestException('startsAt no puede ser pasado');

    const overlapping = await this.prisma.adCampaign.count({
      where: {
        merchantId: merchant.id,
        type: type as any,
        status: { in: ['pending', 'active'] as any },
      },
    });
    if (overlapping >= 2)
      throw new BadRequestException('Máximo 2 campañas pendientes/activas por tipo');

    const city = await this.resolveCity(dto.citySlug || merchant.citySlug);
    const pricePerDay = await this.priceFor(type);
    return this.prisma.adCampaign.create({
      data: {
        merchantId: merchant.id,
        citySlug: city,
        type: type as any,
        title: dto.title?.slice(0, 80) || null,
        imageUrl: dto.imageUrl || null,
        startsAt,
        endsAt,
        status: 'pending' as any,
        pricePerDay,
        totalCharged: 0,
        createdBy: merchantUserId,
      },
    });
  }

  /** Aprueba/rechaza (admin). Al aprobar cobra días × precio/día de creditBalance. */
  async reviewCampaign(adminId: string, id: string, approve: boolean) {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id },
      include: { merchant: true },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    if (campaign.status !== 'pending')
      throw new BadRequestException(`Campaña ya está ${campaign.status}`);
    if (!approve) {
      return this.prisma.adCampaign.update({ where: { id }, data: { status: 'rejected' as any } });
    }
    const days = daysBetween(campaign.startsAt, campaign.endsAt);
    const total = Number(campaign.pricePerDay) * days;
    const balance = Number(campaign.merchant.creditBalance);
    if (balance < total)
      throw new BadRequestException(
        `Saldo insuficiente: ₡${total} requeridos, ₡${balance} disponibles`,
      );

    await this.prisma.merchantProfile.update({
      where: { id: campaign.merchantId },
      data: { creditBalance: { decrement: total } },
    });
    await this.prisma.creditTransaction.create({
      data: {
        merchantId: campaign.merchantId,
        amount: -total as any,
        kind: 'spend' as any,
        reason: `ads:${campaign.type}:${campaign.id}`,
        createdBy: adminId,
      },
    });
    return this.prisma.adCampaign.update({
      where: { id },
      data: { status: 'active' as any, totalCharged: total as any },
    });
  }

  async setCampaignStatus(adminId: string, id: string, status: 'paused' | 'active' | 'ended') {
    void adminId;
    const campaign = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    if (!['paused', 'active', 'ended'].includes(status))
      throw new BadRequestException('status inválido');
    return this.prisma.adCampaign.update({ where: { id }, data: { status: status as any } });
  }

  async adminList(status?: string, citySlug?: string) {
    return this.prisma.adCampaign.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(citySlug ? { citySlug } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        merchant: { select: { id: true, businessName: true, citySlug: true, creditBalance: true } },
      },
    });
  }

  /** Métrica pública (impression/click). Sin auth para no friccionar el feed. */
  async recordEvent(dto: any, userId?: string) {
    if (!dto.campaignId && !dto.broadcastId)
      throw new BadRequestException('campaignId o broadcastId requerido');
    if (!['impression', 'click', 'push_open'].includes(dto.type))
      throw new BadRequestException('type inválido');
    return this.prisma.adEvent.create({
      data: {
        campaignId: dto.campaignId || null,
        broadcastId: dto.broadcastId || null,
        type: dto.type,
        cost: 0 as any,
        userId: userId || null,
      },
    });
  }

  // ── Ofertas push ──

  async myBroadcasts(merchantUserId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId: merchantUserId },
    });
    if (!merchant) throw new NotFoundException('Perfil de comercio no encontrado');
    return this.prisma.offerBroadcast.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createBroadcast(merchantUserId: string, dto: any) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId: merchantUserId },
    });
    if (!merchant) throw new NotFoundException('Perfil de comercio no encontrado');
    if (merchant.kycStatus !== 'approved')
      throw new ForbiddenException('Tu comercio debe estar verificado (KYC) para enviar ofertas');

    const title = String(dto.title || '').trim();
    const body = String(dto.body || '').trim();
    if (title.length < 3) throw new BadRequestException('Título muy corto');
    if (body.length < 3) throw new BadRequestException('Mensaje muy corto');

    // Antispam: 1 oferta/día por comercio.
    const since = new Date(Date.now() - 24 * 3600_000);
    const recent = await this.prisma.offerBroadcast.count({
      where: {
        merchantId: merchant.id,
        createdAt: { gte: since },
        status: { not: 'rejected' as any },
      },
    });
    if (recent >= 1) throw new BadRequestException('Máximo 1 oferta por día por comercio');

    const city = await this.resolveCity(dto.citySlug || merchant.citySlug);
    if (dto.citySlug && dto.citySlug !== merchant.citySlug) {
      throw new BadRequestException('Solo podés enviar ofertas en tu ciudad operativa');
    }
    return this.prisma.offerBroadcast.create({
      data: {
        merchantId: merchant.id,
        citySlug: city,
        zoneId: dto.zoneId || null,
        title: title.slice(0, 60),
        body: body.slice(0, 140),
        imageUrl: dto.imageUrl || null,
        linkMerchantId: merchant.id,
        status: 'pending' as any,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
    });
  }

  async reviewBroadcast(adminId: string, id: string, approve: boolean) {
    const b = await this.prisma.offerBroadcast.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Oferta no encontrada');
    if (b.status !== 'pending') throw new BadRequestException(`Oferta ya está ${b.status}`);
    if (!approve)
      return this.prisma.offerBroadcast.update({
        where: { id },
        data: { status: 'rejected' as any },
      });
    return this.prisma.offerBroadcast.update({
      where: { id },
      data: { status: 'approved' as any, approvedBy: adminId } as any,
    });
  }

  /**
   * Envía el push segmentado por ciudad (+ zona opcional).
   * Cobra tarifa fija push de creditBalance. Respeta quiet hours y opt-out.
   */
  async sendBroadcast(id: string) {
    const b = await this.prisma.offerBroadcast.findUnique({
      where: { id },
      include: { merchant: { select: { id: true, businessName: true, creditBalance: true } } },
    });
    if (!b) throw new NotFoundException('Oferta no encontrada');
    if (!['approved', 'pending'].includes(b.status))
      throw new BadRequestException(`Oferta en estado ${b.status}, no se puede enviar`);

    if (isQuietHour() && !b.scheduledAt) {
      throw new BadRequestException(
        'Horario silencioso (9pm–8am CR): programá scheduledAt para mañana 8am o más tarde',
      );
    }

    // Antispam ciudad: máx 2 pushes/día por ciudad.
    const since = new Date(Date.now() - 24 * 3600_000);
    const citySends = await this.prisma.offerBroadcast.count({
      where: { citySlug: b.citySlug, status: 'sent' as any, sentAt: { gte: since } },
    });
    if (citySends >= 2) throw new BadRequestException('Límite diario por ciudad alcanzado (2/día)');

    const cost = await this.priceFor('push');
    const balance = Number(b.merchant.creditBalance);
    if (balance < cost) throw new BadRequestException(`Saldo insuficiente: ₡${cost} requeridos`);

    // Destinatarios: customers activos de la ciudad (+ zona si viene), sin opt-out.
    const customers = await this.prisma.customerProfile.findMany({
      where: { citySlug: b.citySlug, ...(b.zoneId ? { deliveryZone: b.zoneId } : {}) },
      select: { userId: true },
      take: 5000,
    });
    if (customers.length === 0)
      throw new BadRequestException('Sin clientes en esa ciudad/zona todavía');
    const userIds = [...new Set(customers.map((c) => c.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, role: 'customer' as any, status: 'active' },
      select: { id: true },
    });
    const activeIds = users.map((u) => u.id);
    const optedOut = await this.prisma.topicPreference.findMany({
      where: { topic: 'customer.offers', enabled: false, userId: { in: activeIds } },
      select: { userId: true },
    });
    const optedOutSet = new Set(optedOut.map((o) => o.userId));
    const targets = activeIds.filter((id) => !optedOutSet.has(id));
    if (targets.length === 0)
      throw new BadRequestException('Todos los clientes desactivaron ofertas');

    await this.prisma.offerBroadcast.update({ where: { id }, data: { status: 'sending' as any } });

    // Cobro antes del fan-out (si falla el push, queda ledger auditable + estado).
    await this.prisma.merchantProfile.update({
      where: { id: b.merchantId },
      data: { creditBalance: { decrement: cost } },
    });
    await this.prisma.creditTransaction.create({
      data: {
        merchantId: b.merchantId,
        amount: -cost as any,
        kind: 'spend' as any,
        reason: `ads:push:${b.id}`,
      },
    });

    let sent = 0;
    const CHUNK = 100;
    for (let i = 0; i < targets.length; i += CHUNK) {
      const batch = targets.slice(i, i + CHUNK);
      try {
        const res = await this.notifications.sendToMultipleUsers(batch, {
          title: b.title,
          body: `${b.body} — ${b.merchant.businessName}`,
          imageUrl: b.imageUrl || undefined,
          data: { type: 'offer', broadcastId: b.id, merchantId: b.merchantId, city: b.citySlug },
        });
        sent += (res as any).success ?? batch.length;
      } catch {
        // best-effort por chunk: no tumbar todo el broadcast
      }
    }
    await this.prisma.adEvent.create({
      data: { broadcastId: b.id, type: 'push_sent', cost: 0 as any },
    });
    return this.prisma.offerBroadcast
      .update({
        where: { id },
        data: { status: 'sent' as any, sentAt: new Date(), costCharged: cost as any },
      })
      .then((row) => ({ ...row, recipients: sent }));
  }
}
