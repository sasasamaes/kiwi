'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  ClipboardList,
  MapPin,
  Bike,
  Star,
  Calendar,
  Clock,
  RefreshCw,
  Check,
  X,
  Smartphone,
} from 'lucide-react';
import { api, Skeleton } from '@kiwi/ui';

interface OrderHistory {
  id: string;
  status: string;
  orderType: string;
  pickupAddress: string;
  deliveryAddress: string;
  totalAmount: number;
  createdAt: string;
  deliveredAt?: string;
  driver?: {
    fullName: string;
    vehicleType: string;
    rating: number;
  };
  merchant?: {
    businessName: string;
  };
  items?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  delivered: {
    label: 'Entregado',
    icon: Check,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
  },
  cancelled: {
    label: 'Cancelado',
    icon: X,
    color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  },
  in_transit_to_delivery: {
    label: 'En camino',
    icon: '🚀',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  },
  assigned: {
    label: 'Asignado',
    icon: Bike,
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400',
  },
  pending: {
    label: 'Pendiente',
    icon: Clock,
    color: 'bg-surface-100 text-surface-700 dark:bg-surface-700 dark:text-surface-300',
  },
};

const FILTER_TABS = [
  { id: 'all', label: 'Todos', icon: ClipboardList },
  { id: 'active', label: 'Activos', icon: RefreshCw },
  { id: 'delivered', label: 'Entregados', icon: Check },
  { id: 'cancelled', label: 'Cancelados', icon: X },
];

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = orders.filter((order) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return !['delivered', 'cancelled'].includes(order.status);
    return order.status === activeFilter;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-CR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
        <div className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <motion.div
          className="text-center px-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            😕
          </motion.div>
          <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            No pudimos cargar tus pedidos
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Link href="/">
              <button className="px-6 py-3 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 font-medium">
                ← Volver
              </button>
            </Link>
            <button
              onClick={fetchOrders}
              className="px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-medium shadow-kiwi-lg"
            >
              <RefreshCw className="h-4 w-4 inline" /> Reintentar
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 pb-24">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <span>←</span>
              <span className="text-sm font-medium">Inicio</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              <ClipboardList className="h-4 w-4 inline" /> Mis Pedidos
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Filter Tabs */}
        <motion.div
          className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {FILTER_TABS.map((tab) => {
            const TabIcon = tab.icon as any;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                  activeFilter === tab.id
                    ? 'bg-kiwi-500 text-white shadow-kiwi'
                    : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <span className="mr-1">
                  {typeof tab.icon === 'string' ? tab.icon : <TabIcon className="h-4 w-4 inline" />}
                </span>
                {tab.label}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="text-5xl mb-4"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              📭
            </motion.div>
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-2">
              No hay pedidos
            </h3>
            <p className="text-surface-500 dark:text-surface-400 mb-6">
              {activeFilter === 'all'
                ? 'Escanea un QR para hacer tu primer pedido'
                : 'No hay pedidos en esta categoría'}
            </p>
            <Link href="/">
              <button className="px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-medium shadow-kiwi-lg">
                <Smartphone className="h-4 w-4 inline" /> Escanear QR
              </button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order, index) => {
                const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon as any;

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link href={`/order/${order.id}/tracking`}>
                      <motion.div
                        className="rounded-2xl glass p-4 cursor-pointer overflow-hidden"
                        whileHover={{ y: -2, boxShadow: '0 8px 24px -8px rgba(34, 197, 94, 0.2)' }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-900/50 text-2xl">
                              {typeof statusConfig.icon === 'string' ? (
                                statusConfig.icon
                              ) : (
                                <StatusIcon className="h-6 w-6" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-surface-800 dark:text-surface-100">
                                {order.merchant?.businessName || 'Restaurante'}
                              </p>
                              <p className="text-sm text-surface-500 dark:text-surface-400">
                                Pedido #{order.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
                          >
                            {statusConfig.label}
                          </span>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="text-surface-400 h-5 w-5" />
                            <span className="text-surface-600 dark:text-surface-400 truncate">
                              {order.deliveryAddress}
                            </span>
                          </div>
                          {order.driver && (
                            <div className="flex items-center gap-2 text-sm">
                              <Bike className="text-surface-400 h-5 w-5" />
                              <span className="text-surface-600 dark:text-surface-400">
                                {order.driver.fullName}
                              </span>
                              <span className="text-surface-400">•</span>
                              <span className="text-yellow-500">
                                <Star className="h-4 w-4 inline" /> {order.driver.rating}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-surface-700">
                          <div className="flex items-center gap-4 text-sm text-surface-500 dark:text-surface-400">
                            <span>
                              <Calendar className="h-4 w-4 inline" /> {formatDate(order.createdAt)}
                            </span>
                            <span>
                              <Clock className="h-4 w-4 inline" /> {formatTime(order.createdAt)}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-kiwi-600 dark:text-kiwi-400">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </div>

                        {/* Order Items Preview */}
                        {order.items && order.items.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
                            <p className="text-xs text-surface-400 dark:text-surface-500 mb-1">
                              {order.items.length} producto{order.items.length > 1 ? 's' : ''}
                            </p>
                            <p className="text-sm text-surface-600 dark:text-surface-400 truncate">
                              {order.items
                                .map((item) => `${item.quantity}x ${item.name}`)
                                .join(', ')}
                            </p>
                          </div>
                        )}

                        {/* Calificar entregados */}
                        {order.status === 'delivered' && (
                          <div className="mt-3 flex justify-end">
                            <Link
                              href={`/order/${order.id}/rate`}
                              className="inline-flex items-center gap-1 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 px-3 py-1.5 text-xs font-semibold text-yellow-700 dark:text-yellow-400"
                            >
                              <Star className="h-3.5 w-3.5" /> Calificar
                            </Link>
                          </div>
                        )}
                      </motion.div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-surface-200/50 dark:border-surface-700/50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl z-50">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 px-4 py-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
          >
            <Home className="text-xl h-6 w-6" />
            <span className="text-xs font-medium">Inicio</span>
          </Link>
          <Link
            href="/orders"
            className="flex flex-col items-center gap-1 px-4 py-2 text-kiwi-600 dark:text-kiwi-400"
          >
            <ClipboardList className="text-xl h-6 w-6" />
            <span className="text-xs font-medium">Pedidos</span>
          </Link>
          <Link
            href="/tracking"
            className="flex flex-col items-center gap-1 px-4 py-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
          >
            <MapPin className="text-xl h-6 w-6" />
            <span className="text-xs font-medium">Tracking</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
