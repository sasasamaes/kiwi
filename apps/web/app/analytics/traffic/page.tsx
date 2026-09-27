// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Package,
  Check,
  AlertTriangle,
  Calendar,
  Target,
  RefreshCw,
} from 'lucide-react';
import { api, apiFetch, useAuth } from '@kiwi/ui';
import { MerchantNav } from '../../../components/MerchantNav';

interface TrafficPattern {
  hour: number;
  dayOfWeek: number;
  averageLevel: string;
  averageSpeed: number;
  sampleCount: number;
}

interface MerchantReport {
  summary: {
    totalDeliveries: number;
    averageTrafficLevel: string;
    averageDeliveryTime: number;
    trafficDelayedDeliveries: number;
    estimatedTimeLost: number;
  };
  patterns: TrafficPattern[];
  trends: Array<{
    period: string;
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  }>;
  recommendations: string[];
}

interface DayStat {
  date: string;
  value: number;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HEAT_HOURS = [6, 7, 8, 9, 10, 11, 12];

const levelColor = (level?: string) => {
  switch (level) {
    case 'free':
      return 'bg-kiwi-200 dark:bg-kiwi-800';
    case 'light':
      return 'bg-yellow-200 dark:bg-yellow-800';
    case 'moderate':
      return 'bg-orange-200 dark:bg-orange-800';
    case 'heavy':
    case 'severe':
      return 'bg-red-200 dark:bg-red-800';
    default:
      return 'bg-surface-100 dark:bg-surface-700';
  }
};

const levelLabel = (level?: string) => {
  switch (level) {
    case 'free':
      return 'Libre';
    case 'light':
      return 'Ligero';
    case 'moderate':
      return 'Moderado';
    case 'heavy':
      return 'Pesado';
    case 'severe':
      return 'Severo';
    default:
      return 'Sin datos';
  }
};

export default function MerchantTrafficAnalytics() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [report, setReport] = useState<MerchantReport | null>(null);
  const [dailyOrders, setDailyOrders] = useState<DayStat[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DayStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  const fetchAnalytics = useCallback(async (period: 'week' | 'month' | 'quarter') => {
    try {
      setLoading(true);
      setError(null);
      // El backend solo acepta day|week|month: quarter se aproxima a month.
      const backendPeriod = period === 'quarter' ? 'month' : period;
      const [repRes, merch] = await Promise.all([
        apiFetch(`/api/routing/history/merchant/me?period=${backendPeriod}`),
        api.getMerchantAnalytics(period),
      ]);
      if (!repRes.ok) throw new Error(`Tráfico: HTTP ${repRes.status}`);
      setReport(await repRes.json());
      setDailyOrders(merch?.orders?.daily ?? []);
      setDailyRevenue(merch?.revenue?.daily ?? []);
    } catch (err) {
      console.error('Failed to fetch traffic analytics:', err);
      setError(err instanceof Error ? err.message : 'No se pudo cargar el análisis');
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

  if (authLoading || (loading && !report)) {
    return (
      <>
        <MerchantNav />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-64" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-surface-200 dark:bg-surface-700 rounded-2xl" />
              ))}
            </div>
            <div className="h-96 bg-surface-200 dark:bg-surface-700 rounded-2xl" />
          </div>
        </main>
      </>
    );
  }

  if (error && !report) {
    return (
      <>
        <MerchantNav />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-5xl mb-4">😕</p>
              <h2 className="text-xl font-display font-bold mb-2">No pudimos cargar el tráfico</h2>
              <p className="text-surface-500 mb-6">{error}</p>
              <button
                onClick={() => fetchAnalytics(selectedPeriod)}
                className="px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-semibold"
              >
                <RefreshCw className="h-4 w-4 inline" /> Reintentar
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const summary = report?.summary;
  const patterns = report?.patterns ?? [];
  const delayed = summary?.trafficDelayedDeliveries ?? 0;
  const total = summary?.totalDeliveries ?? 0;
  const onTime = Math.max(0, total - delayed);
  const avgDelay = delayed > 0 ? Math.round((summary?.estimatedTimeLost ?? 0) / delayed) : 0;

  const byHour = new Map<number, TrafficPattern[]>();
  for (const p of patterns) {
    const arr = byHour.get(p.hour) ?? [];
    arr.push(p);
    byHour.set(p.hour, arr);
  }
  const worstByHour = [...byHour.entries()]
    .map(([hour, list]) => ({
      hour,
      worst: list.some((p) => p.averageLevel === 'severe' || p.averageLevel === 'heavy'),
      samples: list.reduce((s, p) => s + p.sampleCount, 0),
    }))
    .filter((h) => h.worst)
    .sort((a, b) => b.samples - a.samples)
    .slice(0, 3);
  const bestByHour = [...byHour.entries()]
    .map(([hour, list]) => ({
      hour,
      best:
        list.length > 0 &&
        list.every((p) => p.averageLevel === 'free' || p.averageLevel === 'light'),
      samples: list.reduce((s, p) => s + p.sampleCount, 0),
    }))
    .filter((h) => h.best)
    .sort((a, b) => b.samples - a.samples)
    .slice(0, 3);

  const cellLevel = (day: number, hour: number) =>
    patterns.find((p) => p.dayOfWeek === day && p.hour === hour)?.averageLevel;

  const maxDaily = Math.max(...dailyOrders.map((d) => d.value), 1);
  const hasTrafficData = patterns.length > 0;

  return (
    <>
      <MerchantNav />
      <div className="min-h-[100dvh] bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-900 dark:to-surface-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
                <BarChart3 className="h-6 w-6 inline" /> Análisis de Tráfico
              </h1>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                Impacto del tráfico en tus entregas
              </p>
            </div>
            <div className="flex gap-1 bg-surface-100 dark:bg-surface-700 rounded-xl p-1">
              {(['week', 'month', 'quarter'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedPeriod === period
                      ? 'bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 shadow-sm'
                      : 'text-surface-500 dark:text-surface-400'
                  }`}
                >
                  {period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Trimestre'}
                </button>
              ))}
            </div>
          </div>

          {!hasTrafficData && (
            <div className="mb-6 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Aún no hay suficientes datos de tráfico registrados. Los patrones aparecen solos a
                medida que se registran entregas.
              </p>
            </div>
          )}

          <div className="space-y-6 sm:space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-kiwi-100 dark:bg-kiwi-900/30 rounded-xl flex items-center justify-center">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{total}</p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Entregas totales
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-2xl">
                    ⏱️
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary?.averageDeliveryTime ?? 0} min</p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Tiempo promedio
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-2xl">
                    🚦
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {delayed}
                    </p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Afectados por tráfico
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center text-2xl">
                    🐢
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      +{avgDelay} min
                    </p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Retraso promedio
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* On-time vs Delayed */}
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-lg font-display font-bold mb-6">📈 A tiempo vs retrasadas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">
                      <Check className="h-4 w-4 inline" /> A tiempo
                    </span>
                    <span className="text-sm font-medium">
                      {onTime} ({total > 0 ? Math.round((onTime / total) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-kiwi-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${total > 0 ? (onTime / total) * 100 : 0}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between mb-1 mt-4">
                    <span className="text-sm">
                      <AlertTriangle className="h-4 w-4 inline" /> Retrasadas
                    </span>
                    <span className="text-sm font-medium text-orange-600">
                      {delayed} ({total > 0 ? Math.round((delayed / total) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-orange-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${total > 0 ? (delayed / total) * 100 : 0}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                </div>
                <div className="text-center py-4">
                  <p className="text-6xl font-bold text-orange-600 dark:text-orange-400">
                    {summary?.estimatedTimeLost ?? 0}
                  </p>
                  <p className="text-lg text-surface-600 mt-2">minutos totales de retraso</p>
                  <p className="text-sm text-surface-500 mt-1">
                    Nivel promedio: {levelLabel(summary?.averageTrafficLevel)}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Best & Worst */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <h2 className="text-lg font-display font-bold mb-2">🟢 Mejores horas</h2>
                <p className="text-sm text-surface-500 mb-4">Tráfico libre o ligero observado</p>
                <div className="space-y-3">
                  {bestByHour.length === 0 && (
                    <p className="text-sm text-surface-400">Sin datos suficientes todavía.</p>
                  )}
                  {bestByHour.map((t) => (
                    <div
                      key={t.hour}
                      className="flex items-center gap-4 p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800"
                    >
                      <p className="text-2xl font-bold text-kiwi-700 w-16 text-center">
                        {t.hour}:00
                      </p>
                      <p className="text-sm flex-1">{t.samples} observaciones favorables</p>
                      <Check className="h-6 w-6 text-kiwi-500" />
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <h2 className="text-lg font-display font-bold mb-2">🔴 Horas con más tráfico</h2>
                <p className="text-sm text-surface-500 mb-4">Evítalas o avisa retrasos</p>
                <div className="space-y-3">
                  {worstByHour.length === 0 && (
                    <p className="text-sm text-surface-400">Sin congestión registrada. 🎉</p>
                  )}
                  {worstByHour.map((t) => (
                    <div
                      key={t.hour}
                      className="flex items-center gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800"
                    >
                      <p className="text-2xl font-bold text-red-600 w-16 text-center">
                        {t.hour}:00
                      </p>
                      <p className="text-sm flex-1">{t.samples} observaciones con congestión</p>
                      <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Heatmap from observed patterns */}
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <h2 className="text-lg font-display font-bold mb-4">
                <Calendar className="h-5 w-5 inline" /> Mapa de calor observado
              </h2>
              <div className="grid grid-cols-8 gap-2">
                <div className="text-xs text-surface-500 text-center">Hora</div>
                {HEAT_HOURS.map((hour) => (
                  <div key={hour} className="text-xs text-surface-500 text-center">
                    {hour}:00
                  </div>
                ))}
                {DAY_NAMES.map((day, d) => (
                  <Fragment key={day}>
                    <div className="text-xs font-medium text-surface-600 dark:text-surface-400">
                      {day}
                    </div>
                    {HEAT_HOURS.map((hour) => (
                      <div
                        key={`${d}-${hour}`}
                        className={`h-8 rounded ${levelColor(cellLevel(d, hour))}`}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 mt-6">
                {(
                  [
                    ['Libre', 'bg-kiwi-200 dark:bg-kiwi-800'],
                    ['Ligero', 'bg-yellow-200 dark:bg-yellow-800'],
                    ['Moderado', 'bg-orange-200 dark:bg-orange-800'],
                    ['Pesado', 'bg-red-200 dark:bg-red-800'],
                  ] as const
                ).map(([label, cls]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${cls}`} />
                    <span className="text-xs text-surface-600 dark:text-surface-400">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Daily deliveries from merchant analytics */}
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              <h2 className="text-lg font-display font-bold mb-6">📈 Entregas por día</h2>
              {dailyOrders.length === 0 ? (
                <p className="text-sm text-surface-400">Sin entregas en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex gap-2 min-w-[600px]">
                    {dailyOrders.slice(-7).map((day) => {
                      const max = Math.max(...dailyOrders.map((d) => d.value), 1);
                      const rev = dailyRevenue.find((r) => r.date === day.date)?.value ?? 0;
                      return (
                        <div key={day.date} className="flex-1">
                          <div className="text-center mb-2">
                            <p className="text-xs text-surface-500">
                              {new Date(day.date).toLocaleDateString('es-CR', { weekday: 'short' })}
                            </p>
                            <p className="text-sm font-medium">{new Date(day.date).getDate()}</p>
                          </div>
                          <div className="h-32 flex items-end justify-center">
                            <motion.div
                              className="w-full max-w-[40px] rounded-t-lg bg-kiwi-500"
                              initial={{ height: 0 }}
                              animate={{ height: `${(day.value / max) * 100}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <div className="text-center mt-2">
                            <p className="text-sm font-medium">{day.value}</p>
                            <p className="text-xs text-surface-500">₡{rev.toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Real backend recommendations */}
            {(report?.recommendations?.length ?? 0) > 0 && (
              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
              >
                <h2 className="text-lg font-display font-bold mb-4">
                  <Target className="h-5 w-5 inline" /> Recomendaciones
                </h2>
                <ul className="space-y-2">
                  {report!.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm text-surface-700 dark:text-surface-300"
                    >
                      <span>💡</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
