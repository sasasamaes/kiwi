import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsPeriod, AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getMerchantAnalytics(merchantId: string, query: AnalyticsQueryDto) {
    const dateRange = this.getDateRange(query.period, query.startDate, query.endDate);

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

  async getDriverAnalytics(driverId: string, query: AnalyticsQueryDto) {
    const dateRange = this.getDateRange(query.period, query.startDate, query.endDate);

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
        averageEarningPerDelivery: deliveries.total > 0 ? Math.round(earnings.total / deliveries.total) : 0,
        averageRating: ratings.average,
        completionRate: deliveries.total > 0 ? Math.round((deliveries.completed / deliveries.total) * 100) : 0,
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

  private getDateRange(period: AnalyticsPeriod, startDate?: string, endDate?: string) {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (period === AnalyticsPeriod.CUSTOM && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      switch (period) {
        case AnalyticsPeriod.TODAY:
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case AnalyticsPeriod.WEEK:
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case AnalyticsPeriod.MONTH:
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case AnalyticsPeriod.QUARTER:
          start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
          break;
        case AnalyticsPeriod.YEAR:
          start = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    return { start, end };
  }

  private async getOrderStats(merchantId: string, dateRange: { start: Date; end: Date }) {
    // Mock data for demo - in production, query from database
    const mockOrders = this.generateMockData(30, 100);
    const total = mockOrders.reduce((a, b) => a + b, 0);
    
    return {
      total,
      completed: Math.round(total * 0.92),
      cancelled: Math.round(total * 0.05),
      pending: Math.round(total * 0.03),
      averageDeliveryTime: 28,
      byStatus: [
        { status: 'completed', count: Math.round(total * 0.92) },
        { status: 'cancelled', count: Math.round(total * 0.05) },
        { status: 'pending', count: Math.round(total * 0.03) },
      ],
      daily: this.generateDailyData(30),
    };
  }

  private async getRevenueStats(merchantId: string, dateRange: { start: Date; end: Date }) {
    const mockRevenue = this.generateMockData(30, 50000);
    const total = mockRevenue.reduce((a, b) => a + b, 0);
    
    return {
      total,
      average: Math.round(total / 30),
      highest: Math.max(...mockRevenue),
      lowest: Math.min(...mockRevenue),
      daily: this.generateDailyRevenueData(30),
      byPaymentMethod: [
        { method: 'sinpe', amount: Math.round(total * 0.45) },
        { method: 'card', amount: Math.round(total * 0.30) },
        { method: 'cash', amount: Math.round(total * 0.20) },
        { method: 'crypto', amount: Math.round(total * 0.05) },
      ],
    };
  }

  private async getTopItems(merchantId: string, dateRange: { start: Date; end: Date }) {
    return [
      { id: '1', name: 'Bowl de Pollo', orders: 156, revenue: 702000, image: '🥗' },
      { id: '2', name: 'Café Americano', orders: 134, revenue: 174200, image: '☕' },
      { id: '3', name: 'Smoothie Tropical', orders: 98, revenue: 245000, image: '🥤' },
      { id: '4', name: 'Bowl Vegano', orders: 87, revenue: 417600, image: '🥬' },
      { id: '5', name: 'Latte con Leche', orders: 76, revenue: 152000, image: '☕' },
    ];
  }

  private async getPeakHours(merchantId: string, dateRange: { start: Date; end: Date }) {
    return [
      { hour: 7, orders: 12, revenue: 54000 },
      { hour: 8, orders: 28, revenue: 126000 },
      { hour: 9, orders: 45, revenue: 202500 },
      { hour: 10, orders: 38, revenue: 171000 },
      { hour: 11, orders: 52, revenue: 234000 },
      { hour: 12, orders: 68, revenue: 306000 },
      { hour: 13, orders: 62, revenue: 279000 },
      { hour: 14, orders: 42, revenue: 189000 },
      { hour: 15, orders: 35, revenue: 157500 },
      { hour: 16, orders: 28, revenue: 126000 },
      { hour: 17, orders: 45, revenue: 202500 },
      { hour: 18, orders: 38, revenue: 171000 },
      { hour: 19, orders: 22, revenue: 99000 },
      { hour: 20, orders: 15, revenue: 67500 },
    ];
  }

  private async getCustomerStats(merchantId: string, dateRange: { start: Date; end: Date }) {
    return {
      totalCustomers: 234,
      newCustomers: 45,
      returningCustomers: 189,
      averageRating: 4.8,
      ratingDistribution: [
        { stars: 5, count: 156 },
        { stars: 4, count: 52 },
        { stars: 3, count: 18 },
        { stars: 2, count: 5 },
        { stars: 1, count: 3 },
      ],
    };
  }

  private async getTrend(merchantId: string, dateRange: { start: Date; end: Date }) {
    return {
      ordersGrowth: 12.5,
      revenueGrowth: 15.3,
      customerGrowth: 8.2,
      averageOrderGrowth: 2.8,
    };
  }

  private async getDeliveryStats(driverId: string, dateRange: { start: Date; end: Date }) {
    const mockDeliveries = this.generateMockData(30, 15);
    const total = mockDeliveries.reduce((a, b) => a + b, 0);
    
    return {
      total,
      completed: Math.round(total * 0.95),
      cancelled: Math.round(total * 0.03),
      averageDistance: 3.2,
      averageTime: 25,
      daily: this.generateDailyData(30),
    };
  }

  private async getEarningsStats(driverId: string, dateRange: { start: Date; end: Date }) {
    const mockEarnings = this.generateMockData(30, 15000);
    const total = mockEarnings.reduce((a, b) => a + b, 0);
    
    return {
      total,
      average: Math.round(total / 30),
      highest: Math.max(...mockEarnings),
      daily: this.generateDailyRevenueData(30),
      breakdown: [
        { type: 'delivery_fee', amount: Math.round(total * 0.7) },
        { type: 'tips', amount: Math.round(total * 0.2) },
        { type: 'bonus', amount: Math.round(total * 0.1) },
      ],
    };
  }

  private async getRatingStats(driverId: string, dateRange: { start: Date; end: Date }) {
    return {
      average: 4.9,
      total: 156,
      distribution: [
        { stars: 5, count: 120 },
        { stars: 4, count: 28 },
        { stars: 3, count: 6 },
        { stars: 2, count: 1 },
        { stars: 1, count: 1 },
      ],
    };
  }

  private async getScheduleStats(driverId: string, dateRange: { start: Date; end: Date }) {
    return {
      activeHours: 168,
      averageHoursPerDay: 6.2,
      mostActiveDay: 'Saturday',
      utilizationRate: 75,
    };
  }

  private async getDriverTrend(driverId: string, dateRange: { start: Date; end: Date }) {
    return {
      deliveriesGrowth: 18.5,
      earningsGrowth: 22.3,
      ratingGrowth: 0.2,
    };
  }

  private async getUserStats(dateRange: { start: Date; end: Date }) {
    return {
      total: 1250,
      active: 890,
      merchants: 45,
      drivers: 120,
      customers: 1085,
    };
  }

  private async getPlatformOrderStats(dateRange: { start: Date; end: Date }) {
    return {
      total: 5420,
      completed: 4986,
      cancelled: 271,
      pending: 163,
    };
  }

  private async getPlatformRevenueStats(dateRange: { start: Date; end: Date }) {
    return {
      total: 27100000,
      platformFee: 2710000,
      averagePerOrder: 5000,
    };
  }

  private async getGrowthStats(dateRange: { start: Date; end: Date }) {
    return {
      userGrowth: 15.2,
      orderGrowth: 22.8,
      revenueGrowth: 28.5,
      merchantGrowth: 12.3,
      driverGrowth: 18.7,
    };
  }

  private generateMockData(days: number, max: number): number[] {
    return Array.from({ length: days }, () => Math.floor(Math.random() * max) + Math.floor(max * 0.3));
  }

  private generateDailyData(days: number) {
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      return {
        date: date.toISOString().split('T')[0],
        value: Math.floor(Math.random() * 50) + 10,
      };
    });
  }

  private generateDailyRevenueData(days: number) {
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      return {
        date: date.toISOString().split('T')[0],
        value: Math.floor(Math.random() * 50000) + 10000,
      };
    });
  }
}
