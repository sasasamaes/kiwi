// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Package,
  Coins,
  BarChart3,
  Star,
  Home,
  Calendar,
  CalendarDays,
  RefreshCw,
  Target,
  DollarSign,
} from 'lucide-react';
import { api, Skeleton, StaggerContainer, StaggerItem, useAuth } from '@kiwi/ui';

interface DriverAnalytics {
  period: string;
  overview: {
    totalDeliveries: number;
    totalEarnings: number;
    averageEarningPerDelivery: number;
    averageRating: number;
    completionRate: number;
    activeHours: number;
  };
  deliveries: {
    total: number;
    completed: number;
    cancelled: number;
    averageDistance: number;
    averageTime: number;
    daily: { date: string; value: number }[];
  };
  earnings: {
    total: number;
    average: number;
    highest: number;
    daily: { date: string; value: number }[];
    breakdown: { type: string; amount: number }[];
  };
  ratings: {
    average: number;
    total: number;
    distribution: { stars: number; count: number }[];
  };
  schedule: {
    activeHours: number;
    averageHoursPerDay: number;
    mostActiveDay: string;
  };
  trend: {
    deliveriesGrowth: number;
    earningsGrowth: number;
    ratingGrowth: number;
  };
}

const PERIODS = [
  { id: 'today', label: 'Hoy', icon: Calendar },
  { id: 'week', label: 'Semana', icon: '📆' },
  { id: 'month', label: 'Mes', icon: CalendarDays },
  { id: 'all', label: 'Todo', icon: '♾️' },
];

export default function DriverAnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [analytics, setAnalytics] = useState<DriverAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  const fetchAnalytics = useCallback(async (period: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDriverAnalytics(period);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las analíticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
    else if ((user as any).role && (user as any).role !== 'driver') router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchAnalytics(selectedPeriod);
  }, [selectedPeriod, fetchAnalytics, user]);

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString()}`;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-kiwi-700 dark:text-kiwi-400';
    if (growth < 0) return 'text-red-600 dark:text-red-400';
    return 'text-surface-500 dark:text-surface-400';
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return '↑';
    if (growth < 0) return '↓';
    return '→';
  };

  // Calculate max for chart scaling
  const maxDailyEarnings = analytics?.earnings?.daily
    ? Math.max(...analytics.earnings.daily.map((d) => d.value), 1)
    : 1;

  const maxDailyDeliveries = analytics?.deliveries?.daily
    ? Math.max(...analytics.deliveries.daily.map((d) => d.value), 1)
    : 1;

  if (loading && !analytics) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
        <div className="pt-safe sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </main>
    );
  }

  if (error && !analytics) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex flex-col items-center justify-center">
        <motion.div
          className="text-center p-4"
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
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 pb-24">
      {/* Header */}
      <motion.header
        className="pt-safe sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
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
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              <BarChart3 className="h-5 w-5 inline" /> Mis Analytics
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Period Selector */}
        <motion.div
          className="mb-6 flex gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 p-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {PERIODS.map((period) => {
            const PeriodIcon = period.icon as any;
            return (
              <motion.button
                key={period.id}
                onClick={() => setSelectedPeriod(period.id)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  selectedPeriod === period.id
                    ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-100 shadow-soft'
                    : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                {typeof PeriodIcon === 'string' ? (
                  <span className="mr-1">{PeriodIcon}</span>
                ) : (
                  <PeriodIcon className="h-4 w-4 inline mr-1" />
                )}
                {period.label}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Overview Stats */}
        <StaggerContainer className="grid grid-cols-2 gap-3 mb-6">
          <StaggerItem>
            <motion.div
              className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
              whileHover={{ y: -2 }}
            >
              <div className="flex items-center justify-between mb-2">
                <Package className="text-2xl h-6 w-6" />
                <span
                  className={`text-xs font-medium ${getGrowthColor(analytics?.trend?.deliveriesGrowth || 0)}`}
                >
                  {getGrowthIcon(analytics?.trend?.deliveriesGrowth || 0)}{' '}
                  {Math.abs(analytics?.trend?.deliveriesGrowth || 0)}%
                </span>
              </div>
              <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                {analytics?.overview?.totalDeliveries || 0}
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400">Entregas</p>
            </motion.div>
          </StaggerItem>

          <StaggerItem>
            <motion.div
              className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
              whileHover={{ y: -2 }}
            >
              <div className="flex items-center justify-between mb-2">
                <Coins className="text-2xl h-6 w-6" />
                <span
                  className={`text-xs font-medium ${getGrowthColor(analytics?.trend?.earningsGrowth || 0)}`}
                >
                  {getGrowthIcon(analytics?.trend?.earningsGrowth || 0)}{' '}
                  {Math.abs(analytics?.trend?.earningsGrowth || 0)}%
                </span>
              </div>
              <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                {formatCurrency(analytics?.overview?.totalEarnings || 0)}
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400">Ganancias</p>
            </motion.div>
          </StaggerItem>

          <StaggerItem>
            <motion.div
              className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
              whileHover={{ y: -2 }}
            >
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="text-2xl h-6 w-6" />
                <span className="text-xs font-medium text-surface-500 dark:text-surface-400">
                  Promedio
                </span>
              </div>
              <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                {formatCurrency(analytics?.overview?.averageEarningPerDelivery || 0)}
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400">Por Entrega</p>
            </motion.div>
          </StaggerItem>

          <StaggerItem>
            <motion.div
              className="rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4 shadow-soft dark:shadow-dark border border-kiwi-200 dark:border-kiwi-800"
              whileHover={{ y: -2 }}
            >
              <div className="flex items-center justify-between mb-2">
                <Star className="text-2xl h-6 w-6" />
                <span
                  className={`text-xs font-medium ${getGrowthColor(analytics?.trend?.ratingGrowth || 0)}`}
                >
                  {getGrowthIcon(analytics?.trend?.ratingGrowth || 0)}{' '}
                  {Math.abs(analytics?.trend?.ratingGrowth || 0)}
                </span>
              </div>
              <p className="text-2xl font-bold text-kiwi-700 dark:text-kiwi-300">
                {analytics?.overview?.averageRating || 0}
              </p>
              <p className="text-sm text-kiwi-700 dark:text-kiwi-400">Calificación</p>
            </motion.div>
          </StaggerItem>
        </StaggerContainer>

        {/* Earnings Chart */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-4">
            <Coins className="h-4 w-4 inline" /> Ganancias Diarias
          </h3>
          <div className="flex items-end gap-1 h-32">
            {(analytics?.earnings?.daily || []).slice(-7).map((day, index) => (
              <motion.div
                key={day.date}
                className="flex-1 flex flex-col items-center"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <div className="w-full flex flex-col items-center justify-end h-24">
                  <motion.div
                    className="w-full rounded-t-lg bg-kiwi-gradient"
                    initial={{ height: 0 }}
                    animate={{ height: `${(day.value / maxDailyEarnings) * 100}%` }}
                    transition={{ delay: 0.4 + index * 0.05, type: 'spring', stiffness: 100 }}
                    style={{ minHeight: day.value > 0 ? '8px' : '0px' }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-surface-500 dark:text-surface-400">
                  {new Date(day.date).toLocaleDateString('es-CR', { weekday: 'short' })}
                </p>
                <p className="text-[10px] font-medium text-surface-600 dark:text-surface-300">
                  {formatCurrency(day.value)}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Deliveries Chart */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-4">
            <Package className="h-4 w-4 inline" /> Entregas Diarias
          </h3>
          <div className="flex items-end gap-1 h-32">
            {(analytics?.deliveries?.daily || []).slice(-7).map((day, index) => (
              <motion.div
                key={day.date}
                className="flex-1 flex flex-col items-center"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ delay: 0.4 + index * 0.05 }}
              >
                <div className="w-full flex flex-col items-center justify-end h-24">
                  <motion.div
                    className="w-full rounded-t-lg bg-blue-500"
                    initial={{ height: 0 }}
                    animate={{ height: `${(day.value / maxDailyDeliveries) * 100}%` }}
                    transition={{ delay: 0.5 + index * 0.05, type: 'spring', stiffness: 100 }}
                    style={{ minHeight: day.value > 0 ? '8px' : '0px' }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-surface-500 dark:text-surface-400">
                  {new Date(day.date).toLocaleDateString('es-CR', { weekday: 'short' })}
                </p>
                <p className="text-[10px] font-medium text-surface-600 dark:text-surface-300">
                  {day.value}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Earnings Breakdown */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-4">
            <DollarSign className="h-4 w-4 inline" /> Desglose de Ganancias
          </h3>
          <div className="space-y-3">
            {(analytics?.earnings?.breakdown || []).map((item) => {
              const percentage = analytics?.earnings?.total
                ? (item.amount / analytics.earnings.total) * 100
                : 0;
              return (
                <div key={item.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-surface-600 dark:text-surface-400">
                      {item.type}
                    </span>
                    <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
                      {formatCurrency(item.amount)}
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

        {/* Performance Metrics */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-4">
            <BarChart3 className="h-4 w-4 inline" /> Métricas de Rendimiento
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
              <p className="text-sm text-surface-500 dark:text-surface-400">Distancia Promedio</p>
              <p className="text-lg font-bold text-surface-800 dark:text-surface-100">
                {analytics?.deliveries?.averageDistance || 0} km
              </p>
            </div>
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
              <p className="text-sm text-surface-500 dark:text-surface-400">Tiempo Promedio</p>
              <p className="text-lg font-bold text-surface-800 dark:text-surface-100">
                {analytics?.deliveries?.averageTime || 0} min
              </p>
            </div>
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
              <p className="text-sm text-surface-500 dark:text-surface-400">Horas Activas</p>
              <p className="text-lg font-bold text-surface-800 dark:text-surface-100">
                {analytics?.schedule?.activeHours || 0}h
              </p>
            </div>
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
              <p className="text-sm text-surface-500 dark:text-surface-400">Día más activo</p>
              <p className="text-lg font-bold text-kiwi-700 dark:text-kiwi-400">
                {analytics?.schedule?.mostActiveDay || '—'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Ratings Section */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-4">
            <Star className="h-4 w-4 inline" /> Calificaciones
          </h3>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-surface-800 dark:text-surface-100">
                {analytics?.ratings?.average || 0}
              </p>
              <Star className="text-2xl h-6 w-6 mx-auto" />
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {analytics?.ratings?.total || 0} calificaciones
              </p>
            </div>
            <div className="flex-1 space-y-2">
              {(analytics?.ratings?.distribution || []).map((rating) => {
                const total = analytics?.ratings?.total || 1;
                const percentage = (rating.count / total) * 100;

                return (
                  <div key={rating.stars} className="flex items-center gap-2">
                    <span className="text-xs text-surface-500 dark:text-surface-400 w-8">
                      {rating.stars} <Star className="h-3 w-3 inline" />
                    </span>
                    <div className="flex-1 h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-yellow-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: 0.8, duration: 0.8 }}
                      />
                    </div>
                    <span className="text-xs text-surface-500 dark:text-surface-400 w-8 text-right">
                      {rating.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Tips Section */}
        <motion.div
          className="rounded-2xl bg-gradient-to-r from-kiwi-700 to-emerald-700 p-6 text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <h3 className="text-lg font-display font-semibold mb-4">💡 Consejos para Ganar Más</h3>
          <div className="space-y-3">
            <div className="bg-white/20 rounded-xl p-3">
              <p className="font-medium">🌅 Trabaja en horas pico</p>
              <p className="text-sm text-white/80">Las 11am-2pm y 5pm-8pm tienen más pedidos</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3">
              <p className="font-medium">
                <Star className="h-4 w-4 inline" /> Mantén alta calificación
              </p>
              <p className="text-sm text-white/80">
                Los repartidores top reciben más pedidos premium
              </p>
            </div>
            <div className="bg-white/20 rounded-xl p-3">
              <p className="font-medium">
                <Target className="h-4 w-4 inline" /> Sé consistente
              </p>
              <p className="text-sm text-white/80">
                Trabaja al menos 5 días a la semana para bonos
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </main>
  );
}
