import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    // Must mirror the HTTP CORS allowlist in main.ts or prod handshakes fail.
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://kiwi-merchant.vercel.app',
      'https://kiwi-client-tau.vercel.app',
      'https://kiwi-driver.vercel.app',
      'https://kiwicr.express',
      'https://www.kiwicr.express',
      'https://negocios.kiwicr.express',
      'https://repartidores.kiwicr.express',
      'https://api.kiwicr.express',
      process.env.CLIENT_URL,
      process.env.WEB_URL,
      process.env.DRIVER_URL,
    ].filter(Boolean),
    credentials: true,
  },
  namespace: '/',
  // Default is 1MB per message — far beyond any real payload this gateway
  // carries (location pings, status strings, chat text ≤1000 chars). Capping
  // at 8KB makes oversized-payload abuse (memory growth, log flooding) fail
  // at the transport layer before any handler runs.
  maxHttpBufferSize: 8 * 1024,
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, { socketId: string; role: string; userId: string }>();

  /** Throttle de persistencia de ubicación por userId (ms). */
  private lastLocationPersist = new Map<string, number>();

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token as string);
      const userId = payload.sub;
      const role = payload.role;

      // Store connection
      this.connectedUsers.set(client.id, { socketId: client.id, role, userId });

      // Join user-specific room
      client.join(`user:${userId}`);

      // Join role-specific room
      client.join(`role:${role}`);

      console.log(`Client connected: ${client.id} (User: ${userId}, Role: ${role})`);

      // Send welcome message
      client.emit('connected', { userId, role, message: 'Connected to Kiwi' });
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userData = this.connectedUsers.get(client.id);
    if (userData) {
      console.log(`Client disconnected: ${client.id} (User: ${userData.userId})`);
      this.connectedUsers.delete(client.id);
    }
  }

  // ============================================
  // 📦 ORDER EVENTS
  // ============================================

  @SubscribeMessage('order:create')
  async handleOrderCreate(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData || userData.role !== 'merchant') {
      return { error: 'Unauthorized' };
    }

    // Solo campos primitivos acotados: el broadcast llega a TODOS los
    // repartidores conectados, así que nada escrito por el cliente puede
    // viajar sin límite de tamaño/tipo.
    const orderId =
      typeof data?.orderId === 'string' && data.orderId.length <= 64 ? data.orderId : null;
    const pickupAddress =
      typeof data?.pickupAddress === 'string' ? data.pickupAddress.slice(0, 300) : '';
    const deliveryAddress =
      typeof data?.deliveryAddress === 'string' ? data.deliveryAddress.slice(0, 300) : '';
    const totalAmount =
      typeof data?.totalAmount === 'number' && Number.isFinite(data.totalAmount)
        ? data.totalAmount
        : null;
    const distanceKm =
      typeof data?.distanceKm === 'number' && Number.isFinite(data.distanceKm)
        ? data.distanceKm
        : null;

    if (!orderId || totalAmount == null) {
      return { error: 'orderId y totalAmount son requeridos' };
    }

    // Re-emitir con la forma canónica de order:new (id + payout reales desde
    // la DB, no los del cliente). El service ya emite al crear: esto cubre
    // reintentos sin duplicar datos distintos.
    const stored = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (stored && (stored as any).status === 'pending' && !(stored as any).driverId) {
      this.server.to('role:driver').emit('order:new', {
        id: stored.id,
        orderId: stored.id,
        pickupAddress: (stored as any).pickupAddress,
        deliveryAddress: (stored as any).deliveryAddress,
        totalAmount: Number((stored as any).totalAmount),
        driverPayout:
          (stored as any).driverPayout != null ? Number((stored as any).driverPayout) : null,
        distanceKm: Number((stored as any).distanceKm),
        createdAt: (stored as any).createdAt,
      });
    } else if (!stored) {
      // La orden aún no existe (carrera REST/socket): re-emitir parcial pero
      // con `id` para que Aceptar apunte a la URL correcta al reintentar.
      this.server.to('role:driver').emit('order:new', {
        id: orderId,
        orderId,
        pickupAddress,
        deliveryAddress,
        totalAmount,
        driverPayout: null,
        distanceKm,
      });
    }

    return { success: true };
  }

  @SubscribeMessage('order:accept')
  async handleOrderAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; driverId: string },
  ) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData || userData.role !== 'driver') {
      return { error: 'Unauthorized' };
    }
    if (typeof data?.orderId !== 'string' || data.orderId.length > 64) {
      return { error: 'orderId inválido' };
    }

    // Notify merchant that order was accepted
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { merchant: true },
    });

    // Anti-fantasma: solo avisar si el pedido está realmente asignado al
    // driver que emite. Sin esto, cualquier driver podía mostrar "aceptado"
    // en el comercio sin haber tomado el pedido por REST.
    const emitterProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: userData.userId },
    });
    if (!order || (order as any).driverId == null) {
      return { error: 'El pedido aún no fue aceptado' };
    }
    if (!emitterProfile || (order as any).driverId !== (emitterProfile as any).id) {
      return { error: 'No sos el repartidor asignado' };
    }

    if (order?.merchant?.userId) {
      // driverId SIEMPRE es el del token — el body nunca decide quién "aceptó".
      this.server.to(`user:${order.merchant.userId}`).emit('order:accepted', {
        orderId: data.orderId,
        driverId: userData.userId,
        message: 'Tu pedido fue aceptado por un repartidor',
      });
    }

    return { success: true };
  }

  @SubscribeMessage('order:statusUpdate')
  async handleOrderStatusUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; status: string },
  ) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData) {
      return { error: 'Unauthorized' };
    }
    if (typeof data?.orderId !== 'string' || data.orderId.length > 64) {
      return { error: 'orderId inválido' };
    }

    // Solo estados del flujo real: evita inyectar strings arbitrarios en las
    // notificaciones de ambos participantes.
    const VALID_STATUSES = new Set([
      'assigned',
      'in_transit_to_pickup',
      'picked_up',
      'in_transit_to_delivery',
      'delivered',
      'cancelled',
    ]);
    if (typeof data?.status !== 'string' || !VALID_STATUSES.has(data.status)) {
      return { error: 'status inválido' };
    }

    // Get order details with owner ids (merchantId/driverId are profile ids, not user ids)
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { merchant: true, driver: true },
    });

    if (!order) {
      return { error: 'Order not found' };
    }

    const merchantUserId = order.merchant?.userId;
    const driverUserId = order.driver?.userId;
    const requester = userData.userId;
    if (requester !== merchantUserId && requester !== driverUserId) {
      return { error: 'Unauthorized' };
    }

    // Notify both merchant and driver
    const statusLabels: Record<string, string> = {
      assigned: 'Tu pedido fue asignado',
      in_transit_to_pickup: 'El repartidor va en camino a recoger',
      picked_up: 'El repartidor recogió tu pedido',
      in_transit_to_delivery: 'Tu pedido va en camino',
      delivered: 'Tu pedido fue entregado',
      cancelled: 'El pedido fue cancelado',
    };

    // Notify merchant
    if (merchantUserId) {
      this.server.to(`user:${merchantUserId}`).emit('order:statusChanged', {
        orderId: data.orderId,
        status: data.status,
        message: statusLabels[data.status] || 'Estado actualizado',
      });
    }

    // Notify driver if assigned
    if (driverUserId) {
      this.server.to(`user:${driverUserId}`).emit('order:statusChanged', {
        orderId: data.orderId,
        status: data.status,
        message: statusLabels[data.status] || 'Estado actualizado',
      });
    }

    return { success: true };
  }

  // ============================================
  // 🛵 DRIVER EVENTS
  // ============================================

  @SubscribeMessage('driver:locationUpdate')
  async handleDriverLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lat: number; lng: number; orderId?: string },
  ) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData || userData.role !== 'driver') {
      return { error: 'Unauthorized' };
    }

    // Coordenadas acotadas: garbage aquí viaja directo al mapa de tracking.
    const lat = typeof data?.lat === 'number' && Number.isFinite(data.lat) ? data.lat : null;
    const lng = typeof data?.lng === 'number' && Number.isFinite(data.lng) ? data.lng : null;
    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { error: 'lat/lng inválidos' };
    }

    // Persistencia de última conocida (throttle 15s por driver): alimenta el
    // targeting por proximidad de alertas. Los pings con orden activa pasan
    // sin throttle (el mapa del comercio es la lectura crítica).
    const now = Date.now();
    const lastPing = this.lastLocationPersist.get(userData.userId) ?? 0;
    if (!data.orderId && now - lastPing > 15_000) {
      this.lastLocationPersist.set(userData.userId, now);
      this.prisma.driverProfile
        .update({
          where: { userId: userData.userId },
          data: { lastLat: lat, lastLng: lng, lastSeenAt: new Date() },
        })
        .catch(() => undefined); // fire-and-forget: un fallo no tumba el ping
    }

    // If tracking an order, notify the merchant
    if (typeof data.orderId === 'string' && data.orderId.length > 0 && data.orderId.length <= 64) {
      const order = await this.prisma.order.findUnique({
        where: { id: data.orderId },
        include: { merchant: true },
      });

      if (order?.merchant?.userId) {
        this.server.to(`user:${order.merchant.userId}`).emit('driver:location', {
          orderId: data.orderId,
          driverId: userData.userId,
          lat: data.lat,
          lng: data.lng,
        });
      }
    }

    return { success: true };
  }

  @SubscribeMessage('driver:statusChange')
  async handleDriverStatusChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: 'available' | 'offline' | 'busy' },
  ) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData || userData.role !== 'driver') {
      return { error: 'Unauthorized' };
    }
    // Estado acotado al enum real de DriverProfile.
    if (data?.status !== 'available' && data?.status !== 'busy' && data?.status !== 'offline') {
      return { error: 'status inválido' };
    }

    // Update driver status in database
    await this.prisma.driverProfile.update({
      where: { userId: userData.userId },
      data: { status: data.status },
    });

    // Broadcast to merchants
    this.server.to('role:merchant').emit('driver:statusChanged', {
      driverId: userData.userId,
      status: data.status,
    });

    return { success: true };
  }

  // ============================================
  // 📢 NOTIFICATION EVENTS
  // ============================================

  @SubscribeMessage('notification:subscribe')
  async handleNotificationSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { topics: string[] },
  ) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData) {
      return { error: 'Unauthorized' };
    }

    // Allowlist estricta de temas reales del sistema: sin esto cualquier
    // usuario puede suscribirse a "topic:admin" y recibir lo que se publique
    // ahí. Si un solo tema pedido no existe, se rechaza completo — una lista
    // mixta ("admin" + real) es probing, no una suscripción legítima.
    const ALLOWED_TOPICS = new Set(['orders_zone', 'promotions', 'system']);
    const topics: string[] = Array.isArray(data?.topics) ? data.topics : [];
    const allValid =
      topics.length > 0 &&
      topics.length <= 10 &&
      topics.every((t) => typeof t === 'string' && ALLOWED_TOPICS.has(t));
    if (!allValid) {
      return { error: 'topics inválidos' };
    }

    // Join specified topics
    topics.forEach((topic) => {
      client.join(`topic:${topic}`);
    });

    return { success: true };
  }

  // ============================================
  // 💬 ORDER CHAT (merchant ↔ assigned driver)
  // ============================================

  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; text: string },
  ) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData) {
      return { error: 'Unauthorized' };
    }

    const text = String(data?.text ?? '')
      .trim()
      .slice(0, 1000);
    if (!data?.orderId || !text) {
      return { error: 'orderId y text son requeridos' };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { merchant: true, driver: true },
    });
    if (!order) {
      return { error: 'Order not found' };
    }

    const merchantUserId = order.merchant?.userId;
    const driverUserId = order.driver?.userId;
    const senderId = userData.userId;
    // Solo los participantes de la orden pueden chatear en ella.
    if (senderId !== merchantUserId && senderId !== driverUserId) {
      return { error: 'Unauthorized' };
    }
    if (!merchantUserId || !driverUserId) {
      return { error: 'El pedido aún no tiene repartidor asignado' };
    }
    const recipientId = senderId === merchantUserId ? driverUserId : merchantUserId;

    const message = await this.prisma.notification.create({
      data: {
        userId: recipientId,
        title: 'Nuevo mensaje',
        body: text,
        type: 'chat',
        data: { orderId: order.id, senderId, senderRole: userData.role },
      },
    });

    const payload = {
      id: message.id,
      orderId: order.id,
      senderId,
      senderRole: userData.role,
      text,
      createdAt: message.createdAt,
    };
    this.server.to(`user:${recipientId}`).emit('chat:message', payload);

    return { success: true, message: payload };
  }

  // ============================================
  // 🔧 HELPER METHODS
  // ============================================

  // Send notification to specific user.
  // The socket server is null until the first client connects (Nest lifecycle),
  // so every helper must be null-safe — a broadcast to zero connected sockets
  // is a no-op, not a crash.
  sendToUser(userId: string, event: string, data: any) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  // Send notification to all users with specific role
  sendToRole(role: string, event: string, data: any) {
    this.server?.to(`role:${role}`).emit(event, data);
  }

  // Send notification to topic subscribers
  sendToTopic(topic: string, event: string, data: any) {
    this.server?.to(`topic:${topic}`).emit(event, data);
  }

  // Broadcast to all connected clients
  broadcast(event: string, data: any) {
    this.server?.emit(event, data);
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    for (const [, userData] of this.connectedUsers) {
      if (userData.userId === userId) {
        return true;
      }
    }
    return false;
  }
}
