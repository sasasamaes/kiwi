// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsPeriod, AnalyticsQueryDto } from './dto/analytics-query.dto';
import { OrderStatus, PaymentStatus, UserStatus } from '@prisma/client';
import {
  startOfTodayCR,
  startOfMonthCR,
  startOfYearCR,
  toCRDateKey,
  crDayStartISO,
  crDayEndExclusiveISO,
} from '../common/costa-rica-time';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getMerchantAnalytics(userId: string, query: AnalyticsQueryDto) {
    const dateRange = this.getDateRange(query.period, query.startDate, query.endDate);

    // Order.merchantId is the PROFILE id, not the user id the controller
    // passes in: resolve it or every query below silently returns zeros.
    const merchantProfile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });
    if (!merchantProfile) {
      throw new NotFoundException('Perfil de comerciante no encontrado');
    }
    const merchantId = merchantProfile.id;

    const [orders, revenue, topItems, peakHours, customerStats] = await Promise.all([
      this.getOrderStats(merchantId, dateRange),
      this.getRevenueStats(merchantId, dateRange),
      this.getTopItems(merchantId, dateRange),
      this.getPeakHours(merchantId, dateRange),
      this.getCustomerStats(merchantId, dateRange),
    ]);

    return {
      period: query.period,
      dateRange,
      overview: {
        totalOrders: orders.total,
        totalRevenue: revenue.total,
        averageOrderValue: orders.total > 0 ? Math.round(revenue.total / orders.total) : 0,
        completionRate: orders.total > 0 ? Math.round((orders.completed / orders.total) * 100) : 0,
        averageDeliveryTime: orders.averageDeliveryTime,
        customerSatisfaction: customerStats.averageRating,
      },
      orders,
      revenue,
      topItems,
      peakHours,
      customerStats,
      trend: await this.getTrend(merchantId, dateRange),
    };
  }

  async getDriverAnalytics(userId: string, query: AnalyticsQueryDto) {
    const dateRange = this.getDateRange(query.period, query.startDate, query.endDate);

    // Order.driverId is the PROFILE id, not the user id: resolve it.
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }
    const driverId = driverProfile.id;

    const [deliveries, earnings, ratings, schedule] = await Promise.all([
      this.getDeliveryStats(driverId, dateRange),
      this.getEarningsStats(driverId, dateRange),
      this.getRatingStats(driverId, dateRange),
      this.getScheduleStats(driverId, dateRange),
    ]);

    return {
      period: query.period,
      dateRange,
      overview: {
        totalDeliveries: deliveries.total,
        totalEarnings: earnings.total,
        averageEarningPerDelivery:
          deliveries.total > 0 ? Math.round(earnings.total / deliveries.total) : 0,
        averageRating: ratings.average,
        completionRate:
          deliveries.total > 0 ? Math.round((deliveries.completed / deliveries.total) * 100) : 0,
        activeHours: schedule.activeHours,
      },
      deliveries,
      earnings,
      ratings,
      schedule,
      trend: await this.getDriverTrend(driverId, dateRange),
    };
  }

  async getPlatformAnalytics(query: AnalyticsQueryDto) {
    const dateRange = this.getDateRange(query.period, query.startDate, query.endDate);

    const [users, orders, revenue, growth] = await Promise.all([
      this.getUserStats(dateRange),
      this.getPlatformOrderStats(dateRange),
      this.getPlatformRevenueStats(dateRange),
      this.getGrowthStats(dateRange),
    ]);

    return {
      period: query.period,
      dateRange,
      overview: {
        totalUsers: users.total,
        activeUsers: users.active,
        totalOrders: orders.total,
        totalRevenue: revenue.total,
        averageOrderValue: orders.total > 0 ? Math.round(revenue.total / orders.total) : 0,
        platformFee: revenue.platformFee,
      },
      users,
      orders,
      revenue,
      growth,
    };
  }

  /**
   * Pulso en vivo para el admin: qué pasa AHORA en cada app.
   * Liviano (counts + 1 aggregate) para refrescar cada 30s sin dolor.
   */
  async getLivePulse() {
    const now = new Date();
    const todayStart = startOfTodayCR(now);

    const [driversByStatus, usersByRole, pendingOrders, activeOrders, todayStats] =
      await Promise.all([
        this.prisma.driverProfile.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        this.prisma.user.groupBy({
          by: ['role'],
          _count: { role: true },
          where: { status: 'active' },
        }),
        this.prisma.order.count({ where: { status: 'pending', driverId: null } }),
        this.prisma.order.count({
          where: {
            status: {
              in: ['assigned', 'in_transit_to_pickup', 'picked_up', 'in_transit_to_delivery'],
            },
          },
        }),
        this.prisma.order.aggregate({
          where: { status: OrderStatus.delivered, createdAt: { gte: todayStart }, isTest: false },
          _count: { id: true },
          _sum: { totalAmount: true, commission: true },
        }),
      ]);

    const drivers: Record<string, number> = {};
    for (const row of driversByStatus) drivers[row.status] = row._count.status;
    const users: Record<string, number> = {};
    for (const row of usersByRole) users[row.role] = row._count.role;

    return {
      at: now,
      drivers: {
        online: drivers['available'] ?? 0,
        offline: drivers['offline'] ?? 0,
        busy: drivers['busy'] ?? 0,
        total: Object.values(drivers).reduce((s, n) => s + n, 0),
      },
      users,
      orders: {
        waiting: pendingOrders,
        inProgress: activeOrders,
      },
      today: {
        delivered: todayStats._count.id,
        revenue: Number(todayStats._sum?.totalAmount || 0),
        platformFee: Number(todayStats._sum?.commission || 0),
      },
    };
  }

  /**
   * Ganancias Kiwi desde el inicio de operación real (lun 19 oct 2026 CR).
   * Todo antes de esa fecha fue test y se excluye.
   * Devuelve tarjetas día/semana/mes/desde-lanzamiento, ranking por
   * repartidor (cuánto ganó cada uno y cuánta comisión dejó) y el detalle
   * de pedidos entregados para auditar peso por peso.
   */
  async getKiwiEarnings() {
    // Lunes 19 oct 2026 00:00 CR = inicio de operación real.
    const launchStart = new Date('2026-10-19T00:00:00-06:00');
    const now = new Date();
    const todayStart = startOfTodayCR(now);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = startOfMonthCR(now, 0);

    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.delivered, deliveredAt: { gte: launchStart }, isTest: false },
      select: {
        id: true,
        deliveredAt: true,
        basePrice: true,
        commission: true,
        driverPayout: true,
        totalAmount: true,
        deliveryZone: true,
        driverId: true,
        merchant: { select: { businessName: true } },
        driver: { select: { fullName: true } },
      },
      orderBy: { deliveredAt: 'desc' },
      take: 1000,
    });

    const bucket = (from: Date) => {
      let trips = 0;
      let gmv = 0;
      let commission = 0;
      let driverPay = 0;
      for (const o of orders) {
        if (!o.deliveredAt || o.deliveredAt < from) continue;
        trips += 1;
        gmv += Number(o.basePrice ?? 0);
        commission += Number(o.commission ?? 0);
        driverPay += Number(o.driverPayout ?? 0);
      }
      return {
        trips,
        gmv: Math.round(gmv),
        commission: Math.round(commission),
        driverPay: Math.round(driverPay),
      };
    };

    const byDay: Record<
      string,
      { trips: number; commission: number; driverPay: number; gmv: number }
    > = {};
    for (const o of orders) {
      if (!o.deliveredAt) continue;
      const k = toCRDateKey(o.deliveredAt);
      const cur = byDay[k] ?? { trips: 0, commission: 0, driverPay: 0, gmv: 0 };
      cur.trips += 1;
      cur.commission += Number(o.commission ?? 0);
      cur.driverPay += Number(o.driverPayout ?? 0);
      cur.gmv += Number(o.basePrice ?? 0);
      byDay[k] = cur;
    }
    const daily = Object.entries(byDay)
      .map(([date, v]) => ({
        date,
        trips: v.trips,
        commission: Math.round(v.commission),
        driverPay: Math.round(v.driverPay),
        gmv: Math.round(v.gmv),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const perDriver = new Map<
      string,
      {
        name: string;
        trips: number;
        driverPay: number;
        commission: number;
        todayTrips: number;
        todayPay: number;
        todayCommission: number;
      }
    >();
    for (const o of orders) {
      if (!o.driverId) continue;
      const cur = perDriver.get(o.driverId) ?? {
        name: (o.driver as any)?.fullName ?? 'Repartidor',
        trips: 0,
        driverPay: 0,
        commission: 0,
        todayTrips: 0,
        todayPay: 0,
        todayCommission: 0,
      };
      cur.trips += 1;
      cur.driverPay += Number(o.driverPayout ?? 0);
      cur.commission += Number(o.commission ?? 0);
      if (o.deliveredAt && o.deliveredAt >= todayStart) {
        cur.todayTrips += 1;
        cur.todayPay += Number(o.driverPayout ?? 0);
        cur.todayCommission += Number(o.commission ?? 0);
      }
      perDriver.set(o.driverId, cur);
    }
    const ranking = [...perDriver.entries()]
      .map(([driverId, v]) => ({
        driverId,
        name: v.name,
        trips: v.trips,
        driverPay: Math.round(v.driverPay),
        commission: Math.round(v.commission),
        todayTrips: v.todayTrips,
        todayPay: Math.round(v.todayPay),
        todayCommission: Math.round(v.todayCommission),
      }))
      .sort((a, b) => b.trips - a.trips || b.commission - a.commission);

    return {
      launchDate: launchStart,
      today: bucket(todayStart),
      week: bucket(weekStart),
      month: bucket(monthStart),
      sinceLaunch: bucket(launchStart),
      daily,
      ranking,
      orders: orders.map((o) => ({
        id: o.id,
        deliveredAt: o.deliveredAt,
        merchant: (o.merchant as any)?.businessName ?? null,
        driver: (o.driver as any)?.fullName ?? null,
        basePrice: Math.round(Number(o.basePrice ?? 0)),
        commission: Math.round(Number(o.commission ?? 0)),
        driverPayout: Math.round(Number(o.driverPayout ?? 0)),
        totalAmount: Math.round(Number(o.totalAmount ?? 0)),
        deliveryZone: (o as any).deliveryZone ?? null,
      })),
    };
  }

  private getDateRange(period: AnalyticsPeriod, startDate?: string, endDate?: string) {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (period === AnalyticsPeriod.CUSTOM && startDate && endDate) {
      // Rango en muro CR: día completo de inicio a fin, ambos inclusivos.
      start = crDayStartISO(startDate) ?? new Date(startDate);
      const endExclusive = crDayEndExclusiveISO(endDate);
      end = endExclusive ? new Date(endExclusive.getTime() - 1) : new Date(endDate);
    } else {
      switch (period) {
        case AnalyticsPeriod.TODAY:
          start = startOfTodayCR(now);
          break;
        case AnalyticsPeriod.WEEK:
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case AnalyticsPeriod.MONTH:
          start = startOfMonthCR(now, 0);
          break;
        case AnalyticsPeriod.QUARTER:
          start = startOfMonthCR(now, 2);
          break;
        case AnalyticsPeriod.YEAR:
          start = startOfYearCR(now);
          break;
        default:
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    return { start, end };
  }

  private async getOrderStats(merchantId: string, dateRange: { start: Date; end: Date }) {
    const where = {
      merchantId,
      isTest: false,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };

    const [total, completed, cancelled] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.delivered } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.cancelled } }),
    ]);

    // Calculate average delivery time manually (see below).

    // Calculate average delivery time manually
    const deliveredOrders = await this.prisma.order.findMany({
      where: { ...where, status: OrderStatus.delivered, deliveredAt: { not: null } },
      select: { createdAt: true, deliveredAt: true },
    });

    let averageDeliveryTime = 0;
    if (deliveredOrders.length > 0) {
      const totalTime = deliveredOrders.reduce((sum, order) => {
        const deliveryTime =
          new Date(order.deliveredAt!).getTime() - new Date(order.createdAt).getTime();
        return sum + deliveryTime / (1000 * 60); // Convert to minutes
      }, 0);
      averageDeliveryTime = Math.round(totalTime / deliveredOrders.length);
    }

    // Daily breakdown
    const dailyOrders = await this.getDailyBreakdown(merchantId, dateRange, 'orders');

    return {
      total,
      completed,
      cancelled,
      pending: total - completed - cancelled,
      averageDeliveryTime,
      byStatus: [
        { status: 'completed', count: completed },
        { status: OrderStatus.cancelled, count: cancelled },
        { status: 'pending', count: total - completed - cancelled },
      ],
      daily: dailyOrders,
    };
  }

  private async getRevenueStats(merchantId: string, dateRange: { start: Date; end: Date }) {
    const where = {
      merchantId,
      isTest: false,
      status: OrderStatus.delivered,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };

    const [totalResult, count] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: { totalAmount: true, commission: true },
        _max: { totalAmount: true },
        _min: { totalAmount: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    const total = Number(totalResult._sum?.totalAmount || 0);
    const platformFee = Number(totalResult._sum?.commission || 0);

    // Daily revenue breakdown
    const dailyRevenue = await this.getDailyBreakdown(merchantId, dateRange, 'revenue');

    // Payment method breakdown
    const payments = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        order: {
          merchantId,
          isTest: false,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        status: PaymentStatus.completed,
      },
      _sum: { amount: true },
    });

    const byPaymentMethod = payments.map((p) => ({
      method: p.method,
      amount: Number(p._sum?.amount || 0),
    }));

    return {
      total,
      average: count > 0 ? Math.round(total / count) : 0,
      highest: Number(totalResult._max?.totalAmount || 0),
      lowest: Number(totalResult._min?.totalAmount || 0),
      platformFee,
      daily: dailyRevenue,
      byPaymentMethod,
    };
  }

  private async getTopItems(merchantId: string, dateRange: { start: Date; end: Date }) {
    // Top 10 by order count first…
    const topByCount = await this.prisma.orderItem.groupBy({
      by: ['menuItemId', 'name'],
      where: {
        order: {
          merchantId,
          isTest: false,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    if (topByCount.length === 0) return [];

    // …then revenue as Σ(price × quantity), NOT Σ(price) × Σ(quantity)
    // (the old formula double-counted whenever prices varied).
    const items = await this.prisma.orderItem.findMany({
      where: {
        menuItemId: { in: topByCount.map((t) => t.menuItemId) },
        order: {
          merchantId,
          isTest: false,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
      },
      select: { menuItemId: true, name: true, price: true, quantity: true },
    });

    const agg = new Map<string, { name: string; orders: number; revenue: number }>();
    for (const row of items) {
      const cur = agg.get(row.menuItemId) ?? { name: row.name, orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += Number(row.price) * row.quantity;
      agg.set(row.menuItemId, cur);
    }

    return topByCount.map((t) => ({
      id: t.menuItemId,
      name: t.name,
      orders: agg.get(t.menuItemId)?.orders ?? t._count.id,
      revenue: Math.round((agg.get(t.menuItemId)?.revenue ?? 0) * 100) / 100,
      image: '🍽️', // Default image
    }));
  }

  private async getPeakHours(merchantId: string, dateRange: { start: Date; end: Date }) {
    // Group by hour
    const hourlyData: Record<number, { orders: number; revenue: number }> = {};
    for (let h = 7; h <= 22; h++) {
      hourlyData[h] = { orders: 0, revenue: 0 };
    }

    // Cursor-batched scan: the old findMany loaded every order in range
    // into memory (OOM with volume). 500-row pages keep results exact.
    const baseWhere = {
      merchantId,
      isTest: false,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };
    let cursor: string | undefined;
    for (;;) {
      const page = await this.prisma.order.findMany({
        where: baseWhere,
        select: { id: true, createdAt: true, totalAmount: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (page.length === 0) break;

      for (const order of page) {
        // Hora Costa Rica (servidor en UTC): igual que traffic-history.
        const hour = new Date(
          new Date(order.createdAt).getTime() - 6 * 60 * 60 * 1000,
        ).getUTCHours();
        if (hourlyData[hour]) {
          hourlyData[hour].orders++;
          hourlyData[hour].revenue += Number(order.totalAmount);
        }
      }

      if (page.length < 500) break;
      cursor = page[page.length - 1].id;
    }

    return Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      orders: data.orders,
      revenue: data.revenue,
    }));
  }

  private async getCustomerStats(merchantId: string, dateRange: { start: Date; end: Date }) {
    // Get unique customers from orders
    const orders = await this.prisma.order.findMany({
      where: {
        merchantId,
        isTest: false,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      select: { id: true },
    });

    // Get ratings
    const ratings = await this.prisma.rating.findMany({
      where: {
        merchantId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      select: { rating: true },
    });

    const averageRating =
      ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;

    // Rating distribution
    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: ratings.filter((r) => r.rating === stars).length,
    }));

    return {
      totalOrders: orders.length,
      totalReviews: ratings.length,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution: distribution,
    };
  }

  private async getTrend(merchantId: string, dateRange: { start: Date; end: Date }) {
    const now = new Date();
    const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
    const previousStart = new Date(dateRange.start.getTime() - periodLength);
    const previousEnd = new Date(dateRange.start.getTime());

    const [currentOrders, previousOrders, currentRevenue, previousRevenue] = await Promise.all([
      this.prisma.order.count({
        where: {
          merchantId,
          isTest: false,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
      }),
      this.prisma.order.count({
        where: { merchantId, isTest: false, createdAt: { gte: previousStart, lte: previousEnd } },
      }),
      this.prisma.order.aggregate({
        where: {
          merchantId,
          isTest: false,
          status: OrderStatus.delivered,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: {
          merchantId,
          isTest: false,
          status: OrderStatus.delivered,
          createdAt: { gte: previousStart, lte: previousEnd },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    const ordersGrowth =
      previousOrders > 0
        ? Math.round(((currentOrders - previousOrders) / previousOrders) * 100 * 10) / 10
        : 0;

    const currentRev = Number(currentRevenue._sum?.totalAmount || 0);
    const previousRev = Number(previousRevenue._sum?.totalAmount || 0);
    const revenueGrowth =
      previousRev > 0 ? Math.round(((currentRev - previousRev) / previousRev) * 100 * 10) / 10 : 0;

    return {
      ordersGrowth,
      revenueGrowth,
      averageOrderGrowth: revenueGrowth - ordersGrowth,
    };
  }

  private async getDeliveryStats(driverId: string, dateRange: { start: Date; end: Date }) {
    const where = {
      driverId,
      isTest: false,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };

    const [total, completed, cancelled] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.delivered } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.cancelled } }),
    ]);

    // Average distance
    const avgDistance = await this.prisma.order.aggregate({
      where: { ...where, distanceKm: { not: null } },
      _avg: { distanceKm: true },
    });

    // Average delivery time, computed from real timestamps (driver+range
    // bounded, same pattern as merchant averageDeliveryTime).
    const deliveredTimes = await this.prisma.order.findMany({
      where: { ...where, status: OrderStatus.delivered, deliveredAt: { not: null } },
      select: { createdAt: true, deliveredAt: true },
    });
    let averageTime = 0;
    if (deliveredTimes.length > 0) {
      const totalMinutes = deliveredTimes.reduce(
        (sum, o) =>
          sum + (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime()) / 60000,
        0,
      );
      averageTime = Math.round(totalMinutes / deliveredTimes.length);
    }

    // Daily breakdown
    const dailyOrders = await this.getDriverDailyBreakdown(driverId, dateRange, 'orders');

    return {
      total,
      completed,
      cancelled,
      averageDistance: Number(avgDistance._avg?.distanceKm || 0),
      averageTime,
      daily: dailyOrders,
    };
  }

  private async getEarningsStats(driverId: string, dateRange: { start: Date; end: Date }) {
    const where = {
      driverId,
      isTest: false,
      status: OrderStatus.delivered,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };

    const [totalResult, count] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: { driverPayout: true },
        _max: { driverPayout: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    const total = Number(totalResult._sum?.driverPayout || 0);

    // Daily earnings breakdown
    const dailyEarnings = await this.getDriverDailyBreakdown(driverId, dateRange, 'earnings');

    return {
      total,
      average: count > 0 ? Math.round(total / count) : 0,
      highest: Number(totalResult._max?.driverPayout || 0),
      daily: dailyEarnings,
      // Real composition only: tips/bonus don't exist in the model, so a
      // split with fabricated percentages is worse than a single 100% bar.
      breakdown: [{ type: 'delivery_fee', amount: total }],
    };
  }

  private async getRatingStats(driverId: string, dateRange: { start: Date; end: Date }) {
    const ratings = await this.prisma.rating.findMany({
      where: {
        driverId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      select: { rating: true },
    });

    const average =
      ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 5.0;

    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: ratings.filter((r) => r.rating === stars).length,
    }));

    return {
      average: Math.round(average * 10) / 10,
      total: ratings.length,
      distribution,
    };
  }

  private async getScheduleStats(driverId: string, dateRange: { start: Date; end: Date }) {
    const schedules = await this.prisma.driverSchedule.findMany({
      where: { driverId, isAvailable: true },
    });

    // Real hours per weekday from the driver's own schedule.
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const hoursByDay = new Map<number, number>();
    let activeHoursPerWeek = 0;
    schedules.forEach((schedule) => {
      const start = new Date(schedule.startTime);
      const end = new Date(schedule.endTime);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (!Number.isFinite(hours) || hours <= 0) return;
      activeHoursPerWeek += hours;
      hoursByDay.set(schedule.dayOfWeek, (hoursByDay.get(schedule.dayOfWeek) || 0) + hours);
    });

    let mostActiveDay = '—';
    let bestHours = 0;
    for (const [day, hours] of hoursByDay) {
      if (hours > bestHours) {
        bestHours = hours;
        mostActiveDay = dayNames[day] ?? '—';
      }
    }

    return {
      activeHours: Math.round(activeHoursPerWeek),
      averageHoursPerDay: Math.round((activeHoursPerWeek / 7) * 10) / 10,
      mostActiveDay,
    };
  }

  private async getDriverTrend(driverId: string, dateRange: { start: Date; end: Date }) {
    const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
    const previousStart = new Date(dateRange.start.getTime() - periodLength);
    const previousEnd = new Date(dateRange.start.getTime());

    const [currentDeliveries, previousDeliveries, currentEarnings, previousEarnings] =
      await Promise.all([
        this.prisma.order.count({
          where: {
            driverId,
            isTest: false,
            status: OrderStatus.delivered,
            createdAt: { gte: dateRange.start, lte: dateRange.end },
          },
        }),
        this.prisma.order.count({
          where: {
            driverId,
            isTest: false,
            status: OrderStatus.delivered,
            createdAt: { gte: previousStart, lte: previousEnd },
          },
        }),
        this.prisma.order.aggregate({
          where: {
            driverId,
            isTest: false,
            status: OrderStatus.delivered,
            createdAt: { gte: dateRange.start, lte: dateRange.end },
          },
          _sum: { driverPayout: true },
        }),
        this.prisma.order.aggregate({
          where: {
            driverId,
            isTest: false,
            status: OrderStatus.delivered,
            createdAt: { gte: previousStart, lte: previousEnd },
          },
          _sum: { driverPayout: true },
        }),
      ]);

    const deliveriesGrowth =
      previousDeliveries > 0
        ? Math.round(((currentDeliveries - previousDeliveries) / previousDeliveries) * 100 * 10) /
          10
        : 0;

    const currentEarn = Number(currentEarnings._sum?.driverPayout || 0);
    const previousEarn = Number(previousEarnings._sum?.driverPayout || 0);
    const earningsGrowth =
      previousEarn > 0
        ? Math.round(((currentEarn - previousEarn) / previousEarn) * 100 * 10) / 10
        : 0;

    // Real rating trend: % change of the average score between windows.
    const [currentRatings, previousRatings] = await Promise.all([
      this.prisma.rating.findMany({
        where: { driverId, createdAt: { gte: dateRange.start, lte: dateRange.end } },
        select: { rating: true },
      }),
      this.prisma.rating.findMany({
        where: { driverId, createdAt: { gte: previousStart, lte: previousEnd } },
        select: { rating: true },
      }),
    ]);
    const avg = (rs: { rating: number }[]) =>
      rs.length > 0 ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
    const currentAvg = avg(currentRatings);
    const previousAvg = avg(previousRatings);
    const ratingGrowth =
      previousAvg > 0 ? Math.round(((currentAvg - previousAvg) / previousAvg) * 100 * 10) / 10 : 0;

    return {
      deliveriesGrowth,
      earningsGrowth,
      ratingGrowth,
    };
  }

  private async getUserStats(dateRange: { start: Date; end: Date }) {
    const [total, merchants, drivers] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.merchantProfile.count(),
      this.prisma.driverProfile.count(),
    ]);

    const active = await this.prisma.user.count({
      where: { status: UserStatus.active },
    });

    return {
      total,
      active,
      merchants,
      drivers,
      customers: total - merchants - drivers,
    };
  }

  private async getPlatformOrderStats(dateRange: { start: Date; end: Date }) {
    const where = {
      isTest: false,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };

    const [total, completed, cancelled, pending] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.delivered } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.cancelled } }),
      this.prisma.order.count({
        where: {
          ...where,
          status: {
            in: [
              OrderStatus.pending,
              OrderStatus.assigned,
              OrderStatus.in_transit_to_pickup,
              OrderStatus.picked_up,
              OrderStatus.in_transit_to_delivery,
            ],
          },
        },
      }),
    ]);

    return { total, completed, cancelled, pending };
  }

  private async getPlatformRevenueStats(dateRange: { start: Date; end: Date }) {
    const where = {
      status: OrderStatus.delivered,
      isTest: false,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };

    const [totalResult, count] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: { totalAmount: true, commission: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    const total = Number(totalResult._sum?.totalAmount || 0);
    const platformFee = Number(totalResult._sum?.commission || 0);

    return {
      total,
      platformFee,
      averagePerOrder: count > 0 ? Math.round(total / count) : 0,
    };
  }

  private async getGrowthStats(dateRange: { start: Date; end: Date }) {
    const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
    const previousStart = new Date(dateRange.start.getTime() - periodLength);
    const previousEnd = new Date(dateRange.start.getTime());

    const [
      currentUsers,
      previousUsers,
      currentOrders,
      previousOrders,
      currentRevenue,
      previousRevenue,
      currentMerchants,
      previousMerchants,
      currentDrivers,
      previousDrivers,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: previousStart, lte: previousEnd } },
      }),
      this.prisma.order.count({
        where: { isTest: false, createdAt: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.order.count({
        where: { isTest: false, createdAt: { gte: previousStart, lte: previousEnd } },
      }),
      this.prisma.order.aggregate({
        where: {
          status: OrderStatus.delivered,
          isTest: false,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: {
          status: OrderStatus.delivered,
          isTest: false,
          createdAt: { gte: previousStart, lte: previousEnd },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.merchantProfile.count({
        where: { createdAt: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.merchantProfile.count({
        where: { createdAt: { gte: previousStart, lte: previousEnd } },
      }),
      this.prisma.driverProfile.count({
        where: { createdAt: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.driverProfile.count({
        where: { createdAt: { gte: previousStart, lte: previousEnd } },
      }),
    ]);

    const calculateGrowth = (current: number, previous: number) => {
      return previous > 0 ? Math.round(((current - previous) / previous) * 100 * 10) / 10 : 0;
    };

    return {
      userGrowth: calculateGrowth(currentUsers, previousUsers),
      orderGrowth: calculateGrowth(currentOrders, previousOrders),
      revenueGrowth: calculateGrowth(
        Number(currentRevenue._sum?.totalAmount || 0),
        Number(previousRevenue._sum?.totalAmount || 0),
      ),
      merchantGrowth: calculateGrowth(currentMerchants, previousMerchants),
      driverGrowth: calculateGrowth(currentDrivers, previousDrivers),
    };
  }

  private async getDailyBreakdown(
    merchantId: string,
    dateRange: { start: Date; end: Date },
    type: 'orders' | 'revenue',
  ) {
    const orders = await this.prisma.order.findMany({
      where: {
        merchantId,
        isTest: false,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      select: { createdAt: true, totalAmount: true },
    });

    const dailyData: Record<string, number> = {};

    orders.forEach((order) => {
      const date = toCRDateKey(order.createdAt);
      if (!dailyData[date]) dailyData[date] = 0;

      if (type === 'orders') {
        dailyData[date]++;
      } else {
        dailyData[date] += Number(order.totalAmount);
      }
    });

    return Object.entries(dailyData)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async getDriverDailyBreakdown(
    driverId: string,
    dateRange: { start: Date; end: Date },
    type: 'orders' | 'earnings',
  ) {
    const orders = await this.prisma.order.findMany({
      where: {
        driverId,
        isTest: false,
        status: OrderStatus.delivered,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      select: { createdAt: true, driverPayout: true },
    });

    const dailyData: Record<string, number> = {};

    orders.forEach((order) => {
      const date = toCRDateKey(order.createdAt);
      if (!dailyData[date]) dailyData[date] = 0;

      if (type === 'orders') {
        dailyData[date]++;
      } else {
        dailyData[date] += Number(order.driverPayout);
      }
    });

    return Object.entries(dailyData)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
