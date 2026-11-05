// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';
import { TOPIC_CATALOG, getTopic, topicsForRole } from './topics';
import { findDeliveryZone } from '../orders/delivery-zones';

export { TOPIC_CATALOG, getTopic, topicsForRole };
export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  /** push:false = solo inbox, sin FCM (el historial se conserva). */
  push?: boolean;
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
          data: this.toDataPayload(notification),
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
          : {
              role: def.audience as 'driver' | 'merchant' | 'customer',
              status: 'active' as const,
            };

      const users = await this.prisma.user.findMany({
        where: roleWhere,
        select: { id: true },
      });
      const prefs = await this.prisma.topicPreference.findMany({
        where: { topic: topicName, enabled: true, userId: { in: users.map((u) => u.id) } },
        select: { userId: true },
      });

      if (prefs.length > 0) {
        // Bulk: 1 escritura en vez de N round-trips (N+1 en el fan-out).
        const CHUNK = 200;
        for (let i = 0; i < prefs.length; i += CHUNK) {
          const batch = prefs.slice(i, i + CHUNK);
          try {
            const res = await this.prisma.notification.createMany({
              data: batch.map((p) => ({
                userId: p.userId,
                title: notification.title,
                body: notification.body,
                type: `topic:${topicName}`,
                data: notification.data ?? {},
              })),
              skipDuplicates: true,
            });
            inbox += res.count;
          } catch (error) {
            this.logger.warn(`publishToTopic inbox batch failed: ${String(error)}`);
          }
        }
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

    if (this.fcmAdmin && notification.push !== false) {
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

  /**
   * Push de chat a UN usuario SIN fila de inbox (la fila la crea el
   * ChatService por destinatario). Solo FCM data-message; sin tokens o sin
   * FCM es no-op silencioso.
   */
  async pushChatMessage(
    userId: string,
    msg: { orderId: string; senderId: string; senderRole: string; text: string; messageId: string },
  ): Promise<void> {
    if (!this.fcmAdmin) return;
    const roleLabel =
      msg.senderRole === 'merchant'
        ? 'el comercio'
        : msg.senderRole === 'driver'
          ? 'el repartidor'
          : 'el cliente';
    await this.sendPushToTokens(userId, {
      title: `Nuevo mensaje de ${roleLabel}`,
      body: msg.text.slice(0, 200),
      data: {
        type: 'chat',
        orderId: msg.orderId,
        senderId: msg.senderId,
        senderRole: msg.senderRole,
        messageId: msg.messageId,
      },
    });
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

  /**
   * Aviso a seguidores de un comercio (anuncio de venta o reposición).
   * Respeta el opt-out `customer.follows`: quien lo apagó no recibe nada.
   * Devuelve cuántos seguidores fueron alcanzados.
   */
  async notifyFollowers(
    merchantId: string,
    notification: { title: string; body: string; data?: Record<string, string> },
  ): Promise<{ reached: number }> {
    const follows = await this.prisma.merchantFollow.findMany({
      where: { merchantId, user: { status: 'active' } },
      select: { userId: true },
    });
    if (follows.length === 0) return { reached: 0 };
    const ids = [...new Set(follows.map((f) => f.userId))];

    const optedOut = await this.prisma.topicPreference.findMany({
      where: { userId: { in: ids }, topic: 'customer.follows', enabled: false },
      select: { userId: true },
    });
    const outSet = new Set(optedOut.map((o) => o.userId));
    const targets = ids.filter((id) => !outSet.has(id));
    if (targets.length === 0) return { reached: 0 };

    await this.sendToMultipleUsers(targets, {
      title: notification.title,
      body: notification.body,
      data: { type: 'merchant-follow', merchantId, ...(notification.data ?? {}) },
    });
    return { reached: targets.length };
  }

  /**
   * Payload data-only: título/cuerpo viajan en `data` y el SW los muestra
   * con showNotification. NO se manda bloque `notification`: con bloque, el
   * SDK de FCM muestra su propio banner ADEMÁS del nuestro (1 envío = 2
   * banners en el celu). Todos los valores de data deben ser strings.
   */
  private toDataPayload(notification: PushNotification): Record<string, string> {
    const data: Record<string, string> = {
      title: notification.title,
      body: notification.body,
    };
    if (notification.imageUrl) data.image = notification.imageUrl;
    for (const [k, v] of Object.entries(notification.data ?? {})) {
      data[k] = typeof v === 'string' ? v : String(v ?? '');
    }
    return data;
  }

  /**
   * Mensaje para apps NATIVAS (iOS/Android): con bloque `notification` el
   * sistema muestra banner y suena aunque la app esté cerrada. El data-only
   * solo sirve para web (lo muestra el SW): en nativo sin handler no se
   * renderiza nada — por eso "no llegaba nada" en los teléfos.
   */
  private toNativeMessage(
    token: string,
    notification: PushNotification,
    data: Record<string, string>,
  ) {
    return {
      token,
      notification: { title: notification.title, body: notification.body },
      data,
      android: {
        priority: 'high' as const,
        notification: { channelId: 'kiwi-default', sound: 'default' },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };
  }

  /** Push real 1:1 a todos los tokens registrados del usuario. */
  private async sendPushToTokens(userId: string, notification: PushNotification) {
    if (!this.fcmAdmin) return;

    try {
      const tokens = await this.prisma.deviceToken.findMany({
        where: { userId },
        select: { token: true, platform: true },
      });
      // Defensa: filas repetidas del mismo token (reintentos de registro)
      // mandarían el mismo pedido N veces al mismo celu.
      const seen = new Set<string>();
      const unique = tokens.filter((t) => {
        if (seen.has(t.token)) return false;
        seen.add(t.token);
        return true;
      });
      if (unique.length === 0) return;

      // Plataforma primaria: si el usuario tiene tokens ahí, avisar SOLO
      // ahí (PWA + nativa con el mismo nombre duplicaban el banner).
      // Sin primaria o sin tokens en ella: a todas como antes.
      let targets = unique;
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { primaryPushPlatform: true },
        });
        const primary = (user as any)?.primaryPushPlatform as string | null;
        if (primary) {
          const inPrimary = unique.filter((t) => t.platform === primary);
          if (inPrimary.length > 0) targets = inPrimary;
        }
      } catch {
        // best-effort: ante cualquier duda, avisar a todas
      }

      const data = this.toDataPayload(notification);
      const expired: string[] = [];
      for (const { token, platform } of targets) {
        try {
          await this.fcmAdmin.send(
            platform === 'web'
              ? {
                  token,
                  data,
                  webpush: {
                    fcmOptions: {
                      link: notification.data?.orderId
                        ? `/tracking/${notification.data.orderId}`
                        : '/',
                    },
                  },
                }
              : this.toNativeMessage(token, notification, data),
          );
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

  /**
   * Ruta corta para el push de pedido nuevo: "KyL Bowls ➡️ Los Ángeles".
   * El barrio (legible de un vistazo) reemplaza a la dirección exacta; el
   * detalle completo sigue en la app. Sin nombre de comercio o zona, cae a
   * pickup/dirección como antes.
   */
  private newOrderRoute(order: {
    merchantName?: string | null;
    pickupAddress: string;
    deliveryAddress: string;
    deliveryZone?: string | null;
  }): string {
    const merchant = order.merchantName?.trim() || order.pickupAddress;
    const zone =
      (order.deliveryZone ? findDeliveryZone(order.deliveryZone)?.label : null) ||
      order.deliveryAddress;
    return `${merchant} ➡️ ${zone}`;
  }

  /** Pedido nuevo publicado → topic amplio de drivers. */
  async notifyNewOrderTopic(order: {
    id: string;
    pickupAddress: string;
    deliveryAddress: string;
    totalAmount: any;
    distanceKm: any;
    driverPayout?: any;
    merchantName?: string | null;
    deliveryZone?: string | null;
  }) {
    return this.publishToTopic('driver.orders.new', {
      title: '📦 Nuevo pedido disponible',
      body: this.newOrderRoute(order),
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
      merchantName?: string | null;
      deliveryZone?: string | null;
    },
  ) {
    const prefs = await this.prisma.topicPreference.findMany({
      where: { userId, topic: 'driver.orders.new', enabled: true },
      select: { userId: true },
    });
    if (prefs.length === 0) return { skipped: 'preference_off' as const };

    if (this.fcmAdmin) {
      await this.sendPushToTokens(userId, {
        title: '📦 Nuevo pedido cerca de ti',
        body: this.newOrderRoute(order),
        data: { orderId: order.id, type: 'new_order' },
      });
    }
    return { delivered: true };
  }

  /**
   * Pedido PROGRAMADO publicado → mismo topic de drivers, pero copia propia
   * (se propone, no se acepta) y data type distinto para que la app abra la
   * página de programados en vez de Disponibles.
   */
  async notifyScheduledOrderTopic(order: {
    id: string;
    pickupAddress: string;
    deliveryAddress: string;
    totalAmount: any;
    distanceKm: any;
    driverPayout?: any;
    scheduledTime?: string | null;
    merchantName?: string | null;
    deliveryZone?: string | null;
  }) {
    const when = order.scheduledTime ? ` · ⏰ ${order.scheduledTime}` : '';
    return this.publishToTopic('driver.orders.new', {
      title: '📅 Nuevo pedido programado',
      body: `${this.newOrderRoute(order)}${when}`,
      data: { orderId: order.id, type: 'new_scheduled_order' },
    });
  }

  /** Alerta de programado dirigida a UN driver (mismo targeting por proximidad). */
  async notifyDriverScheduledOrderTargeted(
    userId: string,
    order: {
      id: string;
      pickupAddress: string;
      deliveryAddress: string;
      totalAmount: any;
      distanceKm: any;
      driverPayout?: any;
      scheduledTime?: string | null;
      merchantName?: string | null;
      deliveryZone?: string | null;
    },
  ) {
    const prefs = await this.prisma.topicPreference.findMany({
      where: { userId, topic: 'driver.orders.new', enabled: true },
      select: { userId: true },
    });
    if (prefs.length === 0) return { skipped: 'preference_off' as const };

    const when = order.scheduledTime ? ` · ⏰ ${order.scheduledTime}` : '';
    if (this.fcmAdmin) {
      await this.sendPushToTokens(userId, {
        title: '📅 Pedido programado cerca de ti',
        body: `${this.newOrderRoute(order)}${when}`,
        data: { orderId: order.id, type: 'new_scheduled_order' },
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

  /** Pedido nuevo → al comercio (push directo + inbox). El KDS lo escucha por socket. */
  async notifyMerchantNewOrder(
    orderId: string,
    merchantUserId: string,
    info: { total?: number; orderType?: string } = {},
  ) {
    const short = orderId.slice(0, 8).toUpperCase();
    const kind = info.orderType === 'scheduled' ? 'programado' : 'nuevo';
    const money = info.total != null ? ` · ₡${Number(info.total).toLocaleString('es-CR')}` : '';
    return this.sendToUser(merchantUserId, {
      title: '🔔 Nuevo pedido',
      body: `Pedido ${kind} #${short}${money}`,
      data: { orderId, type: 'new_order' },
    });
  }

  /**
   * Pedido nuevo publicado → admins (para vigilar desde el celu y reasignar
   * si hace falta). Topic admin.orders.new (push+inbox). El socket en vivo
   * ya lo cubre con el app abierta; esto cubre app cerrada.
   */
  async notifyAdminNewOrder(order: {
    id: string;
    pickupAddress: string;
    deliveryAddress: string;
    totalAmount: any;
    merchantName?: string | null;
    deliveryZone?: string | null;
  }) {
    const short = order.id.slice(0, 8).toUpperCase();
    return this.publishToTopic('admin.orders.new', {
      title: `🆕 Pedido nuevo #${short}`,
      body: `${this.newOrderRoute(order)} · ₡${Number(order.totalAmount || 0).toLocaleString('es-CR')}`,
      data: { orderId: order.id, type: 'new_order', url: '/admin/orders' },
    });
  }

  /**
   * Cada paso del pedido → admins. Copy propia (quién lo tomó, dónde va,
   * si se soltó) para decidir reasignación sin abrir el panel.
   */
  async notifyAdminOrderStatus(
    orderId: string,
    status: string,
    context: {
      shortId?: string;
      merchantName?: string;
      driverName?: string;
      pickupAddress?: string;
      deliveryAddress?: string;
      payout?: number;
      commission?: number;
    } = {},
  ) {
    const shortId = context.shortId ?? orderId.slice(0, 8).toUpperCase();
    const tag = `#${shortId}`;
    const merchant = context.merchantName || 'el comercio';
    const driver = context.driverName || 'El repartidor';
    const payout =
      context.payout != null && Number.isFinite(Number(context.payout))
        ? `₡${Number(context.payout).toLocaleString('es-CR')}`
        : null;
    const commission =
      context.commission != null && Number.isFinite(Number(context.commission))
        ? `₡${Number(context.commission).toLocaleString('es-CR')}`
        : null;

    const messages: Record<string, { title: string; body: string }> = {
      pending: {
        title: `🔄 Pedido ${tag} volvió a concurso`,
        body: `${merchant} → ${context.deliveryAddress || 'destino'}. Sin repartidor.`,
      },
      pending_acceptance: {
        title: `🛵 ${driver} debe aceptar ${tag}`,
        body: `${merchant} → ${context.deliveryAddress || 'destino'}. Si no acepta, vuelve a concurso.`,
      },
      assigned: {
        title: `🛵 ${driver} tomó ${tag}`,
        body: `${merchant} → ${context.deliveryAddress || 'destino'}${payout ? ` · Gana ${payout}` : ''}.`,
      },
      in_transit_to_pickup: {
        title: `🛵 ${driver} va a recoger ${tag}`,
        body: `${merchant} · ${context.pickupAddress || 'comercio'}.`,
      },
      picked_up: {
        title: `📦 ${tag} recogido`,
        body: `${driver} lo lleva a ${context.deliveryAddress || 'su destino'}.`,
      },
      in_transit_to_delivery: {
        title: `🛣️ ${tag} en camino`,
        body: `${driver} → ${context.deliveryAddress || 'destino'}.`,
      },
      delivered: {
        title: `🎉 ${tag} entregado`,
        body: `${driver}${commission ? ` · Kiwi ${commission}` : ''}.`,
      },
      cancelled: {
        title: `❌ ${tag} cancelado`,
        body: `${merchant} → ${context.deliveryAddress || 'destino'}.`,
      },
      no_driver: {
        title: `⚠️ ${tag} sin repartidor`,
        body: 'Nadie lo tomó. Reasignalo desde Pedidos.',
      },
      rejected: {
        title: `⚠️ ${driver} soltó ${tag}`,
        body: 'Necesita otro repartidor. Reasignalo desde Pedidos.',
      },
    };
    const message = messages[status] || {
      title: `Pedido ${tag}: ${status}`,
      body: `${merchant} → ${context.deliveryAddress || 'destino'}.`,
    };

    return this.publishToTopic('admin.orders.status', {
      ...message,
      data: { orderId, type: 'order_status', status, url: '/admin/orders' },
    });
  }

  /** Te asignaron un pedido: tenés N minutos para aceptar. */
  async notifyAssignmentOffered(orderId: string, driverUserId: string, minutes: number) {
    const order = await this.prisma.order
      ?.findUnique({ where: { id: orderId }, select: { isTest: true } })
      .catch(() => null);
    const title =
      (order as any)?.isTest === true
        ? '🧪 TEST · Tenés un pedido de prueba para aceptar'
        : '🛵 Tenés un pedido para aceptar';
    return this.sendToUser(driverUserId, {
      title,
      body: `Tenés ${minutes} min para aceptarlo antes de que vuelva a concurso. Pedido #${orderId.slice(0, 8)}`,
      data: { orderId, type: 'assignment_offered' },
    });
  }

  /** El driver inicial no aceptó: el pedido entró en concurso. */
  async notifyContestStarted(orderId: string, merchantUserId: string) {
    return this.sendToUser(merchantUserId, {
      title: '🔍 Buscando otro repartidor',
      body: `El repartidor seleccionado no aceptó tu pedido #${orderId.slice(0, 8)}. Ya está en concurso.`,
      data: { orderId, type: 'contest_started' },
    });
  }

  /** Nadie tomó el pedido en el concurso. */
  async notifyNoDriverAvailable(orderId: string, merchantUserId: string) {
    return this.sendToUser(merchantUserId, {
      title: '⚠️ Sin repartidores disponibles',
      body: 'No hay repartidores disponibles para aceptar este pedido en este momento.',
      data: { orderId, type: 'no_driver' },
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
    context: {
      shortId?: string;
      merchantName?: string;
      driverName?: string;
      pickupAddress?: string;
      deliveryAddress?: string;
      payout?: number;
      totalAmount?: number;
      customerName?: string;
    } = {},
  ) {
    const shortId = context.shortId ?? orderId.slice(0, 8).toUpperCase();
    const tag = `#${shortId}`;
    const merchant = context.merchantName || 'el comercio';
    const driver = context.driverName || 'El repartidor';
    const pickup = context.pickupAddress || '';
    const delivery = context.deliveryAddress || '';
    const route = pickup && delivery ? `${pickup} → ${delivery}` : pickup || delivery;
    const payout =
      context.payout != null && Number.isFinite(Number(context.payout))
        ? `₡${Number(context.payout).toLocaleString()}`
        : null;
    const customer = context.customerName ? ` · Cliente: ${context.customerName}` : '';

    // Cada estado tiene título y cuerpo propios con datos del pedido, para
    // que no lleguen 5 notificaciones idénticas en el ciclo.
    const merchantMessages: Record<string, { title: string; body: string }> = {
      assigned: {
        title: `🛵 ${driver} va por tu pedido`,
        body: route
          ? `Pedido ${tag} · ${route}. Te avisamos al recoger.`
          : `Pedido ${tag} asignado.`,
      },
      pending_acceptance: {
        title: `🛵 Pedido ${tag} esperando aceptación`,
        body: route
          ? `Pedido ${tag} · ${driver} tiene que aceptarlo. Te avisamos.`
          : `Pedido ${tag} pendiente de aceptación del repartidor.`,
      },
      no_driver: {
        title: `⚠️ Pedido ${tag} sin repartidores`,
        body: 'No hay repartidores disponibles para aceptar este pedido en este momento.',
      },
      in_transit_to_pickup: {
        title: `🛵 ${driver} va al comercio`,
        body:
          pickup || merchant
            ? `Pedido ${tag} · Va en camino a recoger en ${pickup || merchant}.`
            : `Pedido ${tag} · Va en camino a recoger.`,
      },
      picked_up: {
        title: `📦 Pedido ${tag} recogido`,
        body: delivery
          ? `${driver} lo recogió y va hacia ${delivery}.`
          : `${driver} recogió tu pedido.`,
      },
      in_transit_to_delivery: {
        title: `🛣️ Pedido ${tag} en camino`,
        body: delivery
          ? `${driver} lo lleva a ${delivery}${customer}.`
          : `${driver} va en camino a entregar.`,
      },
      delivered: {
        title: `🎉 Pedido ${tag} entregado`,
        body:
          delivery || driver
            ? `${driver} lo entregó en ${delivery || 'su destino'}.`
            : 'Tu pedido fue entregado exitosamente.',
      },
      cancelled: {
        title: `❌ Pedido ${tag} cancelado`,
        body: route ? `El pedido ${route} fue cancelado.` : 'El pedido fue cancelado.',
      },
    };

    const driverMessages: Record<string, { title: string; body: string }> = {
      assigned: {
        title: `🛵 Pedido ${tag} asignado`,
        body:
          route || payout
            ? `${merchant}: ${route}${payout ? ` · Ganás ${payout}` : ''}. Ve a recogerlo.`
            : 'Te asignaron un pedido. Ve a recogerlo.',
      },
      pending_acceptance: {
        title: `🛵 Pedido ${tag} pendiente de aceptación`,
        body:
          route || payout
            ? `${merchant}: ${route}${payout ? ` · Ganás ${payout}` : ''}. Aceptalo antes de que vuelva a concurso.`
            : 'Tenés un pedido pendiente de aceptación.',
      },
      no_driver: {
        title: `⚠️ Pedido ${tag} sin repartidores`,
        body: 'No hay repartidores disponibles para aceptar este pedido en este momento.',
      },
      in_transit_to_pickup: {
        title: `🛵 Vas a ${merchant} (${tag})`,
        body: pickup ? `Recogé en ${pickup}.` : 'Vas en camino a recoger el pedido.',
      },
      picked_up: {
        title: `📦 Recogiste ${tag}`,
        body: delivery
          ? `Llevalo a ${delivery}${customer}.`
          : 'Recogiste el pedido. Llévalo a su destino.',
      },
      in_transit_to_delivery: {
        title: `🛣️ Entregando ${tag}`,
        body: delivery ? `Destino: ${delivery}${customer}.` : 'Vas en camino a entregar el pedido.',
      },
      delivered: {
        title: `🎉 Entregaste ${tag}`,
        body: payout ? `Ganaste ${payout} · ${merchant}.` : 'Entregaste el pedido exitosamente.',
      },
      cancelled: {
        title: `❌ Pedido ${tag} cancelado`,
        body: route ? `El pedido ${route} fue cancelado.` : 'El pedido fue cancelado.',
      },
    };

    const messages = perspective === 'driver' ? driverMessages : merchantMessages;
    const message = messages[status] || {
      title: 'Actualización',
      body: `Pedido ${tag}: ${status}`,
    };

    // Prueba: el título avisa desde el primer push (el flujo se simula,
    // no paga ganancia real). Se lee acá y no en cada llamador: ningún
    // flujo futuro se olvida el prefijo.
    const order = await this.prisma.order
      ?.findUnique({ where: { id: orderId }, select: { isTest: true } })
      .catch(() => null);
    const title = (order as any)?.isTest === true ? `🧪 TEST · ${message.title}` : message.title;

    return this.sendToUser(userId, {
      ...message,
      title,
      // Driver: suenan el entrante (asignado directo) y el delivered con
      // ganancia; el resto queda en la campanita. Merchant y entrantes
      // por concurso/topic no cambian.
      push: perspective === 'driver' ? status === 'delivered' || status === 'assigned' : true,
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

    // Poda: cada reinstall/reactivación (Safari vs PWA instalada, SW con
    // scope viejo vs nuevo) genera un token NUEVO y el viejo sigue válido →
    // el mismo celu recibe el mismo push N veces. Se conserva solo el más
    // reciente por usuario+plataforma: un repartidor opera con 1 celu activo.
    // Corre en cada apertura de app (el front re-registra al montar), así que
    // los duplicados existentes mueren solos sin que el usuario toque nada.
    try {
      await this.prisma.deviceToken.deleteMany({
        where: { userId, platform, token: { not: token } },
      });
    } catch {
      // best-effort: nunca bloquea el registro
    }

    // Plataforma primaria: la última app que registró gana. Los push 1:1
    // van solo a sus tokens y no duplican en el mismo celu con PWA +
    // nativa instaladas (mismo nombre, doble banner).
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { primaryPushPlatform: platform },
      });
    } catch {
      // best-effort: sin primaria se avisa a todas como antes
    }

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
   * Diagnóstico: registros push de MI usuario (token enmascarado).
   * Permite ver desde la app cuántas instalaciones vivas hay — si hay 2+,
   * cada push real llega N veces al mismo celu.
   */
  async listMyTokens(userId: string) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      select: { platform: true, lastUsedAt: true, createdAt: true, token: true },
    });
    return tokens.map((t) => ({
      short: `…${t.token.slice(-8)}`,
      platform: t.platform,
      lastUsedAt: t.lastUsedAt,
      createdAt: t.createdAt,
    }));
  }

  /**
   * Limpieza manual: conserva el registro más reciente por plataforma y
   * borra el resto. Es lo mismo que hace el registro automático, pero a
   * demanda (botón "Limpiar duplicados").
   */
  async pruneMyTokens(userId: string) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      select: { token: true, platform: true },
    });
    const seen = new Set<string>();
    const stale: string[] = [];
    for (const t of tokens) {
      if (seen.has(t.platform)) stale.push(t.token);
      else seen.add(t.platform);
    }
    if (stale.length > 0) {
      await this.prisma.deviceToken.deleteMany({ where: { token: { in: stale } } });
      this.logger.log(`Manual prune: removed ${stale.length} tokens for user ${userId}`);
    }
    return { removed: stale.length, remaining: tokens.length - stale.length };
  }

  /**
   * Salud del pipeline push (admin, agregado sin PII): dice DÓNDE se corta
   * la cadena cuando "no llegan notificaciones" — FCM sin configurar, sin
   * tokens, prefs apagadas, nadie en línea o sin pedidos. Ventana: 24 h.
   */
  async pushHealth() {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const tokensTotal = await this.prisma.deviceToken.count();
    const byPlatform: Array<{ platform: string; _count: number }> =
      (await (this.prisma.deviceToken as any).groupBy?.({
        by: ['platform'],
        _count: true,
      })) ?? [];
    const tokensActive = await this.prisma.deviceToken.count({
      where: { lastUsedAt: { gte: since } },
    });
    const driversAvailable: Array<{ userId: string }> = await this.prisma.driverProfile.findMany({
      where: { status: 'available' },
      select: { userId: true },
      take: 2000,
    });
    const availableUserIds = driversAvailable.map((d) => d.userId);
    const availableWithTokens =
      availableUserIds.length === 0
        ? 0
        : await this.prisma.deviceToken.count({
            where: { userId: { in: availableUserIds } },
          });
    const prefsEnabled = await this.prisma.topicPreference.count({
      where: { topic: 'driver.orders.new', enabled: true },
    });
    const ordersTotal = await this.prisma.order.count({ where: { createdAt: { gte: since } } });
    const ordersTest = await this.prisma.order.count({
      where: { createdAt: { gte: since }, isTest: true },
    });
    const inboxByType: Array<{ type: string; _count: { type: number } }> =
      (await (this.prisma.notification as any).groupBy?.({
        by: ['type'],
        where: { createdAt: { gte: since }, type: { startsWith: 'push:' } },
        _count: { type: true },
      })) ?? [];
    return {
      fcmConfigured: this.fcmAdmin != null,
      windowHours: 24,
      tokens: {
        total: tokensTotal,
        byPlatform: Object.fromEntries(byPlatform.map((r) => [r.platform, r._count])),
        active24h: tokensActive,
      },
      drivers: {
        availableNow: driversAvailable.length,
        availableWithTokens,
      },
      prefsDriverOrdersNew: prefsEnabled,
      orders24h: { total: ordersTotal, test: ordersTest, real: ordersTotal - ordersTest },
      inboxPushes24h: Object.fromEntries(inboxByType.map((r) => [r.type, r._count?.type ?? 0])),
    };
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
    sent: number;
    results: Array<{ token: string; ok: boolean; error?: string }>;
  }> {
    const results: Array<{ token: string; ok: boolean; error?: string }> = [];
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      select: { token: true, platform: true, lastUsedAt: true },
    });

    if (!this.fcmAdmin) {
      return { fcmConfigured: false, tokens: tokens.length, sent: 0, results };
    }

    // Solo al token más reciente: el botón Probar está EN este celu y el
    // usuario espera 1 banner acá, no 1 por cada instalación vieja que
    // siga registrada (Safari + PWA instalada = 2 tokens válidos en el
    // mismo iPhone). Los pushes reales sí van a todos los tokens.
    const latest = tokens.slice(0, 1);
    const expired: string[] = [];
    // Data-only + conteo de envíos en la respuesta: el diagnóstico muestra
    // "1 envío" y si igual llegan 2, el duplicado es 100% del celu.
    const testPayload = {
      title: '🥝 Prueba de alertas',
      body: 'Si lees esto, las alertas funcionan en este dispositivo.',
      data: { type: 'test', testId: `${Date.now()}` },
    };
    let sent = 0;
    for (const { token, platform } of latest) {
      const short = `…${token.slice(-8)} (${platform})`;
      try {
        await this.fcmAdmin.send({ token, data: this.toDataPayload(testPayload) });
        sent++;
        results.push({ token: short, ok: true });
      } catch (error: any) {
        const code = error?.errorInfo?.code ?? error?.code ?? String(error);
        results.push({ token: short, ok: false, error: code });
        if (
          code.includes('unregistered') ||
          code.includes('invalid-registration-token') ||
          code.includes('registration-token-not-registered')
        ) {
          expired.push(token);
        }
      }
    }
    if (expired.length > 0) {
      await this.prisma.deviceToken.deleteMany({ where: { token: { in: expired } } });
      this.logger.log(`Removed ${expired.length} expired device tokens (test push)`);
    }
    return { fcmConfigured: true, tokens: tokens.length, sent, results };
  }
}
