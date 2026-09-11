import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

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
    });

    // Group by category
    const categories = [...new Set(items.map((item) => item.category))];

    return {
      items: items.map((item) => ({
        ...item,
        price: Number(item.price),
      })),
      categories: ['Todos', ...categories],
    };
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
    });

    return items.map((item) => ({
      ...item,
      price: Number(item.price),
    }));
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
      out.image = data.image;
    }
    if (data.isPopular !== undefined) out.isPopular = Boolean(data.isPopular);
    if (data.isAvailable !== undefined) out.isAvailable = Boolean(data.isAvailable);

    return out;
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
        isPopular: input.isPopular || false,
        isAvailable: input.isAvailable ?? true,
        sortOrder: (lastItem?.sortOrder || 0) + 1,
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
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('Nada que actualizar');
    }

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: input,
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
   * Check if merchant is open based on opening hours
   */
  private isOpen(openingHours: any): boolean {
    if (!openingHours) return true; // Default to open if no hours set

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const todayHours = openingHours[currentDay];
    if (!todayHours) return false;

    return currentTime >= todayHours.open && currentTime <= todayHours.close;
  }
}
