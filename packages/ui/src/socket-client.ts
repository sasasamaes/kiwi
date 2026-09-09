/**
 * 🥝 Kiwi Socket.io Client
 *
 * Real-time communication client for all frontend apps
 */

import { io, Socket } from 'socket.io-client';

function resolveSocketUrl(): string {
  const base =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_API_URL as string | undefined)
      : undefined;
  if (base) return base.replace(/\/api\/?$/, '');
  return 'http://localhost:4000';
}

const SOCKET_URL = resolveSocketUrl();

interface SocketEvents {
  // Connection events
  connected: (data: { userId: string; role: string; message: string }) => void;
  disconnect: (reason: string) => void;

  // Order events
  'order:new': (data: any) => void;
  'order:accepted': (data: any) => void;
  'order:statusChanged': (data: any) => void;

  // Driver events
  'driver:location': (data: any) => void;
  'driver:statusChanged': (data: any) => void;

  // Notification events
  notification: (data: any) => void;
}

class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private currentToken: string | null = null;

  connect(token: string): Socket {
    // Re-auth when user/token changes instead of reusing a stale socket
    if (this.socket?.connected) {
      if (this.currentToken === token) return this.socket;
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentToken = token;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupEventListeners();
    // Re-attach local listeners registered before connect()
    for (const [event, callbacks] of this.listeners) {
      for (const cb of callbacks) {
        this.socket.on(event, cb as any);
      }
    }
    return this.socket;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🟢 Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.emit('socket:connected', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
      this.emit('socket:disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit('socket:maxRetriesReached', {});
      }
    });

    // Order events
    this.socket.on('order:new', (data) => {
      console.log('📦 New order:', data);
      this.emit('order:new', data);
    });

    this.socket.on('order:accepted', (data) => {
      console.log('✅ Order accepted:', data);
      this.emit('order:accepted', data);
    });

    this.socket.on('order:statusChanged', (data) => {
      console.log('🔄 Order status changed:', data);
      this.emit('order:statusChanged', data);
    });

    // Driver events
    this.socket.on('driver:location', (data) => {
      this.emit('driver:location', data);
    });

    this.socket.on('driver:statusChanged', (data) => {
      console.log('🛵 Driver status changed:', data);
      this.emit('driver:statusChanged', data);
    });

    // Connection events
    this.socket.on('connected', (data) => {
      console.log('🟢 Connected to Kiwi:', data);
      this.emit('socket:ready', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // ============================================
  // 📤 EMIT METHODS
  // ============================================

  // Order methods
  createOrder(orderData: any) {
    this.socket?.emit('order:create', orderData);
  }

  acceptOrder(orderId: string, driverId: string) {
    this.socket?.emit('order:accept', { orderId, driverId });
  }

  updateOrderStatus(orderId: string, status: string) {
    this.socket?.emit('order:statusUpdate', { orderId, status });
  }

  // Driver methods
  updateDriverLocation(lat: number, lng: number, orderId?: string) {
    this.socket?.emit('driver:locationUpdate', { lat, lng, orderId });
  }

  updateDriverStatus(status: 'available' | 'offline' | 'busy') {
    this.socket?.emit('driver:statusChange', { status });
  }

  // Notification methods
  subscribeToTopics(topics: string[]) {
    this.socket?.emit('notification:subscribe', { topics });
  }

  // ============================================
  // 📥 LISTEN METHODS
  // ============================================

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    // Also listen on socket
    this.socket?.on(event, callback as any);

    return () => this.off(event, callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
    this.socket?.off(event, callback as any);
  }

  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in socket listener for ${event}:`, error);
      }
    });
  }

  // ============================================
  // 🔧 UTILITY METHODS
  // ============================================

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Export singleton instance
export const socketClient = new SocketClient();

// Export for React hook
export function useSocket() {
  return socketClient;
}
