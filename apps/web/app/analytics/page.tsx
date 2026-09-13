'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Package,
  Coins,
  BarChart3,
  Check,
  Star,
  Calendar,
  CalendarDays,
  Smartphone,
  CreditCard,
  DollarSign,
  RefreshCw,
  Utensils,
  Trophy,
} from 'lucide-react';
import { api, Skeleton, StaggerContainer, StaggerItem, useAuth } from '@kiwi/ui';
import { MerchantNav } from '../../components/MerchantNav';

interface MerchantAnalytics {
  period: string;
  overview: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    completionRate: number;
    averageDeliveryTime: number;
    customerSatisfaction: number;
  };
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    byStatus: Array<{ status: string; count: number }>;
    daily: Array<{ date: string; value: number }>;
  };
  revenue: {
    total: number;
    average: number;
    highest: number;
    lowest: number;
    byPaymentMethod: Array<{ method: string; amount: number }>;
  };
  topItems: Array<{
    id: string;
    name: string;
    orders: number;
    revenue: number;
    image: string;
  }>;
  peakHours: Array<{
    hour: number;
    orders: number;
    revenue: number;
  }>;
  customerStats: {
    totalOrders: number;
    totalReviews: number;
    averageRating: number;
    ratingDistribution: Array<{ stars: number; count: number }>;
  };
  trend: {
    ordersGrowth: number;
    revenueGrowth: number;
  };
}

const PERIODS = [
  { id: 'today', label: 'Hoy', icon: Calendar },
  { id: 'week', label: 'Semana', icon: '📆' },
  { id: 'month', label: 'Mes', icon: CalendarDays },
  { id: 'quarter', label: 'Trimestre', icon: BarChart3 },
  { id: 'year', label: 'Año', icon: '📈' },
];

const PAYMENT_METHODS: Record<string, { label: string; icon: any; color: string }> = {
  sinpe: { label: 'SINPE', icon: Smartphone, color: 'bg-green-100 text-green-700' },
  card: { label: 'Tarjeta', icon: CreditCard, color: 'bg-blue-100 text-blue-700' },
  cash: { label: 'Efectivo', icon: DollarSign, color: 'bg-yellow-100 text-yellow-700' },
  crypto: { label: 'Crypto', icon: '₿', color: 'bg-purple-100 text-purple-700' },
};

export default function MerchantAnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  const fetchAnalytics = useCallback(async (period: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMerchantAnalytics(period);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las analíticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchAnalytics(selectedPeriod);
  }, [selectedPeriod, fetchAnalytics, user]);

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString()}`;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-kiwi-600 dark:text-kiwi-400';
    if (growth < 0) return 'text-red-600 dark:text-red-400';
    return 'text-surface-500 dark:text-surface-400';
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return '↑';
    if (growth < 0) return '↓';
    return '→';
  };

  // Calculate max for chart scaling
  const maxDailyOrders = analytics?.orders?.daily
    ? Math.max(...analytics.orders.daily.map((d) => d.value), 1)
    : 1;

  if (loading && !analytics) {
    return (
      <>
        <MerchantNav />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error && !analytics) {
    return (
      <>
        <MerchantNav />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <motion.div
              className="text-center"
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
                No pudimos cargar las analíticas
              </h2>
              <p className="text-surface-500 dark:text-surface-400 mb-6">{error}</p>
              <motion.button
                onClick={() => fetchAnalytics(selectedPeriod)}
                className="px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <RefreshCw className="h-4 w-4 inline" /> Reintentar
              </motion.button>
            </motion.div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <MerchantNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
                <BarChart3 className="h-6 w-6 inline" /> Mis Analíticas
              </h1>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                Rendimiento de tu negocio
              </p>
            </div>
            <motion.button
              onClick={() => fetchAnalytics(selectedPeriod)}
              className="px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              <RefreshCw className="h-4 w-4 inline" /> Actualizar
            </motion.button>
          </div>

          {/* Period Selector */}
          <motion.div
            className="flex gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 p-1 overflow-x-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {PERIODS.map((period) => {
              const PeriodIcon = period.icon as any;
              return (
                <motion.button
                  key={period.id}
                  onClick={() => setSelectedPeriod(period.id)}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    selectedPeriod === period.id
                      ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-100 shadow-soft'
                      : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  {typeof PeriodIcon === 'string' ? (
                    <span className="mr-1">{PeriodIcon}</span>
                  ) : (
                    <PeriodIcon className="mr-1 h-4 w-4 inline" />
                  )}
                  {period.label}
                </motion.button>
              );
            })}
          </motion.div>

          {/* Overview Stats */}
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StaggerItem>
              <motion.div className="rounded-2xl glass p-4" whileHover={{ y: -2 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">
                    <Package className="h-6 w-6" />
                  </span>
                  <span
                    className={`text-xs font-medium ${getGrowthColor(analytics?.trend?.ordersGrowth || 0)}`}
                  >
                    {getGrowthIcon(analytics?.trend?.ordersGrowth || 0)}{' '}
                    {Math.abs(analytics?.trend?.ordersGrowth || 0)}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                  {analytics?.overview?.totalOrders || 0}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Total Pedidos</p>
              </motion.div>
            </StaggerItem>

            <StaggerItem>
              <motion.div className="rounded-2xl glass p-4" whileHover={{ y: -2 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">
                    <Coins className="h-6 w-6" />
                  </span>
                  <span
                    className={`text-xs font-medium ${getGrowthColor(analytics?.trend?.revenueGrowth || 0)}`}
                  >
                    {getGrowthIcon(analytics?.trend?.revenueGrowth || 0)}{' '}
                    {Math.abs(analytics?.trend?.revenueGrowth || 0)}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                  {formatCurrency(analytics?.overview?.totalRevenue || 0)}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Ingresos</p>
              </motion.div>
            </StaggerItem>

            <StaggerItem>
              <motion.div className="rounded-2xl glass p-4" whileHover={{ y: -2 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">
                    <BarChart3 className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-medium text-surface-500 dark:text-surface-400">
                    Promedio
                  </span>
                </div>
                <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                  {formatCurrency(analytics?.overview?.averageOrderValue || 0)}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Por Pedido</p>
              </motion.div>
            </StaggerItem>

            <StaggerItem>
              <motion.div className="rounded-2xl glass p-4" whileHover={{ y: -2 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">
                    <Check className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-medium text-kiwi-600 dark:text-kiwi-400">
                    {analytics?.overview?.completionRate || 0}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                  {analytics?.orders?.completed || 0}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Completados</p>
              </motion.div>
            </StaggerItem>

            <StaggerItem>
              <motion.div className="rounded-2xl glass p-4" whileHover={{ y: -2 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">⏱️</span>
                  <span className="text-xs font-medium text-surface-500 dark:text-surface-400">
                    min
                  </span>
                </div>
                <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                  {analytics?.overview?.averageDeliveryTime || 0}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Tiempo Promedio</p>
              </motion.div>
            </StaggerItem>

            <StaggerItem>
              <motion.div
                className="rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4 shadow-soft dark:shadow-dark border border-kiwi-200 dark:border-kiwi-800"
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">
                    <Star className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-medium text-kiwi-600 dark:text-kiwi-400">
                    Rating
                  </span>
                </div>
                <p className="text-2xl font-bold text-kiwi-700 dark:text-kiwi-300">
                  {analytics?.overview?.customerSatisfaction || 0}
                </p>
                <p className="text-sm text-kiwi-600 dark:text-kiwi-400">Satisfacción</p>
              </motion.div>
            </StaggerItem>
          </StaggerContainer>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Orders Chart */}
            <motion.div
              className="rounded-2xl glass p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
                <BarChart3 className="h-5 w-5 inline" /> Pedidos Diarios
              </h3>
              <div className="flex items-end gap-1 h-40">
                {(analytics?.orders?.daily || []).slice(-7).map((day, index) => (
                  <motion.div
                    key={day.date}
                    className="flex-1 flex flex-col items-center"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                  >
                    <div className="w-full flex flex-col items-center justify-end h-32">
                      <motion.div
                        className="w-full rounded-t-lg bg-kiwi-gradient"
                        initial={{ height: 0 }}
                        animate={{ height: `${(day.value / maxDailyOrders) * 100}%` }}
                        transition={{ delay: 0.5 + index * 0.05, type: 'spring', stiffness: 100 }}
                        style={{ minHeight: day.value > 0 ? '8px' : '0px' }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-surface-400 dark:text-surface-500">
                      {new Date(day.date).toLocaleDateString('es-CR', { weekday: 'short' })}
                    </p>
                    <p className="text-[10px] font-medium text-surface-600 dark:text-surface-300">
                      {day.value}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Payment Methods */}
            <motion.div
              className="rounded-2xl glass p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
                <CreditCard className="h-5 w-5 inline" /> Métodos de Pago
              </h3>
              <div className="space-y-4">
                {(analytics?.revenue?.byPaymentMethod || []).map((method) => {
                  const config = PAYMENT_METHODS[method.method] || {
                    label: method.method,
                    icon: Coins,
                    color: 'bg-surface-100 text-surface-700',
                  };
                  const percentage = analytics?.revenue?.total
                    ? (method.amount / analytics.revenue.total) * 100
                    : 0;
                  const MethodIcon = config.icon as any;

                  return (
                    <div key={method.method}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-medium ${config.color}`}
                          >
                            {typeof MethodIcon === 'string' ? (
                              <span>{MethodIcon}</span>
                            ) : (
                              <MethodIcon className="h-4 w-4 inline" />
                            )}{' '}
                            {config.label}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
                          {formatCurrency(method.amount)}
                        </span>
                      </div>
                      <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-kiwi-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.6, duration: 0.8 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* Top Items & Peak Hours */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Items */}
            <motion.div
              className="rounded-2xl glass p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
                <Trophy className="h-5 w-5 inline" /> Top Productos
              </h3>
              <div className="space-y-3">
                {(analytics?.topItems || []).slice(0, 5).map((item, index) => (
                  <motion.div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.image}</span>
                      <div>
                        <p className="font-medium text-surface-800 dark:text-surface-200">
                          {item.name}
                        </p>
                        <p className="text-sm text-surface-500 dark:text-surface-400">
                          {item.orders} pedidos
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-kiwi-600 dark:text-kiwi-400">
                      {formatCurrency(item.revenue)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Peak Hours */}
            <motion.div
              className="rounded-2xl glass p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
                ⏰ Horas Pico
              </h3>
              <div className="flex items-end gap-1 h-40">
                {(analytics?.peakHours || []).slice(7, 20).map((hour, index) => {
                  const maxOrders = Math.max(
                    ...(analytics?.peakHours || []).map((h) => h.orders),
                    1,
                  );
                  const height = (hour.orders / maxOrders) * 100;

                  return (
                    <motion.div
                      key={hour.hour}
                      className="flex-1 flex flex-col items-center"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      transition={{ delay: 0.7 + index * 0.03 }}
                    >
                      <div className="w-full flex flex-col items-center justify-end h-32">
                        <motion.div
                          className="w-full rounded-t-lg bg-blue-500"
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: 0.8 + index * 0.03, type: 'spring', stiffness: 100 }}
                          style={{ minHeight: hour.orders > 0 ? '4px' : '0px' }}
                        />
                      </div>
                      <p className="mt-1 text-[8px] text-surface-400 dark:text-surface-500">
                        {hour.hour}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-surface-400">
                <span>7am</span>
                <span>12pm</span>
                <span>5pm</span>
              </div>
            </motion.div>
          </div>

          {/* Customer Stats */}
          <motion.div
            className="rounded-2xl glass p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              👥 Estadísticas de Clientes
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                <p className="text-3xl font-bold text-surface-800 dark:text-surface-100">
                  {analytics?.customerStats?.totalOrders || 0}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Pedidos</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                <p className="text-3xl font-bold text-kiwi-600 dark:text-kiwi-400">
                  {analytics?.customerStats?.totalReviews || 0}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Reseñas</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/30">
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  <Star className="h-6 w-6 inline" /> {analytics?.customerStats?.averageRating || 0}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Rating Promedio</p>
              </div>
            </div>

            {/* Rating Distribution */}
            <div className="mt-6 pt-6 border-t border-surface-100 dark:border-surface-700">
              <h4 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                Distribución de Calificaciones
              </h4>
              <div className="space-y-2">
                {(analytics?.customerStats?.ratingDistribution || []).map((rating) => {
                  const total =
                    analytics?.customerStats?.ratingDistribution?.reduce(
                      (sum, r) => sum + r.count,
                      0,
                    ) || 1;
                  const percentage = (rating.count / total) * 100;

                  return (
                    <div key={rating.stars} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-surface-800 dark:text-surface-200 w-12">
                        {rating.stars} <Star className="h-4 w-4 inline" />
                      </span>
                      <div className="flex-1 h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-yellow-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.9, duration: 0.8 }}
                        />
                      </div>
                      <span className="text-sm text-surface-500 dark:text-surface-400 w-16 text-right">
                        {rating.count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            className="rounded-2xl glass p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              ⚡ Acciones Rápidas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/dashboard">
                <motion.button
                  className="w-full p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-600 dark:text-kiwi-400 hover:bg-kiwi-100 dark:hover:bg-kiwi-900/50 transition-colors"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-2xl block mb-2">
                    <BarChart3 className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-medium">Dashboard</span>
                </motion.button>
              </Link>
              <Link href="/menu">
                <motion.button
                  className="w-full p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-2xl block mb-2">
                    <Utensils className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-medium">Mi Menú</span>
                </motion.button>
              </Link>
              <Link href="/orders/scheduled">
                <motion.button
                  className="w-full p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-2xl block mb-2">
                    <Calendar className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-medium">Programados</span>
                </motion.button>
              </Link>
              <Link href="/merchants/me/qr">
                <motion.button
                  className="w-full p-4 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-2xl block mb-2">
                    <Smartphone className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-medium">Mi QR</span>
                </motion.button>
              </Link>
              <Link href="/analytics/traffic">
                <motion.button
                  className="w-full p-4 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-2xl block mb-2">🚦</span>
                  <span className="text-sm font-medium">Tráfico</span>
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}
