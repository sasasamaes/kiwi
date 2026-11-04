// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrafficService } from './traffic.service';
import { startOfTodayCR } from '../common/costa-rica-time';

export interface TrafficHistoryRecord {
  id: string;
  timestamp: Date;
  lat: number;
  lng: number;
  zone: string;
  level: string;
  speedFactor: number;
  duration: number; // in minutes
}

export interface TrafficPattern {
  hour: number;
  dayOfWeek: number;
  averageLevel: string;
  averageSpeed: number;
  sampleCount: number;
}

export interface TrafficTrend {
  period: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export interface TrafficHeatmapData {
  lat: number;
  lng: number;
  intensity: number; // 0-1
  level: string;
}

export interface MerchantTrafficReport {
  merchantId: string;
  period: 'day' | 'week' | 'month';
  summary: {
    totalDeliveries: number;
    averageTrafficLevel: string;
    averageDeliveryTime: number;
    trafficDelayedDeliveries: number;
    estimatedTimeLost: number;
  };
  patterns: TrafficPattern[];
  trends: TrafficTrend[];
  recommendations: string[];
}

@Injectable()
export class TrafficHistoryService {
  private readonly logger = new Logger(TrafficHistoryService.name);

  // Zone definitions for Nicoya
  private readonly zones = [
    { name: 'Centro', lat: 10.1483, lng: -85.4527, radius: 0.5 },
    { name: 'Mercado', lat: 10.149, lng: -85.452, radius: 0.3 },
    { name: 'Hospital', lat: 10.147, lng: -85.454, radius: 0.4 },
    { name: 'Norte', lat: 10.155, lng: -85.4527, radius: 0.6 },
    { name: 'Sur', lat: 10.142, lng: -85.45, radius: 0.8 },
    { name: 'Industrial', lat: 10.14, lng: -85.448, radius: 0.7 },
  ];

  constructor(
    private prisma: PrismaService,
    private trafficService: TrafficService,
  ) {}

  /**
   * Hora/día en Costa Rica (UTC-6 sin horario de verano). El servidor corre
   * en UTC: usar getHours() directo corre las "horas pico" 6 horas.
   */
  private static costaRicaParts(date: Date): { hour: number; dayOfWeek: number } {
    const shifted = new Date(date.getTime() - 6 * 60 * 60 * 1000);
    return { hour: shifted.getUTCHours(), dayOfWeek: shifted.getUTCDay() };
  }

  /**
   * Record traffic data point
   */
  async recordTrafficData(
    lat: number,
    lng: number,
    level: string,
    speedFactor: number,
  ): Promise<void> {
    const zone = this.getZoneForLocation(lat, lng);

    await this.prisma.trafficHistory.create({
      data: {
        lat,
        lng,
        zone: zone?.name || 'Unknown',
        level,
        speedFactor,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Get traffic history for a zone
   */
  async getTrafficHistory(
    zone?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100,
  ): Promise<TrafficHistoryRecord[]> {
    const where: any = {};

    if (zone) where.zone = zone;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const records = await this.prisma.trafficHistory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      lat: r.lat,
      lng: r.lng,
      zone: r.zone,
      level: r.level,
      speedFactor: r.speedFactor,
      duration: 5, // Default 5-minute intervals
    }));
  }

  /**
   * Get traffic patterns by hour and day
   */
  async getTrafficPatterns(zone?: string, daysBack: number = 30): Promise<TrafficPattern[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const records = await this.prisma.trafficHistory.findMany({
      where: {
        ...(zone ? { zone } : {}),
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group by hour and day of week
    const grouped: Record<string, { levels: string[]; speeds: number[] }> = {};

    for (const record of records) {
      const { hour, dayOfWeek } = TrafficHistoryService.costaRicaParts(new Date(record.timestamp));
      const key = `${hour}_${dayOfWeek}`;

      if (!grouped[key]) {
        grouped[key] = { levels: [], speeds: [] };
      }
      grouped[key].levels.push(record.level);
      grouped[key].speeds.push(record.speedFactor);
    }

    // Calculate averages
    const patterns: TrafficPattern[] = [];
    const levels = ['free', 'light', 'moderate', 'heavy', 'severe'];

    for (let hour = 0; hour < 24; hour++) {
      for (let day = 0; day < 7; day++) {
        const key = `${hour}_${day}`;
        const data = grouped[key];

        if (data && data.levels.length > 0) {
          const avgSpeed = data.speeds.reduce((a, b) => a + b, 0) / data.speeds.length;
          const avgLevelIndex = Math.round(
            data.levels.reduce((sum, l) => sum + levels.indexOf(l), 0) / data.levels.length,
          );

          patterns.push({
            hour,
            dayOfWeek: day,
            averageLevel: levels[Math.min(avgLevelIndex, levels.length - 1)],
            averageSpeed: Math.round(avgSpeed * 100) / 100,
            sampleCount: data.levels.length,
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Get traffic trends
   */
  async getTrafficTrends(
    zone?: string,
    period: 'day' | 'week' | 'month' = 'week',
  ): Promise<TrafficTrend[]> {
    const now = new Date();
    const trends: TrafficTrend[] = [];

    // Calculate time ranges
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

    switch (period) {
      case 'day':
        currentStart = startOfTodayCR(now);
        currentEnd = now;
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 1);
        previousEnd = new Date(currentStart);
        previousEnd.setMilliseconds(-1);
        break;
      case 'week':
        currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 7);
        currentEnd = now;
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 7);
        previousEnd = new Date(currentStart);
        previousEnd.setMilliseconds(-1);
        break;
      case 'month':
        currentStart = new Date(now);
        currentStart.setMonth(currentStart.getMonth() - 1);
        currentEnd = now;
        previousStart = new Date(currentStart);
        previousStart.setMonth(previousStart.getMonth() - 1);
        previousEnd = new Date(currentStart);
        previousEnd.setMilliseconds(-1);
        break;
    }

    // Get current period average
    const currentRecords = await this.prisma.trafficHistory.findMany({
      where: {
        ...(zone ? { zone } : {}),
        timestamp: { gte: currentStart, lte: currentEnd },
      },
    });

    // Get previous period average
    const previousRecords = await this.prisma.trafficHistory.findMany({
      where: {
        ...(zone ? { zone } : {}),
        timestamp: { gte: previousStart, lte: previousEnd },
      },
    });

    const currentAvg = this.calculateAverageSpeed(currentRecords);
    const previousAvg = this.calculateAverageSpeed(previousRecords);

    // Create trends for different metrics
    trends.push({
      period,
      current: currentAvg,
      previous: previousAvg,
      change: Math.round((currentAvg - previousAvg) * 100) / 100,
      changePercent:
        previousAvg > 0 ? Math.round(((currentAvg - previousAvg) / previousAvg) * 100) : 0,
    });

    return trends;
  }

  /**
   * Get traffic heatmap data
   */
  async getTrafficHeatmap(startDate?: Date, endDate?: Date): Promise<TrafficHeatmapData[]> {
    const where: any = {};
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const records = await this.prisma.trafficHistory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    // Group by location and calculate intensity
    const locationMap: Record<string, { speeds: number[]; count: number }> = {};

    for (const record of records) {
      // Round to 3 decimal places for grouping
      const key = `${record.lat.toFixed(3)}_${record.lng.toFixed(3)}`;
      if (!locationMap[key]) {
        locationMap[key] = { speeds: [], count: 0 };
      }
      locationMap[key].speeds.push(record.speedFactor);
      locationMap[key].count++;
    }

    // Convert to heatmap data
    const heatmapData: TrafficHeatmapData[] = [];
    const levels = ['free', 'light', 'moderate', 'heavy', 'severe'];

    for (const [key, data] of Object.entries(locationMap)) {
      const [lat, lng] = key.split('_').map(Number);
      const avgSpeed = data.speeds.reduce((a, b) => a + b, 0) / data.speeds.length;
      const intensity = 1 - avgSpeed; // Invert: slower = more intense

      const levelIndex = Math.round((1 - avgSpeed) * (levels.length - 1));

      heatmapData.push({
        lat,
        lng,
        intensity: Math.round(intensity * 100) / 100,
        level: levels[Math.min(levelIndex, levels.length - 1)],
      });
    }

    return heatmapData;
  }

  /**
   * Traffic report for the authenticated merchant (resolves profile id
   * from the user id — the frontend must not guess profile ids).
   */
  async getMyTrafficReport(
    userId: string,
    period: 'day' | 'week' | 'month' = 'week',
  ): Promise<MerchantTrafficReport> {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });
    if (!merchant) {
      throw new NotFoundException('Perfil de comerciante no encontrado');
    }
    return this.getMerchantTrafficReport(merchant.id, period);
  }

  /**
   * Reporte de un comercio con gate de ownership: el dueño (por token) o
   * admin. Sin esto, cualquier logueado extraía pedidos/pagos agregados
   * de otro comercio con su merchantId.
   */
  async getMerchantTrafficReportFor(
    userId: string,
    role: string | undefined,
    merchantId: string,
    period: 'day' | 'week' | 'month' = 'week',
  ): Promise<MerchantTrafficReport> {
    if (role !== 'admin') {
      const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
      if (!merchant || merchant.id !== merchantId) {
        throw new ForbiddenException('Solo el comercio dueño puede ver este reporte');
      }
    }
    return this.getMerchantTrafficReport(merchantId, period);
  }

  /**
   * Get merchant traffic report
   */
  async getMerchantTrafficReport(
    merchantId: string,
    period: 'day' | 'week' | 'month' = 'week',
  ): Promise<MerchantTrafficReport> {
    // Get merchant location
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // Get orders for the period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const orders = await this.prisma.order.findMany({
      where: {
        merchantId,
        createdAt: { gte: startDate },
      },
      include: { payment: true },
    });

    // Get traffic data for merchant area
    const merchantLat = merchant.latitude != null ? Number(merchant.latitude) : 10.1483;
    const merchantLng = merchant.longitude != null ? Number(merchant.longitude) : -85.4527;
    const trafficHistory = await this.prisma.trafficHistory.findMany({
      where: {
        lat: {
          gte: merchantLat - 0.01,
          lte: merchantLat + 0.01,
        },
        lng: {
          gte: merchantLng - 0.01,
          lte: merchantLng + 0.01,
        },
        timestamp: { gte: startDate },
      },
    });

    // Calculate summary
    const totalDeliveries = orders.length;
    const avgTrafficLevel = this.calculateAverageLevel(trafficHistory);
    const avgDeliveryTime = this.calculateAverageDeliveryTime(orders);
    const trafficDelayed = orders.filter((o) => this.wasDelayedByTraffic(o, trafficHistory)).length;
    const timeLost = trafficDelayed * 5; // Estimate 5 min delay per traffic delay

    // Get patterns
    const patterns = await this.getTrafficPatterns(
      this.getZoneForLocation(merchantLat, merchantLng)?.name,
      30,
    );

    // Get trends
    const trends = await this.getTrafficTrends(
      this.getZoneForLocation(merchantLat, merchantLng)?.name,
      period,
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      patterns,
      avgTrafficLevel,
      totalDeliveries,
    );

    return {
      merchantId,
      period,
      summary: {
        totalDeliveries,
        averageTrafficLevel: avgTrafficLevel,
        averageDeliveryTime: avgDeliveryTime,
        trafficDelayedDeliveries: trafficDelayed,
        estimatedTimeLost: timeLost,
      },
      patterns,
      trends,
      recommendations,
    };
  }

  /**
   * Get best times for deliveries
   */
  async getBestDeliveryTimes(
    lat: number,
    lng: number,
    daysBack: number = 30,
  ): Promise<
    Array<{
      hour: number;
      dayOfWeek: number;
      level: string;
      recommendation: string;
    }>
  > {
    const patterns = await this.getTrafficPatterns(
      this.getZoneForLocation(lat, lng)?.name,
      daysBack,
    );

    // Find best times (free or light traffic)
    const bestTimes = patterns
      .filter((p) => p.averageLevel === 'free' || p.averageLevel === 'light')
      .map((p) => ({
        hour: p.hour,
        dayOfWeek: p.dayOfWeek,
        level: p.averageLevel,
        averageLevel: p.averageLevel,
        averageSpeed: p.averageSpeed,
        sampleCount: p.sampleCount,
        recommendation:
          p.averageLevel === 'free'
            ? '🟢 Tráfico libre - Tiempo ideal'
            : '🟡 Tráfico ligero - Buen momento',
      }))
      .sort((a, b) => b.averageSpeed - a.averageSpeed)
      .slice(0, 10);

    return bestTimes;
  }

  /**
   * Get worst times to avoid
   */
  async getWorstDeliveryTimes(
    lat: number,
    lng: number,
    daysBack: number = 30,
  ): Promise<
    Array<{
      hour: number;
      dayOfWeek: number;
      level: string;
      recommendation: string;
    }>
  > {
    const patterns = await this.getTrafficPatterns(
      this.getZoneForLocation(lat, lng)?.name,
      daysBack,
    );

    // Find worst times (heavy or severe traffic)
    const worstTimes = patterns
      .filter((p) => p.averageLevel === 'heavy' || p.averageLevel === 'severe')
      .map((p) => ({
        hour: p.hour,
        dayOfWeek: p.dayOfWeek,
        level: p.averageLevel,
        averageLevel: p.averageLevel,
        averageSpeed: p.averageSpeed,
        sampleCount: p.sampleCount,
        recommendation:
          p.averageLevel === 'severe'
            ? '🔴 Tráfico severo - Evitar si es posible'
            : '🟠 Tráfico pesado - Planificar con tiempo',
      }))
      .sort((a, b) => a.averageSpeed - b.averageSpeed)
      .slice(0, 10);

    return worstTimes;
  }

  // Private helper methods

  private getZoneForLocation(lat: number, lng: number) {
    for (const zone of this.zones) {
      const distance = this.calculateDistance(lat, lng, zone.lat, zone.lng);
      if (distance <= zone.radius) {
        return zone;
      }
    }
    return null;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private calculateAverageSpeed(records: any[]): number {
    if (records.length === 0) return 1.0;
    const sum = records.reduce((acc, r) => acc + r.speedFactor, 0);
    return Math.round((sum / records.length) * 100) / 100;
  }

  private calculateAverageLevel(records: any[]): string {
    if (records.length === 0) return 'free';
    const levels = ['free', 'light', 'moderate', 'heavy', 'severe'];
    const avgIndex = records.reduce((sum, r) => sum + levels.indexOf(r.level), 0) / records.length;
    return levels[Math.round(avgIndex)];
  }

  private calculateAverageDeliveryTime(orders: any[]): number {
    if (orders.length === 0) return 0;
    const times = orders
      .filter((o) => o.deliveredAt && o.createdAt)
      .map((o) => {
        const created = new Date(o.createdAt).getTime();
        const delivered = new Date(o.deliveredAt).getTime();
        return (delivered - created) / 1000 / 60; // minutes
      });
    if (times.length === 0) return 25; // Default estimate
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }

  private wasDelayedByTraffic(order: any, trafficHistory: any[]): boolean {
    // Ventana absoluta de ±30 min (comparación por timestamp: sin problema de zona horaria).
    const orderTime = new Date(order.createdAt);

    const trafficDuringOrder = trafficHistory.filter((t) => {
      const tTime = new Date(t.timestamp);
      return Math.abs(tTime.getTime() - orderTime.getTime()) < 30 * 60 * 1000; // Within 30 min
    });

    return trafficDuringOrder.some((t) => t.level === 'heavy' || t.level === 'severe');
  }

  private generateRecommendations(
    patterns: TrafficPattern[],
    avgLevel: string,
    totalOrders: number,
  ): string[] {
    const recommendations: string[] = [];

    // Analyze patterns
    const freeHours = patterns.filter((p) => p.averageLevel === 'free');
    const heavyHours = patterns.filter(
      (p) => p.averageLevel === 'heavy' || p.averageLevel === 'severe',
    );

    if (freeHours.length > 0) {
      const bestHour = freeHours[0];
      recommendations.push(
        `🟢 Los mejores horarios son entre las ${bestHour.hour}:00 y ${bestHour.hour + 1}:00 con tráfico libre.`,
      );
    }

    if (heavyHours.length > 0) {
      const worstHour = heavyHours[0];
      recommendations.push(
        `🔴 Evita enviar repartidores entre las ${worstHour.hour}:00 y ${worstHour.hour + 1}:00 (tráfico pesado).`,
      );
    }

    if (avgLevel === 'heavy' || avgLevel === 'severe') {
      recommendations.push(
        '⚠️ Tu zona tiene tráfico frecuentemente pesado. Considera ofrecer horarios de entrega fuera de pico.',
      );
    }

    if (totalOrders > 10) {
      recommendations.push(
        '📊 Con más pedidos, puedes identificar patrones personales de demanda.',
      );
    }

    recommendations.push(
      '💡 Ofrecer delivery en horarios de tráfico libre puede mejorar la experiencia del cliente.',
    );

    return recommendations;
  }
}
