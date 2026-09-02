import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async getAvailableDrivers(latitude?: number, longitude?: number) {
    return this.prisma.driverProfile.findMany({
      where: {
        status: 'available',
        kycStatus: 'approved',
      },
      include: {
        user: {
          select: {
            phone: true,
          },
        },
      },
      orderBy: {
        rating: 'desc',
      },
    });
  }

  async updateSchedule(userId: string, schedules: any[]) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Delete existing schedules
    await this.prisma.driverSchedule.deleteMany({
      where: { driverId: driver.id },
    });

    // Create new schedules
    return this.prisma.driverSchedule.createMany({
      data: schedules.map((schedule) => ({
        driverId: driver.id,
        dayOfWeek: schedule.dayOfWeek,
        startTime: new Date(schedule.startTime),
        endTime: new Date(schedule.endTime),
        isAvailable: schedule.isAvailable ?? true,
      })),
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

    // Get completed orders
    const orders = await this.prisma.order.findMany({
      where,
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
      .sort((a, b) => a.date.localeCompare(b.date))

    // Transaction list
    const transactions = orders.map((order) => ({
      id: order.id,
      merchantName: 'Comercio',
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
