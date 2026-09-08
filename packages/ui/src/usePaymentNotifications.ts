'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  paymentNotifications,
  type PaymentNotification,
  type NotificationType,
} from './payment-notifications';

interface UsePaymentNotificationsOptions {
  /** Recipient ID to filter notifications */
  recipientId?: string;

  /** Auto-refresh interval (ms) */
  refreshInterval?: number;

  /** Callback when notification received */
  onNotification?: (notification: PaymentNotification) => void;

  /** Callback when notification clicked */
  onNotificationClick?: (notification: PaymentNotification) => void;
}

interface UsePaymentNotificationsResult {
  /** All notifications */
  notifications: PaymentNotification[];

  /** Unread notifications */
  unreadNotifications: PaymentNotification[];

  /** Unread count */
  unreadCount: number;

  /** Loading state */
  isLoading: boolean;

  /** Create a notification */
  createNotification: (
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
  ) => Promise<PaymentNotification>;

  /** Mark as read */
  markAsRead: (notificationId: string) => Promise<void>;

  /** Mark all as read */
  markAllAsRead: () => Promise<number>;

  /** Dismiss notification */
  dismissNotification: (notificationId: string) => Promise<void>;

  /** Delete notification */
  deleteNotification: (notificationId: string) => Promise<void>;

  /** Clear all */
  clearAll: () => Promise<number>;

  /** Refresh notifications */
  refresh: () => Promise<void>;

  /** Request notification permission */
  requestPermission: () => Promise<NotificationPermission>;

  /** Permission status */
  permission: NotificationPermission;
}

export function usePaymentNotifications(
  options: UsePaymentNotificationsOptions = {},
): UsePaymentNotificationsResult {
  const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const optionsRef = useRef(options);
  optionsRef.current = options;

  /**
   * Load notifications
   */
  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetched = await paymentNotifications.getNotifications({
        recipientId: options.recipientId,
      });
      setNotifications(fetched);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [options.recipientId]);

  /**
   * Load unread count
   */
  const loadUnreadCount = useCallback(async () => {
    const count = await paymentNotifications.getUnreadCount(options.recipientId);
    return count;
  }, [options.recipientId]);

  /**
   * Create notification
   */
  const createNotification = useCallback(
    async (
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
    ) => {
      const notification = await paymentNotifications.createNotification(
        type,
        paymentData,
        additionalData,
      );
      await loadNotifications();
      return notification;
    },
    [loadNotifications],
  );

  /**
   * Mark as read
   */
  const markAsRead = useCallback(
    async (notificationId: string) => {
      await paymentNotifications.markAsRead(notificationId);
      await loadNotifications();
    },
    [loadNotifications],
  );

  /**
   * Mark all as read
   */
  const markAllAsRead = useCallback(async () => {
    const count = await paymentNotifications.markAllAsRead(options.recipientId);
    await loadNotifications();
    return count;
  }, [options.recipientId, loadNotifications]);

  /**
   * Dismiss notification
   */
  const dismissNotification = useCallback(
    async (notificationId: string) => {
      await paymentNotifications.dismissNotification(notificationId);
      await loadNotifications();
    },
    [loadNotifications],
  );

  /**
   * Delete notification
   */
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      await paymentNotifications.deleteNotification(notificationId);
      await loadNotifications();
    },
    [loadNotifications],
  );

  /**
   * Clear all
   */
  const clearAll = useCallback(async () => {
    const count = await paymentNotifications.clearAll(options.recipientId);
    await loadNotifications();
    return count;
  }, [options.recipientId, loadNotifications]);

  /**
   * Request permission
   */
  const requestPermission = useCallback(async () => {
    const result = await paymentNotifications.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // Unread notifications
  const unreadNotifications = notifications.filter((n) => !n.read && !n.dismissed);
  const unreadCount = unreadNotifications.length;

  // Initial load
  useEffect(() => {
    loadNotifications();
    requestPermission();
  }, [loadNotifications, requestPermission]);

  // Auto-refresh
  useEffect(() => {
    if (!options.refreshInterval) return;

    const interval = setInterval(loadNotifications, options.refreshInterval);
    return () => clearInterval(interval);
  }, [options.refreshInterval, loadNotifications]);

  // Listen for notifications
  useEffect(() => {
    const unsubscribe = paymentNotifications.on('notification', (notification) => {
      if (options.onNotification) {
        options.onNotification(notification);
      }
      loadNotifications();
    });

    return () => unsubscribe();
  }, [options.onNotification, loadNotifications]);

  return {
    notifications,
    unreadNotifications,
    unreadCount,
    isLoading,
    createNotification,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    deleteNotification,
    clearAll,
    refresh: loadNotifications,
    requestPermission,
    permission,
  };
}

/**
 * Hook for merchant payment notifications
 */
export function useMerchantPaymentNotifications(merchantId: string) {
  return usePaymentNotifications({
    recipientId: merchantId,
    refreshInterval: 30000, // 30 seconds
  });
}

/**
 * Hook for customer payment notifications
 */
export function useCustomerPaymentNotifications(customerId: string) {
  return usePaymentNotifications({
    recipientId: customerId,
    refreshInterval: 10000, // 10 seconds
  });
}

export type { UsePaymentNotificationsOptions, UsePaymentNotificationsResult };
export type { PaymentNotification, NotificationType };
