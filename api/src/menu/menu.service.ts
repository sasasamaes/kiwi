// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toCRDateKey, crWeekday } from '../common/costa-rica-time';
import { isOpenNow, offeredToday } from '../merchants/opening-hours';

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Get merchant public profile (for client menu page)
   */
  async getMerchantPublicProfile(merchantId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        businessName: true,
        address: true,
        description: true,
        logoUrl: true,
        latitude: true,
        longitude: true,
        openingHours: true,
        createdAt: true,
        cardPaymentsEnabled: true,
        cashEnabled: true,
        sinpeEnabled: true,
        category: true,
        isHomeCook: true,
        socials: true,
      },
    });

    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }

    // Get average rating
    const ratings = await this.prisma.rating.aggregate({
      where: { merchantId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Count active orders (for approximate delivery time)
    const activeOrders = await this.prisma.order.count({
      where: {
        merchantId,
        status: { in: ['pending', 'assigned', 'in_transit_to_pickup', 'picked_up'] },
      },
    });

    return {
      ...merchant,
      rating: ratings._avg.rating ? Number(ratings._avg.rating) : 5.0,
      totalRatings: ratings._count.rating,
      activeOrders,
      isOpen: this.isOpen(merchant.openingHours as any),
    };
  }

  /**
   * Get menu items for a merchant
   */
  async getMenuItems(merchantId: string, category?: string) {
    // Verify merchant exists
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }

    const where: any = {
      merchantId,
      isAvailable: true,
    };

    if (category && category !== 'Todos') {
      where.category = category;
    }

    const items = await this.prisma.menuItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { isPopular: 'desc' }, { name: 'asc' }],
      include: {
        kiosk: { select: { id: true, name: true } },
        variantGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    // Kioskos activos del comercio (secciones del menú con su historia).
    const kiosks = await (this.prisma as any).merchantKiosk.findMany({
      where: { merchantId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, description: true, imageUrl: true, sortOrder: true },
    });

    // Días disponibles: lo que no se ofrece hoy no se muestra (menú del día,
    // "solo jueves"). Vacío = todos los días. Agotado (stock 0) tampoco.
    // Vitrina de mañana: lo de mañana SÍ se muestra, marcado para preventa
    // ("mañana venden rollos"): el cliente lo pide hoy programado.
    const tomorrow = (crWeekday(new Date()) + 1) % 7;
    const offered = items.filter(
      (item) =>
        (offeredToday((item as any).availableDays ?? []) ||
          ((item as any).availableDays ?? []).includes(tomorrow)) &&
        (item as any).stockQty !== 0,
    );

    // Group by category (solo de lo visible hoy: sin pills vacías).
    const categories = [...new Set(offered.map((item) => item.category))];

    return {
      items: offered.map((item) => ({
        ...item,
        price: Number(item.price),
        availableDays: (item as any).availableDays ?? [],
        // Solo-mañana (no hoy): la app lo pinta en la sección de preventa.
        offeredTomorrow:
          !offeredToday((item as any).availableDays ?? []) &&
          ((item as any).availableDays ?? []).includes(tomorrow),
        kiosk: (item as any).kiosk ?? null,
        variantGroups: (item as any).variantGroups.map((g: any) => ({
          ...g,
          options: g.options.map((o: any) => ({ ...o, priceDelta: Number(o.priceDelta) })),
        })),
      })),
      categories: ['Todos', ...categories],
      kiosks: kiosks.map((k: any) => ({
        id: k.id,
        name: k.name,
        description: k.description,
        imageUrl: k.imageUrl,
        sortOrder: k.sortOrder,
      })),
    };
  }

  /**
   * Vitrina de mañana ("mañana venden rollos"): comercios con productos que
   * se ofrecen mañana (no necesariamente hoy), para promocionar la preventa
   * el día antes. Una sola query, topeado para el home del cliente.
   */
  async tomorrowPreview(citySlug = 'nicoya') {
    const city = String(citySlug || 'nicoya')
      .trim()
      .toLowerCase();
    const tomorrow = (crWeekday(new Date()) + 1) % 7;
    const rows = await this.prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        NOT: { stockQty: 0 },
        availableDays: { has: tomorrow },
        merchant: { isListed: true, citySlug: city, user: { status: 'active' } },
      },
      orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
      take: 60,
      select: {
        id: true,
        name: true,
        price: true,
        image: true,
        stockQty: true,
        dailyQty: true,
        fulfillNote: true,
        merchant: {
          select: { id: true, businessName: true, logoUrl: true, isHomeCook: true },
        },
      },
    });
    const byMerchant = new Map<string, any>();
    for (const r of rows) {
      const m = r.merchant as any;
      if (!byMerchant.has(m.id)) {
        byMerchant.set(m.id, {
          merchantId: m.id,
          businessName: m.businessName,
          logoUrl: m.logoUrl,
          isHomeCook: (m as any).isHomeCook ?? false,
          items: [],
        });
        if (byMerchant.size >= 10) break;
      }
      const entry = byMerchant.get(m.id);
      if (entry.items.length < 3) {
        entry.items.push({
          id: r.id,
          name: r.name,
          price: Number(r.price),
          image: r.image,
          stockQty: r.stockQty,
          fulfillNote: r.fulfillNote,
        });
      }
    }
    return { items: [...byMerchant.values()] };
  }

  /**
   * Get all menu items for a merchant (including unavailable, for merchant dashboard)
   */
  async getMerchantMenuItems(userId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!merchant) {
      throw new NotFoundException('Perfil de comerciante no encontrado');
    }

    const items = await this.prisma.menuItem.findMany({
      where: { merchantId: merchant.id },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        kiosk: { select: { id: true, name: true } },
        variantGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    return items.map((item) => ({
      ...item,
      price: Number(item.price),
      variantGroups: (item as any).variantGroups.map((g: any) => ({
        ...g,
        options: g.options.map((o: any) => ({ ...o, priceDelta: Number(o.priceDelta) })),
      })),
    }));
  }

  /**
   * Kioskos del comercio dueño (panel). Incluye inactivos para poder
   * reactivarlos; la app cliente solo ve activos.
   */
  async listMyKiosks(userId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Perfil de comerciante no encontrado');
    return (this.prisma as any).merchantKiosk.findMany({
      where: { merchantId: merchant.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private static normalizeKioskInput(data: any): {
    name?: string;
    description?: null | string;
    imageUrl?: null | string;
    active?: boolean;
    sortOrder?: number;
  } {
    const out: Record<string, any> = {};
    if (data.name !== undefined) {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name || name.length > 80) {
        throw new BadRequestException('Nombre del kiosko requerido (máx 80 caracteres)');
      }
      out.name = name;
    }
    if (data.description !== undefined) {
      if (data.description != null && typeof data.description !== 'string') {
        throw new BadRequestException('Historia inválida');
      }
      const d = data.description?.trim() || null;
      if (d && d.length > 2000) throw new BadRequestException('Historia muy larga (máx 2000)');
      out.description = d;
    }
    if (data.imageUrl !== undefined) {
      if (data.imageUrl != null && typeof data.imageUrl !== 'string') {
        throw new BadRequestException('Imagen inválida');
      }
      const u = data.imageUrl?.trim() || null;
      if (u && (u.length > 256 || !/^https:\/\//.test(u))) {
        throw new BadRequestException('Imagen inválida (URL https corta)');
      }
      out.imageUrl = u;
    }
    if (data.active !== undefined) out.active = Boolean(data.active);
    if (data.sortOrder !== undefined) {
      const n = Math.floor(Number(data.sortOrder));
      if (!Number.isFinite(n) || n < 0 || n > 9999) {
        throw new BadRequestException('Orden inválido');
      }
      out.sortOrder = n;
    }
    return out;
  }

  async createKiosk(userId: string, data: any) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Perfil de comerciante no encontrado');
    const input = MenuService.normalizeKioskInput(data);
    if (!input.name) throw new BadRequestException('Nombre del kiosko requerido');
    const count = await (this.prisma as any).merchantKiosk.count({
      where: { merchantId: merchant.id },
    });
    if (count >= 30) throw new BadRequestException('Máximo 30 kioskos por comercio');
    const last = await (this.prisma as any).merchantKiosk.findFirst({
      where: { merchantId: merchant.id },
      orderBy: { sortOrder: 'desc' },
    });
    return (this.prisma as any).merchantKiosk.create({
      data: {
        merchantId: merchant.id,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        active: input.active ?? true,
        sortOrder: input.sortOrder ?? (last?.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateKiosk(userId: string, kioskId: string, data: any) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Perfil de comerciante no encontrado');
    const kiosk: any = await (this.prisma as any).merchantKiosk.findUnique({
      where: { id: kioskId },
    });
    if (!kiosk || kiosk.merchantId !== merchant.id) {
      throw new ForbiddenException('No puedes editar este kiosko');
    }
    const input = MenuService.normalizeKioskInput(data);
    if (Object.keys(input).length === 0) throw new BadRequestException('Nada que actualizar');
    return (this.prisma as any).merchantKiosk.update({ where: { id: kioskId }, data: input });
  }

  async deleteKiosk(userId: string, kioskId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Perfil de comerciante no encontrado');
    const kiosk: any = await (this.prisma as any).merchantKiosk.findUnique({
      where: { id: kioskId },
    });
    if (!kiosk || kiosk.merchantId !== merchant.id) {
      throw new ForbiddenException('No puedes borrar este kiosko');
    }
    // Los productos quedan (kioskId → null por SetNull).
    await (this.prisma as any).merchantKiosk.delete({ where: { id: kioskId } });
    return { deleted: true };
  }

  /**
   * Valida que el kiosko exista y sea del comercio. ''/null = sin kiosko
   * (directo del comercio). Otros dueños → 403 (no enumerar por error).
   */
  private async resolveKioskId(merchantId: string, kioskId: unknown): Promise<string | null> {
    if (kioskId === undefined || kioskId === null || String(kioskId).trim() === '') return null;
    const kiosk: any = await (this.prisma as any).merchantKiosk.findUnique({
      where: { id: String(kioskId) },
    });
    if (!kiosk || kiosk.merchantId !== merchantId) {
      throw new ForbiddenException('Kiosko inválido');
    }
    return kiosk.id;
  }

  /**
   * Validate & normalize menu item input. The controller passes raw body —
   * without this, a string/oversized price or missing name/category reached
   * Prisma and surfaced as 500s, and negative prices were accepted.
   */
  private static normalizeItemInput(data: any, { requireAll }: { requireAll: boolean }) {
    const out: Record<string, any> = {};

    if (data.name !== undefined || requireAll) {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name || name.length > 100) {
        throw new BadRequestException('Nombre requerido (máx 100 caracteres)');
      }
      out.name = name;
    }
    if (data.category !== undefined || requireAll) {
      const category = typeof data.category === 'string' ? data.category.trim() : '';
      if (!category || category.length > 50) {
        throw new BadRequestException('Categoría requerida (máx 50 caracteres)');
      }
      out.category = category;
    }
    if (data.price !== undefined || requireAll) {
      const price = Number(data.price);
      if (!Number.isFinite(price) || price < 0) {
        throw new BadRequestException('Precio inválido (debe ser un número ≥ 0)');
      }
      // Decimal(10,2): cap at 99,999,999.99 to avoid Prisma P2000 500s.
      if (price > 99999999.99) {
        throw new BadRequestException('Precio fuera de rango');
      }
      out.price = Math.round(price * 100) / 100;
    }
    if (data.description !== undefined) {
      if (data.description != null && typeof data.description !== 'string') {
        throw new BadRequestException('Descripción inválida');
      }
      out.description = data.description?.trim() || null;
    }
    if (data.image !== undefined) {
      if (data.image != null && typeof data.image !== 'string') {
        throw new BadRequestException('Imagen inválida');
      }
      // Campo acotado: en la práctica es un emoji o URL corta (así lo usan
      // las apps); nada legítimo supera 256 chars — bloquea payloads gigantes
      // y data-URIs base64 escondidos en el JSON.
      if (data.image != null && data.image.length > 256) {
        throw new BadRequestException('Imagen demasiado larga (máx 256)');
      }
      // Sentinel legacy: el form del merchant guardaba el NOMBRE del icono
      // lucide ('Utensils') cuando no se elegía emoji, y el client app lo
      // pintaba como texto literal. Normalizado a null (= sin imagen).
      if (data.image === 'Utensils') {
        out.image = null;
      } else {
        out.image = data.image;
      }
    }
    if (data.isPopular !== undefined) out.isPopular = Boolean(data.isPopular);
    if (data.isAvailable !== undefined) out.isAvailable = Boolean(data.isAvailable);
    // Nota de entrega programada ("Se entrega el jueves a las 2:00 p. m.").
    if (data.fulfillNote !== undefined) {
      if (data.fulfillNote === null || String(data.fulfillNote).trim() === '') {
        out.fulfillNote = null;
      } else if (typeof data.fulfillNote !== 'string' || data.fulfillNote.trim().length > 120) {
        throw new BadRequestException('fulfillNote inválida (máx 120 caracteres)');
      } else {
        out.fulfillNote = data.fulfillNote.trim();
      }
    }
    // Stock por día de venta (ej. 50 rollos). Null/vacío = sin límite.
    for (const key of ['stockQty', 'dailyQty'] as const) {
      if (data[key] !== undefined) {
        if (data[key] === null || data[key] === '') {
          out[key] = null;
        } else {
          const n = Math.floor(Number(data[key]));
          if (!Number.isFinite(n) || n < 0 || n > 999999) {
            throw new BadRequestException(`${key} inválido (0–999999)`);
          }
          out[key] = n;
        }
      }
    }
    // Días en que se ofrece (0=dom…6=sáb). Vacío/ausente = todos los días.
    if (data.availableDays !== undefined) {
      if (!Array.isArray(data.availableDays)) {
        throw new BadRequestException('availableDays debe ser un arreglo');
      }
      const days: number[] = (data.availableDays as any[]).map((d: any) => Number(d));
      const unique: number[] = [...new Set(days)];
      if (unique.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        throw new BadRequestException('availableDays: días inválidos (0–6)');
      }
      out.availableDays = unique;
    }

    return out;
  }

  /**
   * Validate & normalize variant groups. Prices/deltas never come from the
   * client at order time — but they ARE merchant input here, so validate
   * ranges and shapes to avoid Prisma 500s.
   */
  private static normalizeVariants(data: any):
    | Array<{
        name: string;
        required: boolean;
        multiple: boolean;
        maxSelections: number | null;
        options: Array<{ name: string; priceDelta: number; isAvailable: boolean }>;
      }>
    | undefined {
    if (data.variants === undefined) return undefined;
    if (!Array.isArray(data.variants)) {
      throw new BadRequestException('variants debe ser un arreglo');
    }
    if (data.variants.length > 20) {
      throw new BadRequestException('Máximo 20 grupos de variantes');
    }
    return data.variants.map((g: any, gi: number) => {
      const name = typeof g?.name === 'string' ? g.name.trim() : '';
      if (!name || name.length > 50) {
        throw new BadRequestException(`Grupo ${gi + 1}: nombre requerido (máx 50)`);
      }
      if (!Array.isArray(g?.options) || g.options.length === 0) {
        throw new BadRequestException(`Grupo "${name}": necesita al menos una opción`);
      }
      if (g.options.length > 30) {
        throw new BadRequestException(`Grupo "${name}": máximo 30 opciones`);
      }
      // Tope de elegibles (ej. 3 frutas). Solo tiene sentido en múltiple;
      // en simple el tope es 1 por naturaleza y se ignora.
      let maxSelections: number | null = null;
      if (g?.maxSelections !== undefined && g?.maxSelections !== null && g?.maxSelections !== '') {
        const max = Number(g.maxSelections);
        if (!Number.isInteger(max) || max < 1 || max > 30) {
          throw new BadRequestException(`Grupo "${name}": tope inválido (1–30)`);
        }
        maxSelections = max;
      }
      return {
        name,
        required: Boolean(g.required),
        multiple: Boolean(g.multiple),
        maxSelections,
        options: g.options.map((o: any, oi: number) => {
          const oname = typeof o?.name === 'string' ? o.name.trim() : '';
          if (!oname || oname.length > 50) {
            throw new BadRequestException(
              `Grupo "${name}" opción ${oi + 1}: nombre requerido (máx 50)`,
            );
          }
          const delta = Number(o?.priceDelta ?? 0);
          if (!Number.isFinite(delta) || delta < -99999999.99 || delta > 99999999.99) {
            throw new BadRequestException(`Grupo "${name}" opción "${oname}": priceDelta inválido`);
          }
          return {
            name: oname,
            priceDelta: Math.round(delta * 100) / 100,
            isAvailable: o?.isAvailable ?? true,
          };
        }),
      };
    });
  }

  /**
   * Create a menu item
   */
  async createMenuItem(userId: string, data: any) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!merchant) {
      throw new NotFoundException('Perfil de comerciante no encontrado');
    }

    const input = MenuService.normalizeItemInput(data, { requireAll: true });
    const variants = MenuService.normalizeVariants(data);
    const kioskId = await this.resolveKioskId(merchant.id, (data as any).kioskId);

    // Get next sort order
    const lastItem = await this.prisma.menuItem.findFirst({
      where: { merchantId: merchant.id, category: input.category },
      orderBy: { sortOrder: 'desc' },
    });

    return this.prisma.menuItem.create({
      data: {
        merchantId: merchant.id,
        name: input.name,
        description: input.description,
        price: input.price,
        image: input.image,
        category: input.category,
        kioskId,
        isPopular: input.isPopular || false,
        isAvailable: input.isAvailable ?? true,
        sortOrder: (lastItem?.sortOrder || 0) + 1,
        ...(variants
          ? {
              variantGroups: {
                create: variants.map((g, gi) => ({
                  name: g.name,
                  required: g.required,
                  multiple: g.multiple,
                  maxSelections: g.maxSelections,
                  sortOrder: gi,
                  options: {
                    create: g.options.map((o, oi) => ({ ...o, sortOrder: oi })),
                  },
                })),
              },
            }
          : {}),
      },
      include: {
        variantGroups: { include: { options: true } },
      },
    });
  }

  /**
   * Update a menu item
   */
  async updateMenuItem(userId: string, itemId: string, data: any) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!merchant) {
      throw new NotFoundException('Perfil de comerciante no encontrado');
    }

    // Verify item belongs to this merchant
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.merchantId !== merchant.id) {
      throw new ForbiddenException('No puedes editar este artículo');
    }

    const input = MenuService.normalizeItemInput(data, { requireAll: false });
    const variants = MenuService.normalizeVariants(data);
    if ((data as any).kioskId !== undefined) {
      input.kioskId = await this.resolveKioskId(merchant.id, (data as any).kioskId);
    }
    // Ajuste RELATIVO de stock (+N/−N, atómico): suma sobre lo que haya en
    // ese instante, así una venta concurrente no se pierde (el absoluto la
    // pisaría). Si viene adjust, el stockQty absoluto se ignora.
    let stockAdjust: number | undefined;
    if ((data as any).stockAdjust !== undefined && (data as any).stockAdjust !== null) {
      const n = Math.trunc(Number((data as any).stockAdjust));
      if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 999999) {
        throw new BadRequestException('stockAdjust inválido (distinto de 0, máx ±999999)');
      }
      if ((item as any).stockQty == null) {
        throw new BadRequestException(
          'Sin control de stock: primero fijá la cantidad por día (lote)',
        );
      }
      stockAdjust = n;
      delete (input as any).stockQty;
    }
    if (Object.keys(input).length === 0 && variants === undefined && stockAdjust === undefined) {
      throw new BadRequestException('Nada que actualizar');
    }
    // Si el comercio toca el stock a mano, el día vigente es hoy (hora CR):
    // evita que la reposición automática del lote lo pise con el día viejo.
    if (input.stockQty !== undefined || input.dailyQty !== undefined || stockAdjust !== undefined) {
      input.stockDay = toCRDateKey(new Date());
    }

    return this.prisma
      .$transaction(async (tx) => {
        if (variants !== undefined) {
          // Replace strategy: modifier setup is small and fully owned here.
          await tx.menuItemVariantGroup.deleteMany({ where: { menuItemId: itemId } });
          if (variants.length > 0) {
            await tx.menuItemVariantGroup.createMany({
              data: variants.map((g, gi) => ({
                menuItemId: itemId,
                name: g.name,
                required: g.required,
                multiple: g.multiple,
                maxSelections: g.maxSelections,
                sortOrder: gi,
              })),
            });
            const groups = await tx.menuItemVariantGroup.findMany({
              where: { menuItemId: itemId },
              orderBy: { sortOrder: 'asc' },
            });
            for (let gi = 0; gi < groups.length; gi++) {
              const opts = variants[gi].options;
              if (opts.length > 0) {
                await tx.menuItemVariantOption.createMany({
                  data: opts.map((o, oi) => ({
                    groupId: groups[gi].id,
                    name: o.name,
                    priceDelta: o.priceDelta,
                    isAvailable: o.isAvailable,
                    sortOrder: oi,
                  })),
                });
              }
            }
          }
        }
        return tx.menuItem
          .update({
            where: { id: itemId },
            data: {
              ...input,
              // Ajuste atómico sobre el valor vigente (no pisa ventas
              // concurrentes). Piso en 0: el stock nunca queda negativo.
              ...(stockAdjust !== undefined ? { stockQty: { increment: stockAdjust } } : {}),
            },
            include: { variantGroups: { include: { options: true } } },
          })
          .then(async (row: any) => {
            if (stockAdjust !== undefined && (row.stockQty ?? 0) < 0) {
              return tx.menuItem.update({
                where: { id: itemId },
                data: { stockQty: 0 },
                include: { variantGroups: { include: { options: true } } },
              });
            }
            return row;
          });
      })
      .then((updated) => {
        // Reposición 0 → con stock: avisar a seguidores (best-effort, nunca
        // traba el guardado).
        try {
          const before = (item as any).stockQty as number | null;
          const after = (updated as any).stockQty as number | null;
          if (before === 0 && typeof after === 'number' && after > 0) {
            void this.notifications
              .notifyFollowers(merchant.id, {
                title: `🧡 ¡Volvió ${(updated as any).name}!`,
                body: `${merchant.businessName} repuso stock — quedan ${after}. Pedilo antes de que se acabe.`,
                data: { kind: 'restock', menuItemId: itemId },
              })
              .catch(() => undefined);
          }
        } catch {
          // noop
        }
        return updated;
      });
  }

  /**
   * Delete a menu item
   */
  async deleteMenuItem(userId: string, itemId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!merchant) {
      throw new NotFoundException('Perfil de comerciante no encontrado');
    }

    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.merchantId !== merchant.id) {
      throw new ForbiddenException('No puedes eliminar este artículo');
    }

    // OrderItems restrict-delete the menu item: check first to return 409
    // instead of a P2003 500.
    const referencingOrders = await this.prisma.orderItem.count({
      where: { menuItemId: itemId },
    });
    if (referencingOrders > 0) {
      throw new ConflictException(
        'No se puede eliminar: el artículo está en pedidos existentes. Desactívalo en su lugar.',
      );
    }

    await this.prisma.menuItem.delete({
      where: { id: itemId },
    });

    return { success: true };
  }

  /**
   * Check if merchant is open based on opening hours (hora Costa Rica).
   */
  private isOpen(openingHours: any): boolean {
    return isOpenNow(openingHours);
  }
}
