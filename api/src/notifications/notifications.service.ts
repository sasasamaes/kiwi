import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';
import { TOPIC_CATALOG, getTopic, topicsForRole } from './topics';

export { TOPIC_CATALOG, getTopic, topicsForRole };
export interface PushNotification {
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
  private fcmAdmin: any = null;

  constructor(private prisma: PrismaService) {
    void this.initializeFCM();
  }
  private async initializeFCM() {
    try {
      // In production, set FIREBASE_SERVICE_ACCOUNT env var with the service account JSON
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

      if (!serviceAccount) {
        this.logger.warn('FIREBASE_SERVICE_ACCOUNT ausente, using in-app notifications only');
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(serviceAccount);
      } catch (e) {
        this.logger.warn(
          `FIREBASE_SERVICE_ACCOUNT inválido (no es JSON de una línea): ${String(e)}. using in-app notifications only`,
        );
        return;
      }

      if (!parsed?.project_id || !parsed?.private_key || !parsed?.client_email) {
        this.logger.warn(
          'FIREBASE_SERVICE_ACCOUNT incompleto (falta project_id/private_key/client_email), using in-app notifications only',
        );
        return;
      }

      // API modular v12+ (no namespace `admin`): el estilo viejo
      // `admin.credential.cert` no existe en v14 y el init fallaba con
      // "credential must be an object which implements Credential".
      if (!getApps().length) {
        initializeApp({
          credential: cert(parsed),
        });
      }

      this.fcmAdmin = getMessaging();
      this.logger.log('Firebase Cloud Messaging initialized successfully');
    } catch (e) {
      // El motivo exacto (cert inválido, duplicate app, import) es lo único
      // que distingue "var mal pegada" de "bug de init": no tragarlo.
      this.logger.warn(
        `FCM not configured (${String(e)?.slice(0, 300)}), using in-app notifications only`,
      );
    }
  }

  // ============================================
  // 📡 TOPICS — suscripción y publicación
  // ============================================

  /**
   * Sincroniza las suscripciones FCM de TODOS los tokens del usuario con sus
   * preferencias para su rol. Idempotente: FCM ignora re-suscripciones.
   */
  async syncTopicSubscriptions(userId: string): Promise<{ synced: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) return { synced: 0 };

    const roleTopics = topicsForRole(user.role);
    const prefs = await this.prisma.topicPreference.findMany({ where: { userId } });
    const prefMap = new Map(prefs.map((p) => [p.topic, p.enabled]));

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (!this.fcmAdmin || tokens.length === 0) {
      // Sin FCM o sin tokens: solo persistimos defaults para que el primer
      // login con push ya tenga preferencias.
      for (const t of roleTopics) {
        if (!prefMap.has(t.name)) {
          await this.prisma.topicPreference.create({
            data: { userId, topic: t.name, enabled: t.defaultEnabled },
          });
        }
      }
      return { synced: 0 };
    }

    let synced = 0;
    for (const topic of roleTopics) {
      const enabled = prefMap.get(topic.name) ?? topic.defaultEnabled;
      if (!prefMap.has(topic.name)) {
        await this.prisma.topicPreference.create({
          data: { userId, topic: topic.name, enabled },
        });
      }
      for (const { token } of tokens) {
        try {
          if (enabled) {
            await this.fcmAdmin.subscribeToTopic([token], topic.name);
          } else {
            await this.fcmAdmin.unsubscribeFromTopic([token], topic.name);
          }
          synced++;
        } catch (error) {
          this.logger.warn(`FCM topic sync failed (${topic.name}): ${String(error)}`);
        }
      }
    }
    return { synced };
  }

  /** Cambia una preferencia y re-sincroniza FCM para ese usuario. */
  async setTopicPreference(userId: string, topic: string, enabled: boolean) {
    const def = getTopic(topic);
    if (!def) throw new Error(`Unknown topic: ${topic}`);
    if (def.locked && !enabled) throw new Error(`Topic ${topic} es obligatorio`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || def.audience !== user.role) {
      throw new Error(`Topic ${topic} no disponible para rol ${user?.role ?? 'desconocido'}`);
    }

    await this.prisma.topicPreference.upsert({
      where: { userId_topic: { userId, topic } },
      update: { enabled },
      create: { userId, topic, enabled },
    });

    await this.syncTopicSubscriptions(userId);
    return { success: true };
  }

  /** Preferencias del usuario para su rol, con defaults aplicados. */
  async getTopicPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) return [];

    const roleTopics = topicsForRole(user.role);
    const prefs = await this.prisma.topicPreference.findMany({ where: { userId } });
    const prefMap = new Map(prefs.map((p) => [p.topic, p.enabled]));

    return roleTopics.map((t) => ({
      ...t,
      enabled: prefMap.get(t.name) ?? t.defaultEnabled,
    }));
  }

  /**
   * Publica a un topic. Crea la fila in-app SOLO para topics push+inbox
   * (los de audiencia amplia no ensucian la campana — el socket ya cubre
   * lo in-app). Sin FCM configurado, degrada a inbox-only silencioso.
   */
  async publishToTopic(topicName: string, notification: PushNotification) {
    const def = getTopic(topicName);
    if (!def) {
      this.logger.warn(`publishToTopic: topic desconocido ${topicName}`);
      return { delivered: 0, inbox: 0 };
    }

    let delivered = 0;
    if (this.fcmAdmin) {
      try {
        const resp = await this.fcmAdmin.send({
          topic: topicName,
          notification: {
            title: notification.title,
            body: notification.body,
            imageUrl: notification.imageUrl,
          },
          data: notification.data ?? {},
        });
        delivered = 1; // FCM confirma aceptación del mensaje al topic
        this.logger.log(`Published to ${topicName}: ${resp}`);
      } catch (error) {
        this.logger.error(`FCM publish to ${topicName} failed: ${String(error)}`);
      }
    }

    let inbox = 0;
    if (def.delivery === 'push+inbox') {
      // Destinatarios = usuarios del rol con la preferencia activa.
      const roleWhere =
        def.audience === 'admin'
          ? { role: 'admin' as const }
          : { role: def.audience as 'driver' | 'merchant', status: 'active' as const };

      const users = await this.prisma.user.findMany({
        where: roleWhere,
        select: { id: true },
      });
      const prefs = await this.prisma.topicPreference.findMany({
        where: { topic: topicName, enabled: true, userId: { in: users.map((u) => u.id) } },
        select: { userId: true },
      });

      if (prefs.length > 0) {
        const rows = await Promise.allSettled(
          prefs.map((p) =>
            this.prisma.notification.create({
              data: {
                userId: p.userId,
                title: notification.title,
                body: notification.body,
                type: `topic:${topicName}`,
                data: notification.data ?? {},
              },
            }),
          ),
        );
        inbox = rows.filter((r) => r.status === 'fulfilled').length;
      }
    }

    return { delivered, inbox };
  }

  // ============================================
  // 📤 SEND NOTIFICATIONS (directas, 1:1)
  // ============================================

  async sendToUser(userId: string, notification: PushNotification) {
    // Guard: respeta la preferencia del destinatario cuando el tipo mapea a
    // un topic (las directas 1:1 de eventos críticos no se filtran).
    const savedNotification = await this.prisma.notification.create({
      data: {
        userId,
        title: notification.title,
        body: notification.body,
        type: notification.data?.type ? `push:${notification.data.type}` : 'push',
        data: notification.data || {},
      },
    });

    if (this.fcmAdmin) {
      await this.sendPushToTokens(userId, notification);
    }

    return savedNotification;
  }

  async sendToMultipleUsers(userIds: string[], notification: PushNotification) {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.sendToUser(userId, notification)),
    );

    return {
      success: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  }

  async sendToRole(role: string, notification: PushNotification) {
    const users = await this.prisma.user.findMany({
      where: { role: role as any, status: 'active' },
      select: { id: true },
    });

    return this.sendToMultipleUsers(
      users.map((u) => u.id),
      notification,
    );
  }

  /** Push real 1:1 a todos los tokens registrados del usuario. */
  private async sendPushToTokens(userId: string, notification: PushNotification) {
    if (!this.fcmAdmin) return;

    try {
      const tokens = await this.prisma.deviceToken.findMany({
        where: { userId },
        select: { token: true },
      });
      if (tokens.length === 0) return;

      const expired: string[] = [];
      for (const { token } of tokens) {
        try {
          await this.fcmAdmin.send({
            token,
            notification: {
              title: notification.title,
              body: notification.body,
              imageUrl: notification.imageUrl,
            },
            data: notification.data ?? {},
            webpush: {
              fcmOptions: {
                link: notification.data?.orderId ? `/tracking/${notification.data.orderId}` : '/',
              },
            },
          });
        } catch (error: any) {
          const code = error?.errorInfo?.code ?? error?.code ?? '';
          if (
            code.includes('unregistered') ||
            code.includes('invalid-registration-token') ||
            code.includes('registration-token-not-registered')
          ) {
            expired.push(token);
          }
          this.logger.warn(`Push to token failed: ${code || String(error)}`);
        }
      }

      // Limpieza de tokens muertos — sin esto el registro se pudre.
      if (expired.length > 0) {
        await this.prisma.deviceToken.deleteMany({ where: { token: { in: expired } } });
        this.logger.log(`Removed ${expired.length} expired device tokens`);
      }
    } catch (error) {
      this.logger.error(`sendPushToTokens(${userId}) failed: ${String(error)}`);
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
    const updated = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
      data: { read: true },
    });
    if (updated.count === 0) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return updated;
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
    return this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId,
      },
    });
  }

  // ============================================
  // 🔔 EVENTOS → TOPICS (llamados desde órdenes, retiros, ratings)
  // ============================================

  /** Pedido nuevo publicado → topic amplio de drivers. */
  async notifyNewOrderTopic(order: {
    id: string;
    pickupAddress: string;
    deliveryAddress: string;
    totalAmount: any;
    distanceKm: any;
    driverPayout?: any;
  }) {
    // Al driver se le muestra SU ganancia, no el total con productos.
    const gain =
      order.driverPayout != null ? Number(order.driverPayout) : Number(order.totalAmount);
    return this.publishToTopic('driver.orders.new', {
      title: '📦 Nuevo pedido disponible',
      body: `₡${gain.toLocaleString()} · ${order.pickupAddress} → ${order.deliveryAddress}`,
      data: { orderId: order.id, type: 'new_order' },
    });
  }

  /**
   * Alerta de pedido nuevo dirigida a UN driver (targeting por proximidad).
   *
   * Push-only + socket: SIN fila en la campana (el topic 'driver.orders.new'
   * es delivery 'push' — el in-app lo cubre el evento socket 'order:new').
   * Respeta la preferencia del topic: si el driver lo apagó, no lo alertamos
   * ni por socket ni por push.
   */
  async notifyDriverNewOrderTargeted(
    userId: string,
    order: {
      id: string;
      pickupAddress: string;
      deliveryAddress: string;
      totalAmount: any;
      distanceKm: any;
      driverPayout?: any;
    },
  ) {
    const prefs = await this.prisma.topicPreference.findMany({
      where: { userId, topic: 'driver.orders.new', enabled: true },
      select: { userId: true },
    });
    if (prefs.length === 0) return { skipped: 'preference_off' as const };

    const gain =
      order.driverPayout != null ? Number(order.driverPayout) : Number(order.totalAmount);
    if (this.fcmAdmin) {
      await this.sendPushToTokens(userId, {
        title: '📦 Nuevo pedido cerca de ti',
        body: `₡${gain.toLocaleString()} · ${order.pickupAddress} → ${order.deliveryAddress}`,
        data: { orderId: order.id, type: 'new_order' },
      });
    }
    return { delivered: true };
  }

  /** Estado del pedido → al comercio (push directo + inbox). */
  async notifyOrderAccepted(orderId: string, merchantUserId: string, driverName: string) {
    return this.sendToUser(merchantUserId, {
      title: '✅ Pedido aceptado',
      body: `${driverName} aceptó tu pedido #${orderId.slice(0, 8)}`,
      data: { orderId, type: 'order_accepted' },
    });
  }

  /** El asignado rechazó → el comercio debe reasignar (push directo + inbox). */
  async notifyOrderRejected(orderId: string, merchantUserId: string, driverName: string) {
    return this.sendToUser(merchantUserId, {
      title: '⚠️ Repartidor rechazó el pedido',
      body: `${driverName} rechazó tu pedido #${orderId.slice(0, 8)}. Reasignalo a otro repartidor.`,
      data: { orderId, type: 'order_rejected' },
    });
  }

  async notifyOrderStatusUpdate(
    orderId: string,
    userId: string,
    status: string,
    perspective: 'merchant' | 'driver' = 'merchant',
  ) {
    const merchantMessages: Record<string, { title: string; body: string }> = {
      assigned: { title: '🛵 Pedido asignado', body: 'Un repartidor va por tu pedido' },
      in_transit_to_pickup: {
        title: '🛵 Repartidor en camino',
        body: 'El repartidor va en camino a recoger tu pedido',
      },
      picked_up: { title: '📦 Pedido recogido', body: 'El repartidor recogió tu pedido' },
      in_transit_to_delivery: { title: '🛣️ En camino', body: 'Tu pedido va en camino' },
      delivered: { title: '🎉 Pedido entregado', body: 'Tu pedido fue entregado exitosamente' },
      cancelled: { title: '❌ Pedido cancelado', body: 'El pedido fue cancelado' },
    };

    const driverMessages: Record<string, { title: string; body: string }> = {
      assigned: { title: '🛵 Pedido asignado', body: 'Te asignaron un pedido. Ve a recogerlo.' },
      in_transit_to_pickup: {
        title: '🛵 En camino al comercio',
        body: 'Vas en camino a recoger el pedido',
      },
      picked_up: {
        title: '📦 Pedido recogido',
        body: 'Recogiste el pedido. Llévalo a su destino.',
      },
      in_transit_to_delivery: { title: '🛣️ En camino', body: 'Vas en camino a entregar el pedido' },
      delivered: { title: '🎉 Pedido entregado', body: 'Entregaste el pedido exitosamente' },
      cancelled: { title: '❌ Pedido cancelado', body: 'El pedido fue cancelado' },
    };

    const messages = perspective === 'driver' ? driverMessages : merchantMessages;
    const message = messages[status] || { title: 'Actualización', body: `Estado: ${status}` };

    return this.sendToUser(userId, {
      ...message,
      data: { orderId, type: 'order_status', status },
    });
  }

  async notifyPaymentReceived(orderId: string, merchantUserId: string, amount: number) {
    return this.sendToUser(merchantUserId, {
      title: '💰 Pago recibido',
      body: `Recibiste ₡${amount.toLocaleString()} por el pedido #${orderId.slice(0, 8)}`,
      data: { orderId, type: 'payment_received' },
    });
  }

  async notifyNewRating(driverUserId: string, rating: number, merchantName: string) {
    return this.sendToUser(driverUserId, {
      title: '⭐ Nueva calificación',
      body: `${merchantName} te calificó con ${rating} estrellas`,
      data: { type: 'new_rating', rating: String(rating) },
    });
  }

  async notifyWithdrawalStatus(userId: string, status: string, amount: number) {
    const messages: Record<string, { title: string; body: string }> = {
      pending: {
        title: '⏳ Retiro solicitado',
        body: `Solicitaste retirar ₡${amount.toLocaleString()}`,
      },
      processing: {
        title: '🔄 Retiro en proceso',
        body: `Tu retiro de ₡${amount.toLocaleString()} está siendo procesado`,
      },
      completed: {
        title: '✅ Retiro completado',
        body: `Tu retiro de ₡${amount.toLocaleString()} fue completado`,
      },
      rejected: {
        title: '❌ Retiro rechazado',
        body: `Tu retiro de ₡${amount.toLocaleString()} fue rechazado`,
      },
    };

    const message = messages[status] || { title: 'Retiro', body: `Estado: ${status}` };

    return this.sendToUser(userId, {
      ...message,
      data: { type: 'withdrawal', status },
    });
  }

  // ============================================
  // 📱 DEVICE TOKEN MANAGEMENT
  // ============================================

  async registerDeviceToken(userId: string, token: string, platform: 'ios' | 'android' | 'web') {
    await this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform, lastUsedAt: new Date() },
      create: { userId, token, platform },
    });

    // Asegura preferencias por defecto y suscripción FCM para este token.
    await this.syncTopicSubscriptions(userId);

    return { success: true };
  }

  async removeDeviceToken(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, token },
    });
    return { success: true };
  }

  /**
   * Autodiagnóstico de push para el propio usuario (botón "Probar" de la
   * app). Devuelve DÓNDE se corta la cadena: sin tokens registrados, FCM
   * sin configurar en el servidor, o el error exacto de FCM por token.
   * Sin esto, cada fallo es silencioso y el "no me llega nada" es
   * indebuggable en producción.
   */
  async sendTestPush(userId: string): Promise<{
    fcmConfigured: boolean;
    tokens: number;
    results: Array<{ token: string; ok: boolean; error?: string }>;
  }> {
    const results: Array<{ token: string; ok: boolean; error?: string }> = [];
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true, platform: true, lastUsedAt: true },
    });

    if (!this.fcmAdmin) {
      return { fcmConfigured: false, tokens: tokens.length, results };
    }

    for (const { token, platform } of tokens) {
      const short = `…${token.slice(-8)} (${platform})`;
      try {
        await this.fcmAdmin.send({
          token,
          notification: {
            title: '🥝 Prueba de alertas',
            body: 'Si lees esto, las alertas funcionan en este dispositivo.',
          },
          data: { type: 'test' },
        });
        results.push({ token: short, ok: true });
      } catch (error: any) {
        const code = error?.errorInfo?.code ?? error?.code ?? String(error);
        results.push({ token: short, ok: false, error: code });
      }
    }
    return { fcmConfigured: true, tokens: tokens.length, results };
  }
}
