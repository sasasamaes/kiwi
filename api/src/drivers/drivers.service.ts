import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_DRIVER_STATUSES = ['offline', 'available', 'busy'] as const;

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const driver = await this.prisma.driverProfile.findUnique({
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
        schedules: true,
        incentives: true,
        _count: {
          select: {
            orders: true,
            ratings: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Repartidor no encontrado');
    }

    return driver;
  }

  async findByUserId(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        schedules: true,
        incentives: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    return driver;
  }

  async updateProfile(userId: string, data: any) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    return this.prisma.driverProfile.update({
      where: { userId },
      data: {
        fullName: data.fullName,
        vehicleType: data.vehicleType,
        vehiclePlate: data.vehiclePlate,
        photoUrl: data.photoUrl,
      },
    });
  }

  async updateStatus(userId: string, status: string) {
    if (!(VALID_DRIVER_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException(
        `Estado inválido: ${status}. Válidos: ${VALID_DRIVER_STATUSES.join(', ')}`,
      );
    }

    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    return this.prisma.driverProfile.update({
      where: { userId },
      data: { status: status as any },
    });
  }

  /**
   * Real directory of drivers for merchants: every driver profile, whatever
   * their current status. Merchants must be able to SEE (and favorite) the
   * driver they just recruited even if he is offline or pending KYC —
   * availability for assignment is enforced at assignment time, not by
   * hiding people from the list.
   */
  async getAvailableDrivers(latitude?: number, longitude?: number) {
    return this.prisma.driverProfile.findMany({
      include: {
        user: {
          select: {
            phone: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { rating: 'desc' }],
    });
  }

  async updateSchedule(userId: string, schedules: any[]) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Validate before touching the DB: delete-then-create without a
    // transaction would lose the whole agenda if the create fails.
    const rows = schedules.map((schedule) => {
      const dayOfWeek = Number(schedule.dayOfWeek);
      const startTime = new Date(schedule.startTime);
      const endTime = new Date(schedule.endTime);
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        throw new BadRequestException(`dayOfWeek inválido: ${schedule.dayOfWeek} (0-6)`);
      }
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new BadRequestException('Horario con fechas inválidas');
      }
      if (startTime >= endTime) {
        throw new BadRequestException('startTime debe ser anterior a endTime');
      }
      return {
        driverId: driver.id,
        dayOfWeek,
        startTime,
        endTime,
        isAvailable: schedule.isAvailable ?? true,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.driverSchedule.deleteMany({ where: { driverId: driver.id } });
      if (rows.length > 0) {
        return tx.driverSchedule.createMany({ data: rows });
      }
      return { count: 0 };
    });
  }

  async getSchedules(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    return this.prisma.driverSchedule.findMany({
      where: { driverId: driver.id },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // In-memory location cache (in production, use Redis)
  private driverLocations: Map<string, { lat: number; lng: number; updatedAt: Date }> = new Map();

  async updateLocation(userId: string, lat: number, lng: number, orderId?: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Store location in memory (in production, use Redis with TTL)
    this.driverLocations.set(driver.id, {
      lat,
      lng,
      updatedAt: new Date(),
    });

    return {
      driverId: driver.id,
      lat,
      lng,
      updatedAt: new Date(),
    };
  }

  async getLocation(driverId: string) {
    const location = this.driverLocations.get(driverId);

    if (!location) {
      // No fix ever reported: coords are map-center fallback only.
      // Consumers must check `known === false` / isStale before plotting.
      return {
        driverId,
        lat: 10.1483,
        lng: -85.4527,
        updatedAt: null,
        isStale: true,
        known: false,
      };
    }

    // Check if location is stale (> 5 minutes old)
    const isStale = Date.now() - location.updatedAt.getTime() > 5 * 60 * 1000;

    return {
      driverId,
      lat: location.lat,
      lng: location.lng,
      updatedAt: location.updatedAt,
      isStale,
      known: true,
    };
  }

  /**
   * Row-level guard for live GPS: the driver himself, a participant of one of
   * his ACTIVE orders (merchant owner or the assigned driver himself), or an
   * admin. Delivered/cancelled orders no longer grant tracking access.
   */
  async getLocationForUser(driverId: string, user: { sub?: string; role?: string }) {
    if (user?.role === 'admin') {
      return this.getLocation(driverId);
    }

    const userId = user?.sub;
    if (userId) {
      const profile = await this.prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (profile?.id === driverId) {
        return this.getLocation(driverId);
      }

      const activeOrder = await this.prisma.order.findFirst({
        where: {
          driverId,
          status: {
            in: ['assigned', 'in_transit_to_pickup', 'picked_up', 'in_transit_to_delivery'],
          },
          OR: [{ merchant: { userId } }, { driver: { userId } }],
        },
        select: { id: true },
      });
      if (activeOrder) {
        return this.getLocation(driverId);
      }
    }

    throw new ForbiddenException('No tienes acceso a la ubicación de este repartidor');
  }

  async getEarnings(userId: string, period: string = 'all') {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date | undefined;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = undefined;
    }

    const where: any = {
      driverId: driver.id,
      status: 'delivered',
    };

    if (startDate) {
      where.deliveredAt = { gte: startDate };
    }

    // Get completed orders (merchant included for real names)
    const orders = await this.prisma.order.findMany({
      where,
      include: { merchant: { select: { businessName: true } } },
      orderBy: { deliveredAt: 'desc' },
    });

    // Calculate totals
    const totalEarnings = orders.reduce((sum, order) => sum + Number(order.driverPayout), 0);
    const totalTrips = orders.length;
    const averagePerTrip = totalTrips > 0 ? Math.round(totalEarnings / totalTrips) : 0;

    // Calculate hours (estimated 30 min per delivery)
    const totalHours = totalTrips * 0.5;
    const earningsPerHour = totalHours > 0 ? Math.round(totalEarnings / totalHours) : 0;

    // Daily breakdown for chart
    const dailyBreakdown: Record<string, number> = {};
    orders.forEach((order) => {
      const date = order.deliveredAt
        ? new Date(order.deliveredAt).toISOString().split('T')[0]
        : new Date(order.createdAt).toISOString().split('T')[0];
      dailyBreakdown[date] = (dailyBreakdown[date] || 0) + Number(order.driverPayout);
    });

    // Convert to array for chart
    const dailyData = Object.entries(dailyBreakdown)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Transaction list
    const transactions = orders.map((order) => ({
      id: order.id,
      merchantName: order.merchant?.businessName ?? 'Comercio',
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      amount: Number(order.driverPayout),
      date: order.deliveredAt || order.createdAt,
      orderType: order.orderType,
    }));

    return {
      period,
      totalEarnings,
      totalTrips,
      averagePerTrip,
      totalHours,
      earningsPerHour,
      daily: dailyData,
      transactions,
      summary: {
        today: 0, // Will be calculated separately if needed
        thisWeek: 0,
        thisMonth: 0,
        allTime: totalEarnings,
      },
    };
  }
}
