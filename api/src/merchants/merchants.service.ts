// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isMerchantCategory } from './merchant-category';

/** Avisos push gratis a seguidores por semana (lunes a domingo, hora CR). */
export const FREE_PUSH_PER_WEEK = 4;

/** Lunes 00:00 CR de la semana en curso (CR = UTC-6, sin horario de verano). */
export function weekStartCR(now = Date.now()): Date {
  const cr = new Date(now - 6 * 3_600_000);
  const daysSinceMonday = (cr.getUTCDay() + 6) % 7;
  return new Date(
    Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate() - daysSinceMonday, 6, 0, 0),
  );
}

@Injectable()
export class MerchantsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findById(id: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            status: true,
          },
        },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        favoriteDrivers: {
          include: {
            driver: true,
          },
        },
      },
    });

    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }

    return merchant;
  }

  /** Visibilidad en la lista pública (admin). No desactiva: QR y menú siguen. */
  async setListed(id: string, listed: boolean) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id } });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }
    return this.prisma.merchantProfile.update({ where: { id }, data: { isListed: listed } });
  }

  /** Marca de cocina casera (admin). Habilita sección, preventa y comisión reducida. */
  async setHomeCook(id: string, value: boolean) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id } });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }
    return this.prisma.merchantProfile.update({
      where: { id },
      data: { isHomeCook: value },
    });
  }

  /** Seguidores del comercio (para el botón "avisar" del panel). */ async followersCount(
    merchantId: string,
  ): Promise<{ count: number }> {
    const count = await this.prisma.merchantFollow.count({ where: { merchantId } });
    return { count };
  }

  /**
   * Cupo de avisos del comercio: 4 gratis/semana + extras otorgados por el
   * admin (comprados o por acuerdo). Lo consume announceToFollowers.
   */
  async announceQuota(userId: string): Promise<{
    freeUsed: number;
    freeTotal: number;
    extraCredits: number;
    weekEndsAt: Date;
  }> {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Perfil de comercio no encontrado');
    const start = weekStartCR();
    const freeUsed = await (this.prisma as any).pushAnnouncement.count({
      where: { merchantId: merchant.id, free: true, createdAt: { gte: start } },
    });
    return {
      freeUsed,
      freeTotal: FREE_PUSH_PER_WEEK,
      extraCredits: (merchant as any).pushCredits ?? 0,
      weekEndsAt: new Date(start.getTime() + 7 * 24 * 3_600_000),
    };
  }

  /**
   * Aviso a seguidores ("mañana vendo rollos", "ya hay comida del día").
   * Tope 3/día por comercio (antispam) + 4 gratis/semana: lo extra consume
   * pushCredits (los otorga el admin) o 402 para hablar con Kiwi.
   */
  async announceToFollowers(
    userId: string,
    input: { title?: unknown; body?: unknown },
  ): Promise<{ reached: number; free: boolean }> {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Perfil de comercio no encontrado');

    const title = String(input?.title ?? '')
      .trim()
      .slice(0, 60);
    const body = String(input?.body ?? '')
      .trim()
      .slice(0, 200);
    if (!title || !body) {
      throw new BadRequestException('Título y mensaje requeridos');
    }
    const since = new Date(Date.now() - 24 * 3_600_000);
    const recent = await this.prisma.notification.count({
      where: {
        type: 'push:merchant-follow',
        createdAt: { gte: since },
        data: { path: ['merchantId'], equals: merchant.id },
      },
    });
    if (recent >= 3) {
      throw new BadRequestException('Límite de 3 avisos por día — volvé mañana');
    }
    // Cupo semanal: gratis primero, extra (comprado) después, 402 si no hay.
    const start = weekStartCR();
    const freeUsed = await (this.prisma as any).pushAnnouncement.count({
      where: { merchantId: merchant.id, free: true, createdAt: { gte: start } },
    });
    let free = true;
    if (freeUsed >= FREE_PUSH_PER_WEEK) {
      if (((merchant as any).pushCredits ?? 0) > 0) {
        await this.prisma.merchantProfile.update({
          where: { id: merchant.id },
          data: { pushCredits: { decrement: 1 } },
        });
        free = false;
      } else {
        throw new HttpException(
          'Ya usaste tus 4 avisos gratis de esta semana. Pedile más avisos al equipo Kiwi.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }
    const { reached } = await this.notifications.notifyFollowers(merchant.id, {
      title: `🧡 ${merchant.businessName}: ${title}`,
      body,
      data: { kind: 'announce' },
    });
    await (this.prisma as any).pushAnnouncement.create({
      data: { merchantId: merchant.id, title, body, reached, free, createdBy: userId },
    });
    return { reached, free };
  }

  /** Otorga avisos push extra a un comercio (admin: comprados o por acuerdo). */
  async grantPushCredits(merchantId: string, amount: number): Promise<{ pushCredits: number }> {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      throw new BadRequestException('Cantidad inválida (1-100)');
    }
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) throw new NotFoundException('Comercio no encontrado');
    const updated: any = await this.prisma.merchantProfile.update({
      where: { id: merchantId },
      data: { pushCredits: { increment: n } },
    });
    return { pushCredits: updated.pushCredits ?? 0 };
  }

  /** Cobro con tarjeta/SINPE (admin, tras KYC de Onvo). */
  async setCardPayments(id: string, enabled: boolean) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id } });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }
    return this.prisma.merchantProfile.update({
      where: { id },
      data: { cardPaymentsEnabled: enabled },
    });
  }

  /** Facturación semanal pospago (admin, por comercio). Sin esto el
   * comercio no puede elegir pagar contra uso; el corte lo cobra Kiwi. */
  async setWeeklyBilling(id: string, enabled: boolean) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id } });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }
    return this.prisma.merchantProfile.update({
      where: { id },
      data: { weeklyBillingEnabled: enabled },
    });
  }

  /**
   * Cuelga una sede bajo su matriz (admin). parentId null = la deja como
   * matriz (sin padre). No permite ciclos ni colgar una matriz que ya
   * tiene sedes (rompería la raíz de la cadena, que es de un nivel).
   */
  async setParentMerchant(id: string, parentId: string | null) {
    const merchant: any = await this.prisma.merchantProfile.findUnique({
      where: { id },
      include: { branches: { select: { id: true, businessName: true } } },
    });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }
    if (parentId) {
      if (parentId === id) {
        throw new BadRequestException('Una sede no puede ser su propia matriz');
      }
      if (merchant.branches?.length > 0) {
        const names = merchant.branches.map((b: any) => b.businessName).join(', ');
        throw new BadRequestException(
          `${merchant.businessName} ya es matriz de: ${names}. Mové primero sus sedes y reintentá`,
        );
      }
      const parent: any = await this.prisma.merchantProfile.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        throw new NotFoundException('Matriz no encontrada');
      }
      if (parent.parentMerchantId === id) {
        throw new BadRequestException(
          `${parent.businessName} ya es sede de ${merchant.businessName}: quitá ese vínculo primero (ponela como matriz) y reintentá`,
        );
      }
    }
    return this.prisma.merchantProfile.update({
      where: { id },
      data: { parentMerchantId: parentId },
    });
  }

  /** Traslados entre sedes (admin, por comercio). */
  async setTransfersEnabled(id: string, enabled: boolean) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id } });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }
    return this.prisma.merchantProfile.update({
      where: { id },
      data: { transfersEnabled: enabled },
    });
  }

  /**
   * Precio pactado del traslado (admin, colones). null = automático
   * (sede→sede por GPS/distancia). Se setea en la sede que pide o en la
   * matriz (las sedes lo heredan si no tienen propio).
   */
  async setTransferPriceOverride(id: string, price: number | null) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id } });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }
    if (price === null || price === undefined) {
      return this.prisma.merchantProfile.update({
        where: { id },
        data: { transferPriceOverride: null },
      });
    }
    const n = Math.round(Number(price));
    if (!Number.isFinite(n) || n < 0 || n > 500000) {
      throw new BadRequestException('Precio inválido (0–500000 colones, o vacío para automático)');
    }
    return this.prisma.merchantProfile.update({
      where: { id },
      data: { transferPriceOverride: n },
    });
  }

  /**
   * Cadena del comercio: matriz + sedes hermanas (para el módulo de
   * traslados). Incluye direcciones/GPS para armar pickup y delivery.
   */
  async getChain(userId: string) {
    const me = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!me) throw new NotFoundException('Perfil de comerciante no encontrado');
    const rootId = (me as any).parentMerchantId ?? me.id;
    const members = await this.prisma.merchantProfile.findMany({
      where: { OR: [{ id: rootId }, { parentMerchantId: rootId }] },
      select: {
        id: true,
        businessName: true,
        address: true,
        latitude: true,
        longitude: true,
        parentMerchantId: true,
        transfersEnabled: true,
      },
      orderBy: { businessName: 'asc' },
    });
    return { rootId, myId: me.id, members };
  }

  /**
   * Modo prueba por comercio (admin, tiempo limitado): el comercio puede
   * crear pedidos test sin gastar crédito, solo con pilotos. `hours`
   * define la vigencia desde ahora; enabled=false o vencido lo apaga.
   */
  async setTestOrders(id: string, enabled: boolean, hours?: number) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id } });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }
    const h = Math.round(Number(hours ?? 24));
    const safeHours = Number.isFinite(h) ? Math.min(Math.max(h, 1), 24 * 30) : 24;
    return this.prisma.merchantProfile.update({
      where: { id },
      data: {
        testOrdersEnabled: enabled,
        testOrdersUntil: enabled ? new Date(Date.now() + safeHours * 3_600_000) : null,
      },
    });
  }

  /** Métodos de pago que el comercio prende/apaga en su perfil. */
  async setPaymentMethods(userId: string, data: { cashEnabled?: boolean; sinpeEnabled?: boolean }) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant) {
      throw new NotFoundException('Perfil de comercio no encontrado');
    }
    return this.prisma.merchantProfile.update({
      where: { userId },
      data: {
        ...(data.cashEnabled !== undefined ? { cashEnabled: !!data.cashEnabled } : {}),
        ...(data.sinpeEnabled !== undefined ? { sinpeEnabled: !!data.sinpeEnabled } : {}),
      },
      select: { cashEnabled: true, sinpeEnabled: true, cardPaymentsEnabled: true },
    });
  }

  async findByUserId(userId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      include: {
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!merchant) {
      throw new NotFoundException('Perfil de comercio no encontrado');
    }

    return merchant;
  }

  /**
   * Normaliza redes a { red: urlHttps }. Acepta URL completa o @usuario
   * (Instagram/Facebook/TikTok) y teléfono o URL (WhatsApp → wa.me).
   * Claves desconocidas se ignoran; todo vacío → null (sin redes).
   */
  private static normalizeSocials(input: unknown): Record<string, string> | null {
    if (input == null || typeof input !== 'object' || Array.isArray(input)) return null;
    const out: Record<string, string> = {};
    const handle = (v: string) => v.trim().replace(/^@+/, '').replace(/\/+$/, '');
    const asUrl = (v: string, base: string) => {
      const t = handle(v);
      if (!t) return null;
      if (/^https:\/\//i.test(t)) return t.slice(0, 300);
      if (/^[\w.]{1,30}$/.test(t)) return `${base}${t}`;
      return null;
    };
    const src = input as Record<string, unknown>;
    const ig =
      typeof src.instagram === 'string' ? asUrl(src.instagram, 'https://instagram.com/') : null;
    if (ig) out.instagram = ig;
    const fb =
      typeof src.facebook === 'string' ? asUrl(src.facebook, 'https://facebook.com/') : null;
    if (fb) out.facebook = fb;
    const tk = typeof src.tiktok === 'string' ? asUrl(src.tiktok, 'https://tiktok.com/@') : null;
    if (tk) out.tiktok = tk;
    if (typeof src.whatsapp === 'string') {
      const w = src.whatsapp.trim();
      if (/^https:\/\//i.test(w)) {
        out.whatsapp = w.slice(0, 300);
      } else {
        const digits = w.replace(/\D/g, '');
        const local = digits.length === 11 && digits.startsWith('506') ? digits.slice(3) : digits;
        if (/^\d{8}$/.test(local)) out.whatsapp = `https://wa.me/506${local}`;
      }
    }
    if (typeof src.website === 'string' && /^https:\/\/\S+$/i.test(src.website.trim())) {
      out.website = src.website.trim().slice(0, 300);
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  async updateProfile(userId: string, data: any) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!merchant) {
      throw new NotFoundException('Perfil de comercio no encontrado');
    }

    const extra: Record<string, unknown> = {};
    if (data.category !== undefined) {
      if (!isMerchantCategory(data.category)) {
        throw new BadRequestException('Categoría inválida');
      }
      extra.category = data.category;
    }
    // Logo: URL https (foto subida) o emoji elegido (funciona sin
    // Cloudinary). Se valida esquema para no guardar cualquier string que
    // rompería <img> en la app cliente.
    if (data.logoUrl !== undefined) {
      if (data.logoUrl === null || String(data.logoUrl).trim() === '') {
        extra.logoUrl = null;
      } else {
        const logo = String(data.logoUrl).trim();
        const isHttp = /^https:\/\/\S+$/i.test(logo);
        const isEmoji = logo.length <= 8 && /[^\u0000-\u007F]/.test(logo);
        if (!isHttp && !isEmoji) {
          throw new BadRequestException('Logo inválido (URL https o emoji)');
        }
        extra.logoUrl = logo.slice(0, 500);
      }
    }
    // Redes sociales: se acepta URL https o @usuario (IG/FB/TikTok) y
    // teléfono o URL para WhatsApp. Todo se guarda normalizado a https.
    if (data.socials !== undefined) {
      extra.socials = MerchantsService.normalizeSocials(data.socials);
    }
    // SINPE para cobrar directo al cliente (links "lo paga el cliente"):
    // 8 dígitos CR (8888-8888) o vacío para usar el teléfono de la cuenta.
    if (data.sinpeNumber !== undefined) {
      const digits = String(data.sinpeNumber ?? '').replace(/\D/g, '');
      const local = digits.length === 11 && digits.startsWith('506') ? digits.slice(3) : digits;
      if (local !== '' && !/^\d{8}$/.test(local)) {
        throw new BadRequestException('SINPE inválido (8 dígitos, ej. 8888-8888)');
      }
      extra.sinpeNumber = local === '' ? null : `${local.slice(0, 4)}-${local.slice(4)}`;
    }

    return this.prisma.merchantProfile.update({
      where: { userId },
      data: {
        businessName: data.businessName,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        description: data.description,
        openingHours: data.openingHours,
        ...extra,
      },
    });
  }

  async addFavoriteDriver(merchantId: string, driverId: string) {
    return this.prisma.favoriteDriver.create({
      data: {
        merchantId,
        driverId,
      },
    });
  }

  async removeFavoriteDriver(merchantId: string, driverId: string) {
    return this.prisma.favoriteDriver.deleteMany({
      where: {
        merchantId,
        driverId,
      },
    });
  }

  async getFavoriteDrivers(merchantId: string) {
    return this.prisma.favoriteDriver.findMany({
      where: { merchantId },
      include: {
        driver: true,
      },
    });
  }

  /** Veto: el comercio no quiere a este repartidor en sus pedidos. */
  async addVetoedDriver(
    merchantId: string,
    driverId: string,
    reason?: string,
    createdByUserId?: string,
  ) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Repartidor no encontrado');
    try {
      return await this.prisma.merchantDriverVeto.create({
        data: {
          merchantId,
          driverId,
          reason: reason?.trim() || null,
          createdByUserId: createdByUserId ?? null,
        },
        include: { driver: true },
      });
    } catch (e: any) {
      // Ya vetado: idempotente, devolver el existente.
      if (e?.code === 'P2002') {
        return this.prisma.merchantDriverVeto.findUnique({
          where: { merchantId_driverId: { merchantId, driverId } },
          include: { driver: true },
        });
      }
      throw e;
    }
  }

  async removeVetoedDriver(merchantId: string, driverId: string) {
    return this.prisma.merchantDriverVeto.deleteMany({
      where: { merchantId, driverId },
    });
  }

  async getVetoedDrivers(merchantId: string) {
    return this.prisma.merchantDriverVeto.findMany({
      where: { merchantId },
      include: { driver: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
