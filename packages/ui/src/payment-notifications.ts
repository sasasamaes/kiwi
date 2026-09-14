'use client';

/**
 * 🥝 KIWI - Payment Notifications Service
 *
 * Handles push notifications for payment status updates.
 * Supports local notifications when offline.
 */

import { offlineCache } from './offline-cache';
import { backgroundSync } from './background-sync';
import { playNotificationSound } from './notification-sound';

const DB_NAME = 'kiwi-payment-notifications';
const DB_VERSION = 1;
const STORE_NAME = 'notifications';

export type NotificationType =
  | 'payment:created'
  | 'payment:processing'
  | 'payment:completed'
  | 'payment:failed'
  | 'payment:refunded'
  | 'payment:received'
  | 'payment:pending'
  | 'payment:expired';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface PaymentNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;

  /** Payment data */
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  method: string;

  /** Recipient info */
  recipientId: string;
  recipientType: 'customer' | 'merchant' | 'driver';

  /** Notification content */
  title: string;
  body: string;
  data?: Record<string, any>;

  /** Status */
  read: boolean;
  dismissed: boolean;

  /** Timestamps */
  createdAt: number;
  readAt?: number;
  dismissedAt?: number;
  expiresAt?: number;

  /** Actions */
  actions?: Array<{
    id: string;
    label: string;
    action: string;
  }>;

  /** Local or push */
  deliveryMethod: 'local' | 'push';
  syncStatus: 'pending' | 'sent' | 'failed';
}

interface PaymentNotificationOptions {
  /** Enable local notifications */
  enableLocal?: boolean;

  /** Enable push notifications */
  enablePush?: boolean;

  /** Auto-dismiss after (ms) */
  autoDismiss?: number;

  /** Max notifications to keep */
  maxNotifications?: number;

  /** Callback when notification is received */
  onNotification?: (notification: PaymentNotification) => void;

  /** Callback when notification is clicked */
  onNotificationClick?: (notification: PaymentNotification) => void;
}

class PaymentNotificationService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private options: PaymentNotificationOptions;
  private listeners: Map<string, Set<Function>> = new Map();
  private permission: NotificationPermission = 'default';

  constructor(options: PaymentNotificationOptions = {}) {
    this.options = {
      enableLocal: true,
      enablePush: true,
      autoDismiss: 5000,
      maxNotifications: 50,
      ...options,
    };
  }

  /**
   * Initialize IndexedDB
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open notifications DB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('Kiwi: Payment notifications initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('recipientId', 'recipientId', { unique: false });
          store.createIndex('read', 'read', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('Kiwi: Created notifications store');
        }
      };
    });
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      this.permission = 'denied';
      return 'denied';
    }

    const result = await Notification.requestPermission();
    this.permission = result;
    return result;
  }

  /**
   * Generate notification ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create notification content based on type
   */
  private createContent(
    type: NotificationType,
    paymentData: {
      paymentId: string;
      orderId: string;
      amount: number;
      currency: string;
      method: string;
      recipientType: 'customer' | 'merchant' | 'driver';
    },
  ): { title: string; body: string; priority: NotificationPriority } {
    const formatAmount = (amount: number) => `₡${amount.toLocaleString()}`;

    const templates: Record<
      NotificationType,
      {
        title: string;
        body: string;
        priority: NotificationPriority;
      }
    > = {
      'payment:created': {
        title: '💳 Pago registrado',
        body: `Pago de ${formatAmount(paymentData.amount)} registrado para el pedido #${paymentData.orderId.slice(-6)}`,
        priority: 'normal',
      },
      'payment:processing': {
        title: '⏳ Procesando pago',
        body: `Tu pago de ${formatAmount(paymentData.amount)} está siendo procesado`,
        priority: 'normal',
      },
      'payment:completed': {
        title: '✅ Pago completado',
        body: `Pago de ${formatAmount(paymentData.amount)} completado exitosamente`,
        priority: 'high',
      },
      'payment:failed': {
        title: '❌ Pago fallido',
        body: `El pago de ${formatAmount(paymentData.amount)} no pudo procesarse`,
        priority: 'urgent',
      },
      'payment:refunded': {
        title: '💰 Reembolso procesado',
        body: `Se reembolsó ${formatAmount(paymentData.amount)} a tu cuenta`,
        priority: 'high',
      },
      'payment:received': {
        title: '💰 Pago recibido',
        body: `Has recibido un pago de ${formatAmount(paymentData.amount)} por el pedido #${paymentData.orderId.slice(-6)}`,
        priority: 'high',
      },
      'payment:pending': {
        title: '⏳ Pago pendiente',
        body: `El pago de ${formatAmount(paymentData.amount)} está pendiente de confirmación`,
        priority: 'normal',
      },
      'payment:expired': {
        title: '⏰ Pago expirado',
        body: `El pago de ${formatAmount(paymentData.amount)} ha expirado`,
        priority: 'urgent',
      },
    };

    return templates[type];
  }

  /**
   * Create and store notification
   */
  async createNotification(
    type: NotificationType,
    paymentData: {
      paymentId: string;
      orderId: string;
      amount: number;
      currency: string;
      method: string;
      recipientId: string;
      recipientType: 'customer' | 'merchant' | 'driver';
    },
    additionalData?: Record<string, any>,
  ): Promise<PaymentNotification> {
    await this.initialize();

    const { title, body, priority } = this.createContent(type, paymentData);

    const notification: PaymentNotification = {
      id: this.generateId(),
      type,
      priority,
      paymentId: paymentData.paymentId,
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      method: paymentData.method,
      recipientId: paymentData.recipientId,
      recipientType: paymentData.recipientType,
      title,
      body,
      data: additionalData,
      read: false,
      dismissed: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      actions: this.getActionsForType(type),
      deliveryMethod: this.options.enablePush ? 'push' : 'local',
      syncStatus: 'pending',
    };

    // Store notification
    await this.storeNotification(notification);

    // Show notification
    if (this.options.enableLocal) {
      this.showLocalNotification(notification);
    }

    // Emit event
    this.emit('notification', notification);
    this.options.onNotification?.(notification);

    return notification;
  }

  /**
   * Get actions for notification type
   */
  private getActionsForType(
    type: NotificationType,
  ): Array<{ id: string; label: string; action: string }> {
    const actions: Record<
      NotificationType,
      Array<{ id: string; label: string; action: string }>
    > = {
      'payment:created': [
        { id: 'view', label: 'Ver pedido', action: 'view_order' },
        { id: 'cancel', label: 'Cancelar', action: 'cancel_payment' },
      ],
      'payment:processing': [{ id: 'view', label: 'Ver estado', action: 'view_status' }],
      'payment:completed': [
        { id: 'view', label: 'Ver recibo', action: 'view_receipt' },
        { id: 'share', label: 'Compartir', action: 'share_receipt' },
      ],
      'payment:failed': [
        { id: 'retry', label: 'Reintentar', action: 'retry_payment' },
        { id: 'support', label: 'Ayuda', action: 'contact_support' },
      ],
      'payment:refunded': [{ id: 'view', label: 'Ver detalles', action: 'view_refund' }],
      'payment:received': [
        { id: 'view', label: 'Ver pago', action: 'view_payment' },
        { id: 'withdraw', label: 'Retirar', action: 'withdraw_funds' },
      ],
      'payment:pending': [{ id: 'view', label: 'Verificar', action: 'verify_payment' }],
      'payment:expired': [
        { id: 'retry', label: 'Pagar ahora', action: 'retry_payment' },
        { id: 'cancel', label: 'Cancelar pedido', action: 'cancel_order' },
      ],
    };

    return actions[type] || [];
  }

  /**
   * Store notification in IndexedDB
   */
  private async storeNotification(notification: PaymentNotification): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(notification);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Show local browser notification
   */
  private showLocalNotification(notification: PaymentNotification): void {
    // El banner del sistema no garantiza sonido: sonar aquí también
    playNotificationSound(
      notification.priority === 'urgent'
        ? 'new_order'
        : notification.priority === 'high'
          ? 'payment'
          : 'default',
    );

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    const notif = new Notification(notification.title, {
      body: notification.body,
      icon: '/kiwi-icon.png',
      badge: '/kiwi-badge.png',
      tag: notification.id,
      data: notification,
    });

    notif.onclick = () => {
      window.focus();
      this.markAsRead(notification.id);
      this.options.onNotificationClick?.(notification);
      notif.close();
    };

    // Auto-dismiss
    if (this.options.autoDismiss) {
      setTimeout(() => notif.close(), this.options.autoDismiss);
    }
  }

  /**
   * Get notifications
   */
  async getNotifications(filters?: {
    recipientId?: string;
    type?: NotificationType;
    read?: boolean;
  }): Promise<PaymentNotification[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let notifications = request.result as PaymentNotification[];

        // Filter expired
        notifications = notifications.filter((n) => !n.expiresAt || n.expiresAt > Date.now());

        // Apply filters
        if (filters) {
          if (filters.recipientId) {
            notifications = notifications.filter((n) => n.recipientId === filters.recipientId);
          }
          if (filters.type) {
            notifications = notifications.filter((n) => n.type === filters.type);
          }
          if (filters.read !== undefined) {
            notifications = notifications.filter((n) => n.read === filters.read);
          }
        }

        // Sort by creation date (newest first)
        notifications.sort((a, b) => b.createdAt - a.createdAt);

        resolve(notifications);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(recipientId?: string): Promise<number> {
    const notifications = await this.getNotifications({
      recipientId,
      read: false,
    });
    return notifications.length;
  }

  /**
   * Mark as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(notificationId);

      request.onsuccess = () => {
        const notification = request.result as PaymentNotification;
        if (notification) {
          notification.read = true;
          notification.readAt = Date.now();

          const updateRequest = store.put(notification);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(recipientId?: string): Promise<number> {
    const notifications = await this.getNotifications({
      recipientId,
      read: false,
    });

    let count = 0;
    for (const notification of notifications) {
      await this.markAsRead(notification.id);
      count++;
    }

    return count;
  }

  /**
   * Dismiss notification
   */
  async dismissNotification(notificationId: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(notificationId);

      request.onsuccess = () => {
        const notification = request.result as PaymentNotification;
        if (notification) {
          notification.dismissed = true;
          notification.dismissedAt = Date.now();

          const updateRequest = store.put(notification);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(notificationId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all notifications
   */
  async clearAll(recipientId?: string): Promise<number> {
    const notifications = await this.getNotifications({ recipientId });

    let count = 0;
    for (const notification of notifications) {
      await this.deleteNotification(notification.id);
      count++;
    }

    return count;
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  }

  /**
   * Subscribe to events
   */
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }
}

// Create singleton instance
export const paymentNotifications = new PaymentNotificationService();

// Auto-initialize on import (client-side only)
if (typeof window !== 'undefined') {
  paymentNotifications.initialize().catch(console.error);
}

export type { PaymentNotificationOptions };
