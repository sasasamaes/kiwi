'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import { usePaymentNotifications, type PaymentNotification } from './usePaymentNotifications';

interface PaymentNotificationsProps {
  recipientId: string;
  recipientType: 'customer' | 'merchant' | 'driver';
  className?: string;
  onNotificationClick?: (notification: PaymentNotification) => void;
}

interface NotificationItemProps {
  notification: PaymentNotification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: (notification: PaymentNotification) => void;
}

function NotificationItem({
  notification,
  onRead,
  onDismiss,
  onDelete,
  onClick,
}: NotificationItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getIcon = (type: string) => {
    if (type.includes('completed')) return 'Check';
    if (type.includes('failed')) return 'close';
    if (type.includes('processing')) return 'clock';
    if (type.includes('refunded')) return 'coins';
    if (type.includes('received')) return 'coins';
    if (type.includes('pending')) return 'clock';
    if (type.includes('expired')) return '⏰';
    return 'creditCard';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-500 bg-red-50 dark:bg-red-900/30';
      case 'high':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-900/30';
      case 'normal':
        return 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800';
      case 'low':
        return 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900';
      default:
        return 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800';
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(timestamp).toLocaleDateString('es-CR');
  };

  return (
    <motion.div
      className={`border-l-4 rounded-r-xl p-3 ${getPriorityColor(notification.priority)} ${
        !notification.read ? 'ring-2 ring-kiwi-500/20' : ''
      }`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      layout
    >
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => {
          if (!notification.read) onRead(notification.id);
          onClick?.(notification);
          setIsExpanded(!isExpanded);
        }}
      >
        <span className="text-2xl">{getIcon(notification.type)}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-surface-800 dark:text-surface-200 text-sm">
              {notification.title}
            </h4>
            <span className="text-xs text-surface-500 dark:text-surface-400">
              {formatTime(notification.createdAt)}
            </span>
          </div>

          <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2">
            {notification.body}
          </p>

          {/* Quick Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2 mt-2">
              {notification.actions.slice(0, 2).map((action) => (
                <button
                  key={action.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle action
                    console.log('Action:', action.action);
                  }}
                  className="px-2 py-1 text-xs rounded bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Unread indicator */}
        {!notification.read && <div className="w-2 h-2 bg-kiwi-500 rounded-full mt-1" />}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
              <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
                <span>ID: {notification.paymentId.slice(-8)}</span>
                <span>{new Date(notification.createdAt).toLocaleString('es-CR')}</span>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(notification.id);
                  }}
                  className="flex-1 py-1 text-xs rounded bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
                >
                  Ocultar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notification.id);
                  }}
                  className="flex-1 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function PaymentNotifications({
  recipientId,
  recipientType,
  className = '',
  onNotificationClick,
}: PaymentNotificationsProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    deleteNotification,
    clearAll,
    requestPermission,
    permission,
  } = usePaymentNotifications({
    recipientId,
    refreshInterval: 10000,
  });

  const [showAll, setShowAll] = useState(false);

  const displayNotifications = showAll ? notifications : notifications.slice(0, 10);

  return (
    <div className={`glass rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
              Bell Notificaciones
            </h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-kiwi-500 text-white text-xs font-medium">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {permission !== 'granted' && (
              <motion.button
                onClick={requestPermission}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-400"
                whileTap={{ scale: 0.95 }}
              >
                Bell Activar
              </motion.button>
            )}

            {unreadCount > 0 && (
              <motion.button
                onClick={markAllAsRead}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
                whileTap={{ scale: 0.95 }}
              >
                ✓ Leer todo
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse h-20 bg-surface-200 dark:bg-surface-700 rounded-xl"
              />
            ))}
          </div>
        ) : displayNotifications.length === 0 ? (
          <div className="text-center py-8">
            <motion.div
              className="text-4xl mb-3"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Bell className="h-10 w-10" />
            </motion.div>
            <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-1">
              Sin notificaciones
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Las actualizaciones de pago aparecerán aquí
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {displayNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onDismiss={dismissNotification}
                  onDelete={deleteNotification}
                  onClick={onNotificationClick}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Show More */}
        {notifications.length > 10 && !showAll && (
          <motion.button
            onClick={() => setShowAll(true)}
            className="w-full mt-4 py-2 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 text-sm font-medium"
            whileTap={{ scale: 0.98 }}
          >
            Ver todas ({notifications.length})
          </motion.button>
        )}

        {/* Clear All */}
        {notifications.length > 0 && (
          <motion.button
            onClick={clearAll}
            className="w-full mt-2 py-2 rounded-xl text-red-500 hover:text-red-600 text-sm font-medium"
            whileTap={{ scale: 0.98 }}
          >
            Trash2 Limpiar notificaciones
          </motion.button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact notification badge for headers
 */
export function NotificationBadge({
  recipientId,
  className = '',
}: {
  recipientId: string;
  className?: string;
}) {
  const { unreadCount, notifications } = usePaymentNotifications({
    recipientId,
    refreshInterval: 30000,
  });

  if (unreadCount === 0) {
    return null;
  }

  return (
    <motion.div
      className={`relative ${className}`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500 }}
    >
      <Bell className="text-xl h-6 w-6" />
      <motion.div
        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {unreadCount > 9 ? '9+' : unreadCount}
      </motion.div>
    </motion.div>
  );
}

/**
 * Toast notification for payment events
 */
export function PaymentNotificationToast({
  recipientId,
  className = '',
}: {
  recipientId: string;
  className?: string;
}) {
  const { unreadNotifications } = usePaymentNotifications({
    recipientId,
    refreshInterval: 5000,
  });

  const [currentToast, setCurrentToast] = useState<PaymentNotification | null>(null);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());

  // Show latest unread notification as toast
  useEffect(() => {
    const latestUnread = unreadNotifications.find((n) => !shownIds.has(n.id));
    if (latestUnread && !currentToast) {
      setCurrentToast(latestUnread);
      setShownIds((prev) => new Set([...prev, latestUnread.id]));

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setCurrentToast(null);
      }, 5000);
    }
  }, [unreadNotifications, shownIds, currentToast]);

  if (!currentToast) {
    return null;
  }

  const getIcon = (type: string) => {
    if (type.includes('completed')) return 'Check';
    if (type.includes('failed')) return 'close';
    if (type.includes('processing')) return 'clock';
    return 'creditCard';
  };

  return (
    <motion.div
      className={`fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-surface-800 rounded-xl shadow-lg z-50 p-4 ${className}`}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{getIcon(currentToast.type)}</span>
        <div className="flex-1">
          <h4 className="font-semibold text-surface-800 dark:text-surface-200 text-sm">
            {currentToast.title}
          </h4>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{currentToast.body}</p>
        </div>
        <button
          onClick={() => setCurrentToast(null)}
          className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}
