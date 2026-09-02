import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private fcmInitialized = false;

  constructor(private prisma: PrismaService) {
    this.initializeFCM();
  }

  private async initializeFCM() {
    try {
      // Firebase Admin SDK initialization would go here
      // For now, we'll use a mock implementation
      this.logger.log('Firebase Cloud Messaging initialized (mock mode)');
      this.fcmInitialized = true;
    } catch (error) {
      this.logger.warn('FCM not configured, using in-app notifications only');
    }
  }

  // ============================================
  // 📤 SEND NOTIFICATIONS
  // ============================================

  async sendToUser(userId: string, notification: PushNotification) {
    // Save to database
    const savedNotification = await this.prisma.notification.create({
      data: {
        userId,
        title: notification.title,
        body: notification.body,
        type: 'push',
        data: notification.data || {},
      },
    });

    // Try to send push notification
    if (this.fcmInitialized) {
      await this.sendPushNotification(userId, notification);
    }

    return savedNotification;
  }

  async sendToMultipleUsers(userIds: string[], notification: PushNotification) {
    const results = await Promise.allSettled(
      userIds.map(userId => this.sendToUser(userId, notification))
    );

    return {
      success: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    };
  }

  async sendToRole(role: string, notification: PushNotification) {
    const users = await this.prisma.user.findMany({
      where: { role: role as any, status: 'active' },
      select: { id: true },
    });

    return this.sendToMultipleUsers(users.map(u => u.id), notification);
  }

  private async sendPushNotification(userId: string, notification: PushNotification) {
    try {
      // Get user's FCM token
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found for push notification`);
        return;
      }

      // In production, this would use Firebase Admin SDK:
      // await admin.messaging().send({
      //   token: fcmToken,
      //   notification: {
      //     title: notification.title,
      //     body: notification.body,
      //     imageUrl: notification.imageUrl,
      //   },
      //   data: notification.data,
      // });

      this.logger.log(`Push notification sent to user ${userId}: ${notification.title}`);
    } catch (error) {
      this.logger.error(`Failed to send push notification to ${userId}:`, error);
    }
  }

  // ============================================
  // 📥 GET NOTIFICATIONS
  // ============================================

  async getUserNotifications(userId: string, options?: { limit?: number; unreadOnly?: boolean }) {
    const limit = options?.limit || 50;
    const unreadOnly = options?.unreadOnly || false;

    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.update({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: { read: true },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    return this.prisma.notification.delete({
      where: {
        id: notificationId,
        userId,
      },
    });
  }

  // ============================================
  // 🔔 ORDER NOTIFICATIONS
  // ============================================

  async notifyNewOrder(merchantId: string, orderId: string) {
    return this.sendToRole('driver', {
      title: '📦 Nuevo pedido disponible',
      body: 'Un comerciante necesita un repartidor',
      data: { orderId, type: 'new_order' },
    });
  }

  async notifyOrderAccepted(orderId: string, merchantId: string, driverName: string) {
    return this.sendToUser(merchantId, {
      title: '✅ Pedido aceptado',
      body: `${driverName} aceptó tu pedido #${orderId.slice(0, 8)}`,
      data: { orderId, type: 'order_accepted' },
    });
  }

  async notifyOrderStatusUpdate(orderId: string, userId: string, status: string) {
    const statusMessages: Record<string, { title: string; body: string }> = {
      assigned: { title: '🛵 Pedido asignado', body: 'Un repartidor va por tu pedido' },
      picked_up: { title: '📦 Pedido recogido', body: 'El repartidor recogió tu pedido' },
      in_transit_to_delivery: { title: '🛣️ En camino', body: 'Tu pedido va en camino' },
      delivered: { title: '🎉 Pedido entregado', body: 'Tu pedido fue entregado exitosamente' },
      cancelled: { title: '❌ Pedido cancelado', body: 'El pedido fue cancelado' },
    };

    const message = statusMessages[status] || { title: 'Actualización', body: `Estado: ${status}` };

    return this.sendToUser(userId, {
      ...message,
      data: { orderId, type: 'order_status', status },
    });
  }

  async notifyPaymentReceived(orderId: string, merchantId: string, amount: number) {
    return this.sendToUser(merchantId, {
      title: '💰 Pago recibido',
      body: `Recibiste ₡${amount.toLocaleString()} por el pedido #${orderId.slice(0, 8)}`,
      data: { orderId, type: 'payment_received' },
    });
  }

  async notifyNewRating(driverId: string, rating: number, merchantName: string) {
    return this.sendToUser(driverId, {
      title: '⭐ Nueva calificación',
      body: `${merchantName} te calificó con ${rating} estrellas`,
      data: { type: 'new_rating', rating: String(rating) },
    });
  }

  // ============================================
  // 📱 DEVICE TOKEN MANAGEMENT
  // ============================================

  async registerDeviceToken(userId: string, token: string, platform: 'ios' | 'android' | 'web') {
    // Store device token for push notifications
    this.logger.log(`Device token registered for user ${userId}: ${platform}`);
    
    // In production, store in a device_tokens table
    return { success: true };
  }

  async removeDeviceToken(userId: string, token: string) {
    this.logger.log(`Device token removed for user ${userId}`);
    return { success: true };
  }
}
