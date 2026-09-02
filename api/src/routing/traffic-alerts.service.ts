import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrafficService } from './traffic.service';

interface TrafficAlert {
  id: string;
  type: 'congestion' | 'accident' | 'road_closed' | 'weather' | 'event' | 'alternative_route';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  affectedArea: {
    radius: number; // in km
  };
  alternativeRoute?: {
    description: string;
    estimatedTimeSaved: number; // in minutes
  };
  expiresAt: Date;
  createdAt: Date;
}

interface AlertNotification {
  alertId: string;
  driverId: string;
  read: boolean;
  dismissed: boolean;
  createdAt: Date;
}

@Injectable()
export class TrafficAlertsService {
  private readonly logger = new Logger(TrafficAlertsService.name);

  // Predefined alert zones in Nicoya
  private readonly alertZones = [
    {
      name: 'Centro Nicoya',
      lat: 10.1483,
      lng: -85.4527,
      radius: 0.5,
      congestionThreshold: 'moderate', // Alert when traffic is moderate or worse
    },
    {
      name: 'Mercado Central',
      lat: 10.1490,
      lng: -85.4520,
      radius: 0.3,
      congestionThreshold: 'light',
    },
    {
      name: 'Hospital Nicoya',
      lat: 10.1470,
      lng: -85.4540,
      radius: 0.4,
      congestionThreshold: 'moderate',
    },
    {
      name: 'Entrada Norte',
      lat: 10.1550,
      lng: -85.4527,
      radius: 0.6,
      congestionThreshold: 'heavy',
    },
    {
      name: 'Zona Industrial',
      lat: 10.1420,
      lng: -85.4500,
      radius: 0.8,
      congestionThreshold: 'moderate',
    },
  ];

  // Time-based alert patterns
  private readonly alertPatterns = [
    {
      type: 'congestion' as const,
      title: '🚦 Tráfico Pesado',
      message: 'Hay tráfico pesado en {zone}. Considera usar una ruta alternativa.',
      timeSlots: [
        { startHour: 7, endHour: 9, days: [1, 2, 3, 4, 5] },
        { startHour: 12, endHour: 14, days: [1, 2, 3, 4, 5, 6] },
        { startHour: 17, endHour: 19, days: [1, 2, 3, 4, 5] },
      ],
    },
    {
      type: 'road_closed' as const,
      title: '🚧 Camino Cerrado',
      message: 'El camino en {zone} está cerrado temporalmente. Usa la ruta alternativa.',
      timeSlots: [], // Manual triggers
    },
    {
      type: 'event' as const,
      title: '🎉 Evento Especial',
      message: 'Hay un evento especial en {zone}. Se espera tráfico incrementado.',
      timeSlots: [], // Manual triggers
    },
    {
      type: 'weather' as const,
      title: '🌧️ Clima Adverso',
      message: 'Lluvia fuerte reportada en {zone}. Conduce con precaución.',
      timeSlots: [], // Manual triggers
    },
  ];

  constructor(
    private prisma: PrismaService,
    private trafficService: TrafficService,
  ) {}

  /**
   * Get active alerts for a driver's location
   */
  async getActiveAlertsForDriver(
    driverId: string,
    lat?: number,
    lng?: number,
  ): Promise<TrafficAlert[]> {
    const alerts: TrafficAlert[] = [];

    // Check each zone for alerts
    for (const zone of this.alertZones) {
      const traffic = await this.trafficService.getTrafficConditions(zone.lat, zone.lng);

      // Check if traffic level warrants an alert
      if (this.shouldTriggerAlert(traffic.conditions.level, zone.congestionThreshold)) {
        const alert = this.createCongestionAlert(zone, traffic.conditions.level, traffic.conditions.description);
        alerts.push(alert);
      }
    }

    // Check time-based patterns
    const now = new Date();
    const nicoyaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));
    const hour = nicoyaTime.getHours();
    const day = nicoyaTime.getDay();

    for (const pattern of this.alertPatterns) {
      for (const slot of pattern.timeSlots) {
        if (slot.days.includes(day) && hour >= slot.startHour && hour < slot.endHour) {
          // Find affected zone
          const affectedZone = this.alertZones.find(z => z.name.includes('Centro') || z.name.includes('Mercado'));
          if (affectedZone) {
            const alert = this.createTimeBasedAlert(pattern, affectedZone);
            alerts.push(alert);
          }
        }
      }
    }

    // Check for previously read/dismissed alerts
    const userAlerts = await this.prisma.trafficAlert.findMany({
      where: {
        driverId,
        dismissed: false,
        expiresAt: { gt: new Date() },
      },
    });

    // Merge with active alerts, avoiding duplicates
    const activeAlertIds = new Set(userAlerts.map(a => a.alertId));
    const newAlerts = alerts.filter(a => !activeAlertIds.has(a.id));

    return alerts;
  }

  /**
   * Get all active system alerts
   */
  async getSystemAlerts(): Promise<TrafficAlert[]> {
    const alerts: TrafficAlert[] = [];

    for (const zone of this.alertZones) {
      const traffic = await this.trafficService.getTrafficConditions(zone.lat, zone.lng);

      if (this.shouldTriggerAlert(traffic.conditions.level, zone.congestionThreshold)) {
        const alert = this.createCongestionAlert(zone, traffic.conditions.level, traffic.conditions.description);
        alerts.push(alert);
      }
    }

    return alerts;
  }

  /**
   * Create a manual alert (admin only)
   */
  async createManualAlert(data: {
    type: TrafficAlert['type'];
    severity: TrafficAlert['severity'];
    title: string;
    message: string;
    location: { lat: number; lng: number; address: string };
    radius: number;
    durationMinutes: number;
    alternativeRoute?: { description: string; estimatedTimeSaved: number };
  }): Promise<TrafficAlert> {
    const alert: TrafficAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: data.type,
      severity: data.severity,
      title: data.title,
      message: data.message,
      location: data.location,
      affectedArea: { radius: data.radius },
      alternativeRoute: data.alternativeRoute,
      expiresAt: new Date(Date.now() + data.durationMinutes * 60 * 1000),
      createdAt: new Date(),
    };

    // Save to database
    await this.prisma.trafficAlert.create({
      data: {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        lat: alert.location.lat,
        lng: alert.location.lng,
        address: alert.location.address,
        radiusKm: alert.affectedArea.radius,
        expiresAt: alert.expiresAt,
        alternativeDescription: alert.alternativeRoute?.description,
        alternativeTimeSaved: alert.alternativeRoute?.estimatedTimeSaved,
      },
    });

    // Notify all online drivers
    await this.notifyOnlineDrivers(alert);

    this.logger.log(`Manual alert created: ${alert.title}`);
    return alert;
  }

  /**
   * Dismiss an alert for a driver
   */
  async dismissAlert(driverId: string, alertId: string): Promise<void> {
    await this.prisma.trafficAlertNotification.upsert({
      where: {
        driverId_alertId: { driverId, alertId },
      },
      update: { dismissed: true },
      create: {
        driverId,
        alertId,
        dismissed: true,
      },
    });
  }

  /**
   * Mark alert as read
   */
  async markAlertAsRead(driverId: string, alertId: string): Promise<void> {
    await this.prisma.trafficAlertNotification.upsert({
      where: {
        driverId_alertId: { driverId, alertId },
      },
      update: { read: true },
      create: {
        driverId,
        alertId,
        read: true,
      },
    });
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<{
    total: number;
    active: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const now = new Date();
    
    const [total, active, byType, bySeverity] = await Promise.all([
      this.prisma.trafficAlert.count(),
      this.prisma.trafficAlert.count({ where: { expiresAt: { gt: now } } }),
      this.prisma.trafficAlert.groupBy({ by: ['type'], _count: true }),
      this.prisma.trafficAlert.groupBy({ by: ['severity'], _count: true }),
    ]);

    return {
      total,
      active,
      byType: byType.reduce((acc, item) => ({ ...acc, [item.type]: item._count }), {}),
      bySeverity: bySeverity.reduce((acc, item) => ({ ...acc, [item.severity]: item._count }), {}),
    };
  }

  /**
   * Get alternative route suggestion
   */
  async getAlternativeRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<{
    suggested: boolean;
    route?: string;
    timeSaved: number;
    reason: string;
  }> {
    const traffic = await this.trafficService.getTrafficConditions(
      (originLat + destLat) / 2,
      (originLng + destLng) / 2,
    );

    if (traffic.conditions.level === 'heavy' || traffic.conditions.level === 'severe') {
      return {
        suggested: true,
        route: 'Por la perifería (via Santa Cruz)',
        timeSaved: Math.round(traffic.estimatedDelay * 0.6),
        reason: `Tráfico ${traffic.conditions.description} en la ruta principal`,
      };
    }

    return {
      suggested: false,
      timeSaved: 0,
      reason: 'La ruta principal está libre',
    };
  }

  // Private helper methods

  private shouldTriggerAlert(currentLevel: string, threshold: string): boolean {
    const levels = ['free', 'light', 'moderate', 'heavy', 'severe'];
    const currentIndex = levels.indexOf(currentLevel);
    const thresholdIndex = levels.indexOf(threshold);
    return currentIndex >= thresholdIndex;
  }

  private createCongestionAlert(
    zone: { name: string; lat: number; lng: number; radius: number },
    level: string,
    description: string,
  ): TrafficAlert {
    const severity = this.getSeverityFromLevel(level);
    const message = `Hay tráfico ${description} en ${zone.name}. Conduce con precaución.`;

    return {
      id: `congestion_${zone.name}_${Date.now()}`,
      type: 'congestion',
      severity,
      title: `🚦 Tráfico ${description}`,
      message,
      location: {
        lat: zone.lat,
        lng: zone.lng,
        address: zone.name,
      },
      affectedArea: { radius: zone.radius },
      alternativeRoute: level === 'heavy' || level === 'severe' ? {
        description: 'Usa la ruta alternativa por la perifería',
        estimatedTimeSaved: level === 'severe' ? 10 : 5,
      } : undefined,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      createdAt: new Date(),
    };
  }

  private createTimeBasedAlert(
    pattern: typeof this.alertPatterns[0],
    zone: { name: string; lat: number; lng: number; radius: number },
  ): TrafficAlert {
    const severity = pattern.type === 'congestion' ? 'medium' : 'low';
    const message = pattern.message.replace('{zone}', zone.name);

    return {
      id: `time_${pattern.type}_${zone.name}_${Date.now()}`,
      type: pattern.type,
      severity: severity as TrafficAlert['severity'],
      title: pattern.title,
      message,
      location: {
        lat: zone.lat,
        lng: zone.lng,
        address: zone.name,
      },
      affectedArea: { radius: zone.radius },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      createdAt: new Date(),
    };
  }

  private getSeverityFromLevel(level: string): TrafficAlert['severity'] {
    switch (level) {
      case 'severe': return 'critical';
      case 'heavy': return 'high';
      case 'moderate': return 'medium';
      case 'light': return 'low';
      default: return 'low';
    }
  }

  private async notifyOnlineDrivers(alert: TrafficAlert): Promise<void> {
    try {
      // Get all online drivers
      const onlineDrivers = await this.prisma.driverProfile.findMany({
        where: { status: 'online' },
        include: { user: true },
      });

      // Create notifications for each driver in range
      for (const driver of onlineDrivers) {
        if (driver.currentLat && driver.currentLng) {
          const distance = this.calculateDistance(
            driver.currentLat,
            driver.currentLng,
            alert.location.lat,
            alert.location.lng,
          );

          // Only notify drivers within 5km of the alert
          if (distance <= 5) {
            await this.prisma.trafficAlertNotification.create({
              data: {
                driverId: driver.userId,
                alertId: alert.id,
                read: false,
                dismissed: false,
              },
            });

            // Also create a regular notification
            await this.prisma.notification.create({
              data: {
                userId: driver.userId,
                type: 'traffic_alert',
                title: alert.title,
                message: alert.message,
                data: JSON.stringify({ alertId: alert.id }),
              },
            });
          }
        }
      }

      this.logger.log(`Notified ${onlineDrivers.length} drivers about traffic alert`);
    } catch (error) {
      this.logger.error('Failed to notify drivers:', error);
    }
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
