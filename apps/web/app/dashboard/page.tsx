'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Package,
  Coins,
  Clock,
  Check,
  Utensils,
  Bike,
  Calendar,
  BarChart3,
  Bell,
  Plus,
  Loader2,
} from 'lucide-react';
import {
  AnimatedButton,
  AnimatedCounter,
  StaggerContainer,
  StaggerItem,
  StatCard,
  VehicleBadge,
  ThemeToggle,
  useAuth,
  useSocket,
  usePushNotifications,
  api,
  Order,
  staggerContainer,
} from '@kiwi/ui';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Push notifications
  const { requestPermission } = usePushNotifications({
    enabled: true,
    onNotification: (payload) => {
      setNotifications((prev) => [
        ...prev,
        {
          type: 'info',
          message: payload.notification?.body || 'Nueva notificación',
          time: new Date(),
        },
      ]);
      setUnreadCount((prev) => prev + 1);
    },
  });

  // Real-time socket connection
  const { isConnected, onOrderAccepted, onOrderStatusChanged } = useSocket({
    onConnect: () => console.log('🟢 Connected to real-time updates'),
    onOrderAccepted: (data) => {
      console.log('Order accepted:', data);
      setNotifications((prev) => [
        ...prev,
        { type: 'success', message: data.message, time: new Date() },
      ]);
      // Refresh orders
      fetchOrders();
    },
    onOrderStatusChanged: (data) => {
      console.log('Order status changed:', data);
      setNotifications((prev) => [
        ...prev,
        { type: 'info', message: data.message, time: new Date() },
      ]);
      // Update order in list
      setOrders((prev) =>
        prev.map((order) =>
          order.id === data.orderId ? { ...order, status: data.status } : order,
        ),
      );
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchOrders = async () => {
    try {
      const data = await api.getMyOrders();
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchOrders();
      setLoading(false);
      // Fetch unread count
      try {
        const data = await api.getUnreadNotificationCount();
        setUnreadCount(data.count);
      } catch {
        // Ignore notification count fetch failures
      }
      // Request push notification permission
      requestPermission();
    };

    if (user) {
      fetchData();
    }
  }, [user, requestPermission]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-4xl"
        >
          <Loader2 className="h-8 w-8" />
        </motion.div>
      </div>
    );
  }

  // Compute stats from real orders
  const todayOrders = orders.filter((o) => {
    const created = new Date(o.createdAt);
    const today = new Date();
    return created.toDateString() === today.toDateString();
  });
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');

  return (
    <div className="min-h-[100dvh] bg-bg-light">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <motion.span
                className="text-3xl"
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                🥝
              </motion.span>
              <h1 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                Kiwi
              </h1>
            </Link>
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <motion.div
                  className={`h-2 w-2 rounded-full ${isConnected ? 'bg-kiwi-500' : 'bg-red-500'}`}
                  animate={isConnected ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs text-surface-400 hidden sm:inline">
                  {isConnected ? 'En vivo' : 'Desconectado'}
                </span>
              </div>
              <ThemeToggle />
              <Link href="/notifications">
                <motion.button
                  className="relative rounded-full p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors dark:hover:bg-surface-800"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <span className="text-xl">
                    <Bell className="h-5 w-5" />
                  </span>
                  {unreadCount > 0 && (
                    <motion.span
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-kiwi-500 text-white text-xs font-bold flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500 }}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </motion.button>
              </Link>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm font-medium text-surface-600 dark:text-surface-400 md:block">
                  Mi Negocio
                </span>
                <motion.div
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-gradient text-white font-semibold shadow-kiwi"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {user?.merchantProfile?.businessName?.charAt(0) || 'M'}
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            Buenos días 👋 {user?.merchantProfile?.businessName || ''}
          </h2>
          <p className="text-surface-500 dark:text-surface-400">
            Aquí está el resumen de tu negocio hoy
          </p>
        </motion.div>

        {/* Stats Grid */}
        <StaggerContainer className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatCard
              title="Pedidos Hoy"
              value={String(todayOrders.length)}
              change={`${orders.length} total`}
              changeType="neutral"
              icon={<Package className="h-6 w-6" />}
              color="kiwi"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Ingresos"
              value={`₡${totalRevenue.toLocaleString()}`}
              change={`${deliveredOrders.length} entregados`}
              changeType="positive"
              icon={<Coins className="h-6 w-6" />}
              color="gold"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Pendientes"
              value={String(pendingOrders.length)}
              change={pendingOrders.length > 0 ? 'Esperando repartidor' : 'Todo al día'}
              changeType={pendingOrders.length > 0 ? 'negative' : 'positive'}
              icon={<Clock className="h-6 w-6" />}
              color="blue"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Tasa Éxito"
              value={`${orders.length > 0 ? Math.round((deliveredOrders.length / orders.length) * 100) : 100}%`}
              change="de pedidos"
              changeType="positive"
              icon={<Check className="h-6 w-6" />}
              color="bark"
            />
          </StaggerItem>
        </StaggerContainer>

        {/* Quick Actions */}
        <StaggerContainer className="mb-8 grid gap-4 md:grid-cols-4">
          <StaggerItem>
            <Link href="/orders/new">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(34, 197, 94, 0.25)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-600 dark:text-kiwi-400 transition-colors group-hover:bg-kiwi-500 group-hover:text-white"
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Plus className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Nuevo Pedido
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Crear un pedido ahora
                    </p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            <Link href="/menu">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(251, 191, 36, 0.25)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 text-gold-600 transition-colors group-hover:bg-gold-500 group-hover:text-white"
                    whileHover={{ rotate: -90 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Utensils className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Mi Menú
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Administrar productos
                    </p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            {' '}
            <Link href="/drivers">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(139, 101, 61, 0.15)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bark-100 dark:bg-bark-900/50 text-bark-600 dark:text-bark-400 transition-colors group-hover:bg-bark-500 group-hover:text-white"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Bike className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Repartidores
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">Ver y asignar</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            <Link href="/orders/scheduled">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(251, 191, 36, 0.25)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 dark:bg-gold-900/50 text-gold-600 dark:text-gold-400 transition-colors group-hover:bg-gold-500 group-hover:text-white"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Calendar className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Programados
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">Ver propuestas</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            <Link href="/analytics">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(139, 101, 61, 0.15)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bark-100 dark:bg-bark-900/50 text-bark-600 dark:text-bark-400 transition-colors group-hover:bg-bark-500 group-hover:text-white"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <BarChart3 className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Analytics
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Ver estadísticas
                    </p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>
        </StaggerContainer>

        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100">
                Pedidos Recientes
              </h3>
              <Link
                href="/orders"
                className="text-sm font-medium text-kiwi-600 hover:text-kiwi-700"
              >
                Ver todos →
              </Link>
            </div>

            {orders.length === 0 ? (
              <motion.div
                className="text-center py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="text-5xl mb-3 flex justify-center"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Package className="h-12 w-12 text-surface-300" />
                </motion.div>
                <p className="text-surface-500 dark:text-surface-400">Aún no hay pedidos</p>
                <p className="text-xs text-surface-400 mt-1">Crea tu primer pedido para empezar</p>
              </motion.div>
            ) : (
              <StaggerContainer className="space-y-4">
                {orders.slice(0, 5).map((order: any) => {
                  const statusMap: Record<string, { label: string; color: string }> = {
                    pending: { label: 'Pendiente', color: 'bg-gold-100 text-gold-700' },
                    assigned: { label: 'Asignado', color: 'bg-blue-100 text-blue-700' },
                    in_transit_to_pickup: {
                      label: 'En camino',
                      color: 'bg-kiwi-100 text-kiwi-700',
                    },
                    picked_up: { label: 'Recogido', color: 'bg-kiwi-100 text-kiwi-700' },
                    in_transit_to_delivery: {
                      label: 'Entregando',
                      color: 'bg-kiwi-100 text-kiwi-700',
                    },
                    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
                    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
                  };
                  const statusInfo = statusMap[order.status] || {
                    label: order.status,
                    color: 'bg-surface-100 text-surface-700',
                  };
                  const time = new Date(order.createdAt).toLocaleTimeString('es-CR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <StaggerItem key={order.id}>
                      <motion.div
                        className="group flex items-center justify-between rounded-xl border border-surface-100 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-900/50 p-4 transition-all hover:border-kiwi-200 hover:bg-white dark:hover:bg-surface-800 hover:shadow-soft-md"
                        whileHover={{ x: 4 }}
                      >
                        <div className="flex items-center gap-4">
                          <motion.div
                            className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 text-kiwi-600 transition-colors group-hover:bg-kiwi-500 group-hover:text-white"
                            whileHover={{ rotate: 10 }}
                          >
                            <span className="text-lg font-bold">#{order.id.slice(-4)}</span>
                          </motion.div>
                          <div>
                            <p className="font-medium text-surface-800 dark:text-surface-200">
                              {order.pickupAddress} → {order.deliveryAddress}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-surface-400 flex items-center gap-1">
                                {order.driver ? (
                                  <>
                                    <Bike className="h-4 w-4" /> Asignado
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-4 w-4" /> Sin repartidor
                                  </>
                                )}
                              </p>
                              {order.driver && (
                                <VehicleBadge
                                  type={order.driver.vehicleType || 'motorcycle'}
                                  size="sm"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-semibold text-surface-700 dark:text-surface-300">
                            ₡{Number(order.totalAmount).toLocaleString()}
                          </span>
                          <motion.span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
                            whileHover={{ scale: 1.05 }}
                          >
                            {statusInfo.label}
                          </motion.span>
                          <span className="text-sm text-surface-400">{time}</span>
                        </div>
                      </motion.div>
                    </StaggerItem>
                  );
                })}
              </StaggerContainer>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
