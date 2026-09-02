import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
      orderBy: [
        { sortOrder: 'asc' },
        { isPopular: 'desc' },
        { name: 'asc' },
      ],
    });

    // Group by category
    const categories = [...new Set(items.map(item => item.category))];

    return {
      items: items.map(item => ({
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
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return items.map(item => ({
      ...item,
      price: Number(item.price),
    }));
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

    // Get next sort order
    const lastItem = await this.prisma.menuItem.findFirst({
      where: { merchantId: merchant.id, category: data.category },
      orderBy: { sortOrder: 'desc' },
    });

    return this.prisma.menuItem.create({
      data: {
        merchantId: merchant.id,
        name: data.name,
        description: data.description,
        price: data.price,
        image: data.image,
        category: data.category,
        isPopular: data.isPopular || false,
        isAvailable: data.isAvailable ?? true,
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

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        image: data.image,
        category: data.category,
        isPopular: data.isPopular,
        isAvailable: data.isAvailable,
        sortOrder: data.sortOrder,
      },
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
