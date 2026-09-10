import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrafficPredictionsService } from '../routing/traffic-predictions.service';

export interface TrafficNotification {
  id: string;
  type:
    | 'prediction_alert'
    | 'best_time'
    | 'peak_hour_warning'
    | 'delivery_delay'
    | 'route_recommendation';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  data: any;
  scheduledAt?: Date;
  sentAt?: Date;
}

export interface NotificationSchedule {
  id: string;
  userId: string;
  type: string;
  enabled: boolean;
  advanceMinutes: number; // How many minutes before to send
  conditions: {
    minConfidence: number;
    trafficLevels: string[];
    hours: number[];
    days: number[];
  };
}

@Injectable()
export class TrafficNotificationService {
  private readonly logger = new Logger(TrafficNotificationService.name);

  constructor(
    private prisma: PrismaService,
    private predictionsService: TrafficPredictionsService,
  ) {}

  /**
   * Send traffic prediction notification to merchant
   */
  async sendPredictionNotification(userId: string, lat: number, lng: number): Promise<void> {
    try {
      // Get user's notification preferences
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.enabled || !preferences.types.prediction) {
        return;
      }

      // Get current prediction
      const now = new Date();
      const prediction = await this.predictionsService.getPrediction(lat, lng, now);

      // Check if prediction meets notification criteria
      if (prediction.confidence < preferences.minConfidence) {
        return;
      }

      if (!preferences.trafficLevels.includes(prediction.predictedLevel)) {
        return;
      }

      // Create and send notification
      const notification = this.createPredictionNotification(prediction);
      await this.sendNotification(userId, notification);

      this.logger.log(`Sent prediction notification to user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to send prediction notification:', error);
    }
  }

  /**
   * Send best time notification
   */
  async sendBestTimeNotification(userId: string, lat: number, lng: number): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.enabled || !preferences.types.bestTime) {
        return;
      }

      // Get best delivery times
      const bestTimes = await this.predictionsService.getBestDeliveryTimes(lat, lng, 1);

      if (bestTimes.length === 0) {
        return;
      }

      // Find next best time
      const now = new Date();
      const currentHour = now.getHours();
      const nextBestTime = bestTimes.find((t) => t.hour > currentHour);

      if (!nextBestTime) {
        return;
      }

      // Create and send notification
      const notification = this.createBestTimeNotification(nextBestTime);
      await this.sendNotification(userId, notification);

      this.logger.log(`Sent best time notification to user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to send best time notification:', error);
    }
  }

  /**
   * Send peak hour warning
   */
  async sendPeakHourWarning(userId: string, lat: number, lng: number): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.enabled || !preferences.types.peakHour) {
        return;
      }

      // Get prediction for next hour
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1);

      const prediction = await this.predictionsService.getPrediction(lat, lng, nextHour);

      // Check if it's a peak hour
      if (prediction.predictedLevel !== 'heavy' && prediction.predictedLevel !== 'severe') {
        return;
      }

      // Create and send notification
      const notification = this.createPeakHourNotification(prediction);
      await this.sendNotification(userId, notification);

      this.logger.log(`Sent peak hour warning to user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to send peak hour warning:', error);
    }
  }

  /**
   * Send delivery delay notification
   */
  async sendDeliveryDelayNotification(
    merchantId: string,
    orderId: string,
    delayMinutes: number,
    reason: string,
  ): Promise<void> {
    try {
      // Get merchant user
      const merchant = await this.prisma.merchantProfile.findUnique({
        where: { id: merchantId },
        include: { user: true },
      });

      if (!merchant) {
        return;
      }

      const preferences = await this.getUserPreferences(merchant.userId);

      if (!preferences.enabled || !preferences.types.deliveryDelay) {
        return;
      }

      // Create and send notification
      const notification = this.createDeliveryDelayNotification(orderId, delayMinutes, reason);
      await this.sendNotification(merchant.userId, notification);

      this.logger.log(`Sent delivery delay notification for order ${orderId}`);
    } catch (error) {
      this.logger.error('Failed to send delivery delay notification:', error);
    }
  }

  /**
   * Send route recommendation
   */
  async sendRouteRecommendation(
    driverId: string,
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(driverId);

      if (!preferences.enabled || !preferences.types.routeRecommendation) {
        return;
      }

      // Get quick suggestion
      const response = await fetch(
        `/api/routing/suggestions/quick?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`,
      );
      const suggestion = await response.json();

      if (!suggestion.suggested || suggestion.timeSaved < 3) {
        return;
      }

      // Create and send notification
      const notification = this.createRouteRecommendationNotification(suggestion);
      await this.sendNotification(driverId, notification);

      this.logger.log(`Sent route recommendation to driver ${driverId}`);
    } catch (error) {
      this.logger.error('Failed to send route recommendation:', error);
    }
  }

  /**
   * Schedule recurring notifications
   */
  async scheduleRecurringNotifications(): Promise<void> {
    try {
      // Get all users with notification preferences
      const users = await this.prisma.user.findMany({
        where: {
          merchantProfile: { isNot: null },
        },
        include: {
          merchantProfile: true,
        },
      });

      for (const user of users) {
        if (user.merchantProfile?.latitude == null || user.merchantProfile?.longitude == null) {
          continue;
        }
        const lat = Number(user.merchantProfile.latitude);
        const lng = Number(user.merchantProfile.longitude);

        // Send prediction notification
        await this.sendPredictionNotification(user.id, lat, lng);

        // Send best time notification (only at 8 AM)
        const hour = new Date().getHours();
        if (hour === 8) {
          await this.sendBestTimeNotification(user.id, lat, lng);
        }

        // Send peak hour warning (every hour)
        await this.sendPeakHourWarning(user.id, lat, lng);
      }

      this.logger.log('Recurring notifications scheduled');
    } catch (error) {
      this.logger.error('Failed to schedule recurring notifications:', error);
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<{
    enabled: boolean;
    types: Record<string, boolean>;
    minConfidence: number;
    trafficLevels: string[];
    hours: number[];
    days: number[];
  }> {
    // In production, fetch from database
    // For now, return defaults
    return {
      enabled: true,
      types: {
        prediction: true,
        bestTime: true,
        peakHour: true,
        deliveryDelay: true,
        routeRecommendation: true,
      },
      minConfidence: 0.7,
      trafficLevels: ['moderate', 'heavy', 'severe'],
      hours: Array.from({ length: 24 }, (_, i) => i), // All hours
      days: [0, 1, 2, 3, 4, 5, 6], // All days
    };
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<{
      enabled: boolean;
      types: Record<string, boolean>;
      minConfidence: number;
      trafficLevels: string[];
      hours: number[];
      days: number[];
    }>,
  ): Promise<void> {
    // In production, save to database
    this.logger.log(`Updated preferences for user ${userId}`);
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(userId: string, limit: number = 20): Promise<TrafficNotification[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        type: 'traffic_prediction',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return notifications.map((n) => ({
      id: n.id,
      type: n.type as any,
      title: n.title,
      message: n.body,
      priority: 'medium' as const,
      data:
        typeof n.data === 'string'
          ? JSON.parse((n.data as string) || '{}')
          : ((n.data as unknown) ?? {}),
      sentAt: n.createdAt,
    }));
  }

  // Private helper methods

  private createPredictionNotification(prediction: any): TrafficNotification {
    const levelMessages: Record<string, string> = {
      free: 'Tráfico libre - ideal para entregas',
      light: 'Tráfico ligero - buen momento para enviar',
      moderate: 'Tráfico moderado - considera retrasar',
      heavy: 'Tráfico pesado - evita enviar repartidores',
      severe: 'Tráfico severo - no recomendar entregas',
    };

    const levelEmojis: Record<string, string> = {
      free: '🟢',
      light: '🟡',
      moderate: '🟠',
      heavy: '🔴',
      severe: '⛔',
    };

    return {
      id: `pred_${Date.now()}`,
      type: 'prediction_alert',
      title: `${levelEmojis[prediction.predictedLevel]} Predicción de Tráfico`,
      message: levelMessages[prediction.predictedLevel],
      priority: prediction.predictedLevel === 'severe' ? 'high' : 'medium',
      data: {
        level: prediction.predictedLevel,
        speed: prediction.predictedSpeed,
        confidence: prediction.confidence,
      },
    };
  }

  private createBestTimeNotification(bestTime: any): TrafficNotification {
    return {
      id: `best_${Date.now()}`,
      type: 'best_time',
      title: '💡 Mejor Momento para Entregas',
      message: `El tráfico está ${bestTime.level} a las ${bestTime.hour}:00 - ${bestTime.recommendation}`,
      priority: 'low',
      data: {
        hour: bestTime.hour,
        level: bestTime.level,
        speed: bestTime.speed,
      },
    };
  }

  private createPeakHourNotification(prediction: any): TrafficNotification {
    return {
      id: `peak_${Date.now()}`,
      type: 'peak_hour_warning',
      title: '⚠️ Hora Pico se Acerca',
      message: `Se espera tráfico ${prediction.predictedLevel} en la próxima hora. Planifica tus entregas.`,
      priority: 'high',
      data: {
        predictedLevel: prediction.predictedLevel,
        confidence: prediction.confidence,
      },
    };
  }

  private createDeliveryDelayNotification(
    orderId: string,
    delayMinutes: number,
    reason: string,
  ): TrafficNotification {
    return {
      id: `delay_${Date.now()}`,
      type: 'delivery_delay',
      title: '⏱️ Retraso en Entrega',
      message: `Pedido #${orderId.slice(0, 8)} tiene un retraso de ${delayMinutes} min. Motivo: ${reason}`,
      priority: 'medium',
      data: {
        orderId,
        delayMinutes,
        reason,
      },
    };
  }

  private createRouteRecommendationNotification(suggestion: any): TrafficNotification {
    return {
      id: `route_${Date.now()}`,
      type: 'route_recommendation',
      title: '🗺️ Ruta Alternativa Disponible',
      message: `Hay una ruta ${suggestion.timeSaved} min más rápida disponible`,
      priority: 'medium',
      data: {
        timeSaved: suggestion.timeSaved,
        reason: suggestion.reason,
      },
    };
  }

  private async sendNotification(userId: string, notification: TrafficNotification): Promise<void> {
    // Save to database
    await this.prisma.notification.create({
      data: {
        userId,
        type: 'traffic_prediction',
        title: notification.title,
        body: notification.message,
        data: (notification.data ?? {}) as object,
      },
    });

    // Send push notification (if FCM token exists)
    // In production, use Firebase Admin SDK
    this.logger.log(`Notification sent to user ${userId}: ${notification.title}`);
  }
}
