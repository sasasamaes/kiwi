// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isMerchantCategory } from './merchant-category';

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
   * Aviso a seguidores ("mañana vendo rollos", "ya hay comida del día").
   * Tope 3/día por comercio (antispam): el log son las filas inbox enviadas.
   */
  async announceToFollowers(
    userId: string,
    input: { title?: unknown; body?: unknown },
  ): Promise<{ reached: number }> {
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
    return this.notifications.notifyFollowers(merchant.id, {
      title: `🧡 ${merchant.businessName}: ${title}`,
      body,
      data: { kind: 'announce' },
    });
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
}
