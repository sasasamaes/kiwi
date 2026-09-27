// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, type ElementType } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Package,
  Coins,
  Bike,
  BarChart3,
  Calendar,
  CalendarDays,
  RefreshCw,
  ClipboardList,
  Store,
  Users,
  Timer,
  TrendingUp,
  AlertTriangle,
  BadgeCheck,
  Star,
  X,
} from 'lucide-react';
import { api, StaggerContainer, StaggerItem } from '@kiwi/ui';

interface PlatformAnalytics {
  period: string;
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    platformFee: number;
  };
  users: {
    total: number;
    active: number;
    merchants: number;
    drivers: number;
    customers: number;
  };
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
  };
  revenue: {
    total: number;
    platformFee: number;
    averagePerOrder: number;
  };
  growth: {
    userGrowth: number;
    orderGrowth: number;
    revenueGrowth: number;
  };
}

const PERIODS = [
  { id: 'today', label: 'Hoy', icon: Calendar },
  { id: 'week', label: 'Semana', icon: CalendarDays },
  { id: 'month', label: 'Mes', icon: Calendar },
  { id: 'quarter', label: 'Trimestre', icon: BarChart3 },
  { id: 'year', label: 'Año', icon: TrendingUp },
];

interface LivePulse {
  drivers: { online: number; offline: number; busy: number; total: number };
  users: Record<string, number>;
  orders: { waiting: number; inProgress: number };
  today: { delivered: number; revenue: number; platformFee: number };
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [live, setLive] = useState<LivePulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  // % vigente de comisión al repartidor (el backend guarda la tasa por pedido).
  const [commissionPct, setCommissionPct] = useState(15);

  // Alerta de ritmo: viajes/día del mes real vs meta del escenario
  // (misma clave de localStorage que usa el reporte Real vs Proyección).
  const [rhythm, setRhythm] = useState<{
    trips: number;
    days: number;
    realPerDay: number;
    realCommissionPerDay: number;
    meta: number;
    ratioPct: number;
    projectedTrips: number;
    projectedCommission: number;
  } | null>(null);
  const [rhythmDismissed, setRhythmDismissed] = useState(false);

  const loadRhythm = useCallback(async () => {
    try {
      const saved = Number(window.localStorage.getItem('kiwi.reportes.pedidosDia'));
      const meta = Number.isFinite(saved) && saved > 0 ? saved : 20;
      const a = await api.getMonthlyActuals(1);
      const row = a.monthly?.[a.monthly.length - 1];
      if (!row) return;
      const now = new Date();
      const [y, m] = row.month.split('-').map(Number);
      const days =
        y === now.getFullYear() && m === now.getMonth() + 1
          ? Math.max(1, now.getDate())
          : new Date(y, m, 0).getDate();
      const realPerDay = row.trips / days;
      if (realPerDay >= meta) {
        setRhythm(null); // en meta o por encima: sin alerta
        return;
      }
      const realCommissionPerDay = row.commission / days;
      setRhythm({
        trips: row.trips,
        days,
        realPerDay,
        realCommissionPerDay,
        meta,
        ratioPct: meta > 0 ? (realPerDay / meta) * 100 : 0,
        projectedTrips: realPerDay * 30,
        projectedCommission: realCommissionPerDay * 30,
      });
    } catch {
      // La alerta es best-effort: si falla el API no rompe el dashboard.
    }
  }, []);

  useEffect(() => {
    loadRhythm();
  }, [loadRhythm]);

  const fetchLive = useCallback(async () => {
    try {
      setLive(await api.getLivePulse());
    } catch (err) {
      console.error('Failed to fetch live pulse:', err);
    }
    api
      .getDriverCommissionPct()
      .then((p) => setCommissionPct(p))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchLive();
    const t = setInterval(fetchLive, 30000);
    return () => clearInterval(t);
  }, [fetchLive]);

  const fetchAnalytics = useCallback(async (period: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPlatformAnalytics(period);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las analíticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(selectedPeriod);
  }, [selectedPeriod, fetchAnalytics]);

  // Cálculo de la alerta (variables simples: react-compiler lint).
  const rhythmAlert = rhythm
    ? {
        pctToMeta: rhythm.meta > 0 ? (rhythm.meta / rhythm.realPerDay) * 100 : null,
        missingPerDay: rhythm.meta - rhythm.realPerDay,
        possible: rhythm.realCommissionPerDay * rhythm.meta * 30,
      }
    : null;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `₡${(amount / 1000000).toFixed(1)}M`;
    }
    return `₡${(amount / 1000).toFixed(0)}k`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('es-CR');
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

  if (loading && !analytics) {
    return (
      <div className="space-y-6">
        {/* Loading Skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-10 w-48 rounded-xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-20 rounded-lg bg-surface-200 dark:bg-surface-800 animate-pulse" />
            <div className="h-10 w-24 rounded-lg bg-surface-200 dark:bg-surface-800 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
          <div className="h-80 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="mb-4 flex justify-center"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AlertTriangle className="h-14 w-14 text-amber-500" />
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            <BarChart3 className="h-6 w-6 inline" /> Dashboard Admin
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Analíticas de la plataforma Kiwi
          </p>
        </div>
        <div className="flex gap-2">
          <motion.button
            onClick={() => fetchAnalytics(selectedPeriod)}
            className="px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <RefreshCw className="h-4 w-4 inline" /> Actualizar
          </motion.button>
        </div>
      </div>

      {/* Alerta de ritmo vs meta del escenario */}
      {rhythmAlert && !rhythmDismissed && (
        <motion.div
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-500/40 dark:bg-amber-900/20"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1 text-sm text-amber-800 dark:text-amber-200">
            Vas a <b>{rhythm!.realPerDay.toFixed(1)} viajes/día</b> · la meta del escenario es{' '}
            <b>{rhythm!.meta}/día</b> ({rhythm!.ratioPct.toFixed(0)}%). A este ritmo el mes cierra
            con ~{Math.round(rhythm!.projectedTrips)} viajes y{' '}
            <b>₡{Math.round(rhythm!.projectedCommission).toLocaleString('es-CR')}</b> de comisión.
            Te faltan <b>{rhythmAlert.missingPerDay.toFixed(1)} viajes/día</b>
            {rhythmAlert.pctToMeta != null && <> (subir {rhythmAlert.pctToMeta.toFixed(0)}%)</>}
            {rhythmAlert.possible > rhythm!.projectedCommission && (
              <> para alcanzar ₡{Math.round(rhythmAlert.possible).toLocaleString('es-CR')}/mes</>
            )}
            .
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin/reportes"
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
            >
              Ver reporte
            </Link>
            <button
              onClick={() => setRhythmDismissed(true)}
              className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40"
              aria-label="Descartar alerta"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Period Selector */}
      <motion.div
        className="flex gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 p-1 overflow-x-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {PERIODS.map((period) => {
          const PeriodIcon = period.icon as ElementType;
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

      {/* Pulso en vivo: qué pasa AHORA en cada app */}
      <motion.div
        className="rounded-2xl glass p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-display font-semibold text-surface-800 dark:text-surface-100">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kiwi-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-kiwi-500" />
            </span>
            Pulso en vivo
          </h3>
          <button
            onClick={fetchLive}
            className="flex items-center gap-1 text-xs font-medium text-surface-500 hover:text-surface-700"
          >
            <RefreshCw className="h-3 w-3" /> Ahora
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800 p-4 text-center">
            <Bike className="h-6 w-6 mx-auto text-kiwi-700 dark:text-kiwi-400" />
            <p className="mt-1 text-2xl font-bold text-kiwi-700 dark:text-kiwi-300">
              {live?.drivers.online ?? '—'}
            </p>
            <p className="text-xs text-kiwi-700 dark:text-kiwi-400">
              Drivers en línea{live ? ` (${live.drivers.offline} en pausa)` : ''}
            </p>
          </div>
          <div className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-4 text-center">
            <Timer className="h-6 w-6 mx-auto text-gold-600" />
            <p className="mt-1 text-2xl font-bold text-surface-800 dark:text-surface-100">
              {live?.orders.waiting ?? '—'}
            </p>
            <p className="text-xs text-surface-500">
              Esperando repartidor{live ? ` · ${live.orders.inProgress} en curso` : ''}
            </p>
          </div>
          <div className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-4 text-center">
            <Store className="h-6 w-6 mx-auto text-blue-600" />
            <p className="mt-1 text-2xl font-bold text-surface-800 dark:text-surface-100">
              {live ? (live.users.merchant ?? 0) : '—'}
            </p>
            <p className="text-xs text-surface-500">Comercios activos</p>
          </div>
          <div className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-4 text-center">
            <Coins className="h-6 w-6 mx-auto text-kiwi-700" />
            <p className="mt-1 text-2xl font-bold text-surface-800 dark:text-surface-100">
              {live ? `₡${Number(live.today.revenue).toLocaleString()}` : '—'}
            </p>
            <p className="text-xs text-surface-500">
              Hoy{live ? ` · ${live.today.delivered} entregas` : ''}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Overview Stats */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StaggerItem>
          <motion.div className="rounded-2xl glass p-4" whileHover={{ y: -2 }}>
            <div className="flex items-center justify-between mb-2">
              <Users className="h-6 w-6 text-surface-400" />
              <span
                className={`text-xs font-medium ${getGrowthColor(analytics?.growth?.userGrowth || 0)}`}
              >
                {getGrowthIcon(analytics?.growth?.userGrowth || 0)}{' '}
                {Math.abs(analytics?.growth?.userGrowth || 0)}%
              </span>
            </div>
            <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
              {formatNumber(analytics?.overview?.totalUsers || 0)}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">Usuarios Totales</p>
          </motion.div>
        </StaggerItem>

        <StaggerItem>
          <motion.div className="rounded-2xl glass p-4" whileHover={{ y: -2 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kiwi-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-kiwi-500" />
              </span>
              <span className="text-xs font-medium text-kiwi-700 dark:text-kiwi-400">
                {analytics?.overview?.activeUsers || 0} activos
              </span>
            </div>
            <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
              {formatNumber(analytics?.users?.active || 0)}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">Usuarios Activos</p>
          </motion.div>
        </StaggerItem>

        <StaggerItem>
          <motion.div className="rounded-2xl glass p-4" whileHover={{ y: -2 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">
                <Package className="h-6 w-6" />
              </span>
              <span
                className={`text-xs font-medium ${getGrowthColor(analytics?.growth?.orderGrowth || 0)}`}
              >
                {getGrowthIcon(analytics?.growth?.orderGrowth || 0)}{' '}
                {Math.abs(analytics?.growth?.orderGrowth || 0)}%
              </span>
            </div>
            <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
              {formatNumber(analytics?.overview?.totalOrders || 0)}
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
                className={`text-xs font-medium ${getGrowthColor(analytics?.growth?.revenueGrowth || 0)}`}
              >
                {getGrowthIcon(analytics?.growth?.revenueGrowth || 0)}{' '}
                {Math.abs(analytics?.growth?.revenueGrowth || 0)}%
              </span>
            </div>
            <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
              {formatCurrency(analytics?.overview?.totalRevenue || 0)}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">Ingresos Totales</p>
          </motion.div>
        </StaggerItem>

        <StaggerItem>
          <motion.div
            className="rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4 shadow-soft dark:shadow-dark border border-kiwi-200 dark:border-kiwi-800"
            whileHover={{ y: -2 }}
          >
            <div className="flex items-center justify-between mb-2">
              <Coins className="h-6 w-6 text-kiwi-700 dark:text-kiwi-400" />
              <span className="text-xs font-medium text-kiwi-700 dark:text-kiwi-400">
                {commissionPct}% del viaje · la paga el repartidor
              </span>
            </div>
            <p className="text-2xl font-bold text-kiwi-700 dark:text-kiwi-300">
              {formatCurrency(analytics?.overview?.platformFee || 0)}
            </p>
            <p className="text-sm text-kiwi-700 dark:text-kiwi-400">Ganancias Kiwi</p>
            {(live?.today?.platformFee ?? 0) > 0 && (
              <p className="mt-1 text-xs text-kiwi-700/80 dark:text-kiwi-400/80">
                Hoy: {formatCurrency(live?.today?.platformFee || 0)}
              </p>
            )}
          </motion.div>
        </StaggerItem>

        <StaggerItem>
          <motion.div className="rounded-2xl glass p-4" whileHover={{ y: -2 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">
                <Bike className="h-6 w-6" />
              </span>
              <span className="text-xs font-medium text-surface-500 dark:text-surface-400">
                {analytics?.users?.drivers || 0} registrados
              </span>
            </div>
            <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
              {analytics?.users?.drivers || 0}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">Repartidores</p>
          </motion.div>
        </StaggerItem>

        <StaggerItem>
          <motion.div className="rounded-2xl glass p-4" whileHover={{ y: -2 }}>
            <div className="flex items-center justify-between mb-2">
              <Store className="h-6 w-6 text-surface-400" />
              <span className="text-xs font-medium text-surface-500 dark:text-surface-400">
                {analytics?.users?.merchants || 0} registrados
              </span>
            </div>
            <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
              {analytics?.users?.merchants || 0}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">Comercios</p>
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
            <p className="text-sm text-surface-500 dark:text-surface-400">Promedio/Pedido</p>
          </motion.div>
        </StaggerItem>
      </StaggerContainer>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Breakdown */}
        <motion.div
          className="rounded-2xl glass p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            <BarChart3 className="h-5 w-5 inline" /> Estado de Pedidos
          </h3>
          <div className="space-y-4">
            {/* Completed */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-surface-600 dark:text-surface-400">Completados</span>
                <span className="font-medium text-surface-800 dark:text-surface-200">
                  {analytics?.orders?.completed || 0}
                </span>
              </div>
              <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-kiwi-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((analytics?.orders?.completed || 0) / (analytics?.orders?.total || 1)) * 100}%`,
                  }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                />
              </div>
            </div>

            {/* Cancelled */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-surface-600 dark:text-surface-400">Cancelados</span>
                <span className="font-medium text-surface-800 dark:text-surface-200">
                  {analytics?.orders?.cancelled || 0}
                </span>
              </div>
              <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-red-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((analytics?.orders?.cancelled || 0) / (analytics?.orders?.total || 1)) * 100}%`,
                  }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                />
              </div>
            </div>

            {/* Pending */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-surface-600 dark:text-surface-400">Pendientes</span>
                <span className="font-medium text-surface-800 dark:text-surface-200">
                  {analytics?.orders?.pending || 0}
                </span>
              </div>
              <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-yellow-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((analytics?.orders?.pending || 0) / (analytics?.orders?.total || 1)) * 100}%`,
                  }}
                  transition={{ delay: 0.7, duration: 0.8 }}
                />
              </div>
            </div>

            {/* Completion Rate */}
            <div className="pt-4 border-t border-surface-100 dark:border-surface-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-surface-600 dark:text-surface-400">
                  Tasa de Finalización
                </span>
                <span className="text-lg font-bold text-kiwi-700 dark:text-kiwi-400">
                  {analytics?.orders?.total
                    ? Math.round(
                        ((analytics?.orders?.completed || 0) / analytics?.orders?.total) * 100,
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Growth Metrics */}
        <motion.div
          className="rounded-2xl glass p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="flex items-center gap-2 text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            <TrendingUp className="h-5 w-5" /> Crecimiento
          </h3>
          <div className="space-y-6">
            {/* User Growth */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">Usuarios</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    {formatNumber(analytics?.users?.total || 0)} total
                  </p>
                </div>
              </div>
              <span
                className={`text-lg font-bold ${getGrowthColor(analytics?.growth?.userGrowth || 0)}`}
              >
                {getGrowthIcon(analytics?.growth?.userGrowth || 0)}{' '}
                {Math.abs(analytics?.growth?.userGrowth || 0)}%
              </span>
            </div>

            {/* Order Growth */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50">
                  <span className="text-lg">
                    <Package className="h-5 w-5" />
                  </span>
                </div>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">Pedidos</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    {formatNumber(analytics?.orders?.total || 0)} total
                  </p>
                </div>
              </div>
              <span
                className={`text-lg font-bold ${getGrowthColor(analytics?.growth?.orderGrowth || 0)}`}
              >
                {getGrowthIcon(analytics?.growth?.orderGrowth || 0)}{' '}
                {Math.abs(analytics?.growth?.orderGrowth || 0)}%
              </span>
            </div>

            {/* Revenue Growth */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-100 dark:bg-gold-900/50">
                  <span className="text-lg">
                    <Coins className="h-5 w-5" />
                  </span>
                </div>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">Ingresos</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    {formatCurrency(analytics?.revenue?.total || 0)} total
                  </p>
                </div>
              </div>
              <span
                className={`text-lg font-bold ${getGrowthColor(analytics?.growth?.revenueGrowth || 0)}`}
              >
                {getGrowthIcon(analytics?.growth?.revenueGrowth || 0)}{' '}
                {Math.abs(analytics?.growth?.revenueGrowth || 0)}%
              </span>
            </div>

            {/* Platform Fee */}
            <div className="pt-4 border-t border-surface-100 dark:border-surface-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-100 dark:bg-kiwi-900/50">
                    <Coins className="h-5 w-5 text-kiwi-700" />
                  </div>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-200">
                      Ganancias Kiwi
                    </p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      {commissionPct}% del viaje · la paga el repartidor
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold text-kiwi-700 dark:text-kiwi-400">
                  {formatCurrency(analytics?.revenue?.platformFee || 0)}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        className="rounded-2xl glass p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h3 className="flex items-center gap-2 text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
          <Bike className="h-5 w-5" /> Acciones Rápidas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/admin/users">
            <motion.button
              className="w-full p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-400 hover:bg-kiwi-100 dark:hover:bg-kiwi-900/50 transition-colors"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="mb-2 flex justify-center">
                <Users className="h-7 w-7 text-kiwi-700 dark:text-kiwi-400" />
              </span>
              <span className="text-sm font-medium">Gestionar Usuarios</span>
            </motion.button>
          </Link>
          <Link href="/admin/orders">
            <motion.button
              className="w-full p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-2xl block mb-2">
                <Package className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium">Ver Pedidos</span>
            </motion.button>
          </Link>
          <Link href="/admin/kyc">
            <motion.button
              className="w-full p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="mb-2 flex justify-center">
                <BadgeCheck className="h-7 w-7 text-yellow-600 dark:text-yellow-400" />
              </span>
              <span className="text-sm font-medium">Aprobar KYC</span>
            </motion.button>
          </Link>
          <Link href="/admin/ratings">
            <motion.button
              className="w-full p-4 rounded-xl bg-gold-50 dark:bg-gold-900/30 text-gold-600 dark:text-gold-400 hover:bg-gold-100 dark:hover:bg-gold-900/50 transition-colors"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="mb-2 flex justify-center">
                <Star className="h-7 w-7" />
              </span>
              <span className="text-sm font-medium">Comentarios</span>
            </motion.button>
          </Link>
          <Link href="/admin/payments">
            <motion.button
              className="w-full p-4 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-2xl block mb-2">
                <Coins className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium">Ver Pagos</span>
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        className="rounded-2xl glass p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
          <ClipboardList className="h-5 w-5 inline" /> Resumen del Sistema
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
            <p className="text-3xl font-bold text-surface-800 dark:text-surface-100">
              {analytics?.orders?.completed || 0}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">Entregas Completadas</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
            <p className="text-3xl font-bold text-surface-800 dark:text-surface-100">
              {analytics?.orders?.cancelled || 0}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">Cancelaciones</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
            <p className="text-3xl font-bold text-kiwi-700 dark:text-kiwi-400">
              {formatCurrency(analytics?.revenue?.averagePerOrder || 0)}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">Promedio por Pedido</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
            <p className="text-3xl font-bold text-surface-800 dark:text-surface-100">
              {analytics?.users?.customers || 0}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">Clientes Activos</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
