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
      process.env.CLIENT_URL,
      process.env.WEB_URL,
      process.env.DRIVER_URL,
    ].filter(Boolean),
    credentials: true,
  },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, { socketId: string; role: string; userId: string }>();

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

    // Broadcast new order to available drivers
    this.server.to('role:driver').emit('order:new', {
      orderId: data.orderId,
      pickupAddress: data.pickupAddress,
      deliveryAddress: data.deliveryAddress,
      totalAmount: data.totalAmount,
      distanceKm: data.distanceKm,
    });

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

    // Notify merchant that order was accepted
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { merchant: true },
    });

    if (order?.merchant?.userId) {
      this.server.to(`user:${order.merchant.userId}`).emit('order:accepted', {
        orderId: data.orderId,
        driverId: data.driverId,
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

    // If tracking an order, notify the merchant
    if (data.orderId) {
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

    // Join specified topics
    data.topics.forEach((topic) => {
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
