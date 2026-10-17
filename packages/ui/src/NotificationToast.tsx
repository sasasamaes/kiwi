// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useMemo, useCallback, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playNotificationSound, type NotificationSoundKind } from './notification-sound';
import { buildNotificationKey, shouldNotify } from './notification-dedupe';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
  timestamp: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const key = buildNotificationKey({
      type: notification.type,
      orderId: notification.data?.orderId,
      id: notification.data?.id,
      status: notification.data?.status,
    });
    if (!shouldNotify(key)) return;

    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 10)); // Keep last 10

    // Cada toast visible suena (el módulo respeta el interruptor local)
    const soundByType: Record<string, NotificationSoundKind> = {
      new_order: 'new_order',
      order_accepted: 'success',
      order_status: 'order_update',
      payment_received: 'payment',
      chat: 'chat',
    };
    playNotificationSound(soundByType[notification.type] ?? 'default');

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(newNotification.id);
    }, 5000);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = useMemo(
    () => ({ notifications, addNotification, removeNotification, clearNotifications }),
    [notifications, addNotification, removeNotification, clearNotifications],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationToast />
    </NotificationContext.Provider>
  );
}

function NotificationToast() {
  const { notifications, removeNotification } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_order':
        return 'package';
      case 'order_accepted':
        return 'Check';
      case 'order_status':
        return 'location';
      case 'payment_received':
        return 'coins';
      case 'new_rating':
        return 'star';
      case 'withdrawal':
        return 'creditCard';
      case 'kyc':
        return '🪪';
      default:
        return 'bell';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'new_order':
        return 'bg-blue-500';
      case 'order_accepted':
        return 'bg-green-500';
      case 'order_status':
        return 'bg-kiwi-500';
      case 'payment_received':
        return 'bg-yellow-500';
      case 'new_rating':
        return 'bg-purple-500';
      case 'withdrawal':
        return 'bg-cyan-500';
      case 'kyc':
        return 'bg-indigo-500';
      default:
        return 'bg-surface-500';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl overflow-hidden border border-surface-200 dark:border-surface-700"
          >
            <div className="flex items-start gap-3 p-4">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full ${getColor(notification.type)} flex items-center justify-center text-white text-lg`}
              >
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-surface-800 dark:text-surface-100 text-sm">
                  {notification.title}
                </p>
                <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5 line-clamp-2">
                  {notification.body}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 text-surface-500 dark:text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
              >
                ✕
              </button>
            </div>
            {/* Progress bar */}
            <motion.div
              className={`h-1 ${getColor(notification.type)}`}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 5, ease: 'linear' }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default NotificationToast;
