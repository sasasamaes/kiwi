'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './api-client';
import { Package, CheckCircle, RefreshCw, Coins, Star, Gift, Settings, Bell, Loader } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

interface NotificationListProps {
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationList({ onNotificationClick }: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async () => {
    try {
      const data = await api.getMyNotifications(filter === 'unread');
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconComponents: Record<string, string> = {
      new_order: 'package',
      order_accepted: 'check',
      order_status: 'refresh',
      payment_received: 'coins',
      new_rating: 'star',
      promotion: 'gift',
      system: 'settings',
    };
    return iconComponents[type] || 'bell';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('es-CR');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader className="h-8 w-8 text-surface-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        <motion.button
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-kiwi-500 text-white'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
          }`}
          onClick={() => setFilter('all')}
          whileTap={{ scale: 0.95 }}
        >
          Todas
        </motion.button>
        <motion.button
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-kiwi-500 text-white'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
          }`}
          onClick={() => setFilter('unread')}
          whileTap={{ scale: 0.95 }}
        >
          No leídas
        </motion.button>
        {notifications.some(n => !n.read) && (
          <motion.button
            className="ml-auto text-sm text-kiwi-600 dark:text-kiwi-400 font-medium"
            onClick={markAllAsRead}
            whileTap={{ scale: 0.95 }}
          >
            Marcar todo como leído
          </motion.button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        <AnimatePresence>
          {notifications.length === 0 ? (
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span className="mb-4 block"><Bell className="h-12 w-12 text-surface-300 mx-auto" /></span>
              <p className="text-surface-500 dark:text-surface-400">
                {filter === 'unread' ? 'No hay notificaciones nuevas' : 'No hay notificaciones'}
              </p>
            </motion.div>
          ) : (
            notifications.map((notification) => (
              <motion.div
                key={notification.id}
                className={`relative rounded-xl p-4 cursor-pointer transition-all ${
                  notification.read
                    ? 'bg-white dark:bg-surface-800'
                    : 'bg-kiwi-50 dark:bg-kiwi-900/20 border-l-4 border-kiwi-500'
                } shadow-soft dark:shadow-dark`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                whileHover={{ x: 4 }}
                onClick={() => {
                  if (!notification.read) markAsRead(notification.id);
                  onNotificationClick?.(notification);
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {notification.type === 'new_order' && <Package className="h-6 w-6" />}
                    {notification.type === 'order_accepted' && <CheckCircle className="h-6 w-6" />}
                    {notification.type === 'order_status' && <RefreshCw className="h-6 w-6" />}
                    {notification.type === 'payment_received' && <Coins className="h-6 w-6" />}
                    {notification.type === 'new_rating' && <Star className="h-6 w-6" />}
                    {notification.type === 'promotion' && <Gift className="h-6 w-6" />}
                    {notification.type === 'system' && <Settings className="h-6 w-6" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium ${notification.read ? 'text-surface-600 dark:text-surface-400' : 'text-surface-800 dark:text-surface-200'}`}>
                        {notification.title}
                      </p>
                      <span className="text-xs text-surface-400 whitespace-nowrap">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                      {notification.body}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-kiwi-500 flex-shrink-0 mt-2" />
                  )}
                </div>

                {/* Delete button */}
                <motion.button
                  className="absolute top-2 right-2 text-surface-300 hover:text-surface-500 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
