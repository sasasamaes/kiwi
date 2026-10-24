// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
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
  'order:taken': (data: any) => void;
  'order:assigned': (data: any) => void;
  'order:confirmed': (data: any) => void;

  // Driver events
  'driver:location': (data: any) => void;
  'driver:statusChanged': (data: any) => void;

  // Notification events
  notification: (data: any) => void;
}

class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private currentToken: string | null = null;
  // Outage-aware logging: one line when a connection outage starts and one
  // when it recovers, instead of a console.error per retry attempt.
  private inOutage = false;

  connect(token: string): Socket {
    // Re-auth when the user/token changes. If the token is the same, REUSE the
    // socket even while it's disconnected — socket.io keeps retrying with
    // backoff on its own, so re-creating it on every page mount (the old
    // behavior) stacked parallel retry loops while the API was down.
    if (this.socket && this.currentToken === token) return this.socket;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentToken = token;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      // Retry forever with exponential backoff + jitter: a dead API must not
      // spin the radio or flood the console, but the app must recover on its
      // own the moment the API is back (drivers work with flaky networks).
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000, // 1s, 2s, 4s, 8s, ...
      reconnectionDelayMax: 30000, // capped at 30s
      randomizationFactor: 0.5, // ±50% jitter so fleets don't sync their retries
      timeout: 10000,
    });

    this.setupEventListeners();
    return this.socket;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🟢 Socket connected:', this.socket?.id);
      if (this.inOutage) {
        console.log('🟢 Socket recovered — back online');
        this.inOutage = false;
      }
      this.emit('socket:connected', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
      this.emit('socket:disconnected', { reason });
    });

    // One line per outage, not one per attempt: the transport-level error
    // repeats every retry and previously spammed the console on dead APIs.
    this.socket.on('connect_error', () => {
      if (!this.inOutage) {
        this.inOutage = true;
        console.warn('🟡 Socket offline — retrying automatically (1s→30s exponential backoff)…');
      }
    });

    // Un solo despacho por evento: onAny alimenta el registro local. Si
    // además registramos callbacks directos con socket.on(), cada evento
    // llega dos veces (sonidos, refetches y mensajes duplicados).
    this.socket.onAny((event, data) => {
      this.emit(event, data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentToken = null;
      this.inOutage = false;
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

  // Chat: order-scoped message with server ack (10s timeout)
  sendChat(orderId: string, text: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Sin conexión en tiempo real'));
        return;
      }
      const timer = setTimeout(() => reject(new Error('El mensaje tardó demasiado')), 10000);
      this.socket.emit('chat:send', { orderId, text }, (ack: any) => {
        clearTimeout(timer);
        if (ack?.error) reject(new Error(ack.error));
        else resolve(ack?.message ?? ack);
      });
    });
  }

  // ============================================
  // 📥 LISTEN METHODS
  // ============================================

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    return () => this.off(event, callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
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
