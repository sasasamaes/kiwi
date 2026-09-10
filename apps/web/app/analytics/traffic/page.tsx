'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { BarChart3, Package, Check, AlertTriangle, Calendar, Target } from 'lucide-react';
import { apiFetch } from '@kiwi/ui';

interface TrafficAnalytics {
  totalDeliveries: number;
  averageDeliveryTime: number;
  trafficDelayTotal: number;
  deliveriesAffected: number;
  peakHours: Array<{ hour: number; level: string; deliveries: number }>;
  bestDeliveryTimes: Array<{ hour: number; reason: string }>;
  worstDeliveryTimes: Array<{ hour: number; reason: string }>;
  trafficImpact: {
    onTime: number;
    delayed: number;
    avgDelay: number;
  };
  patterns: Array<{
    day: string;
    pattern: string;
    confidence: number;
  }>;
}

interface DailyStats {
  date: string;
  deliveries: number;
  revenue: number;
  avgTime: number;
  trafficLevel: string;
}

export default function MerchantTrafficAnalytics() {
  const [analytics, setAnalytics] = useState<TrafficAnalytics | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  async function fetchAnalytics() {
    try {
      // Fetch traffic analytics
      const analyticsResponse = await apiFetch('/api/routing/history/merchant/current');
      if (!analyticsResponse.ok) throw new Error(`HTTP ${analyticsResponse.status}`);
      const analyticsData = await analyticsResponse.json();
      setAnalytics(analyticsData);

      // Fetch daily stats
      const statsResponse = await apiFetch(`/api/routing/history?period=${selectedPeriod}`);
      if (!statsResponse.ok) throw new Error(`HTTP ${statsResponse.status}`);
      const statsData = await statsResponse.json();
      setDailyStats(statsData.dailyStats || []);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Use mock data for demo
      setAnalytics({
        totalDeliveries: 156,
        averageDeliveryTime: 28,
        trafficDelayTotal: 420,
        deliveriesAffected: 45,
        peakHours: [
          { hour: 7, level: 'moderate', deliveries: 12 },
          { hour: 8, level: 'heavy', deliveries: 18 },
          { hour: 12, level: 'heavy', deliveries: 25 },
          { hour: 13, level: 'moderate', deliveries: 20 },
          { hour: 18, level: 'heavy', deliveries: 22 },
        ],
        bestDeliveryTimes: [
          { hour: 10, reason: 'Tráfico ligero, repartidores disponibles' },
          { hour: 15, reason: 'Fuera de hora pico, buen flujo' },
          { hour: 20, reason: 'Sin tráfico, rápido' },
        ],
        worstDeliveryTimes: [
          { hour: 7, reason: 'Hora pico mañana, congestión' },
          { hour: 12, reason: 'Almuerzo, tráfico pesado' },
          { hour: 18, reason: 'Hora pico tarde, alta demanda' },
        ],
        trafficImpact: {
          onTime: 111,
          delayed: 45,
          avgDelay: 9.3,
        },
        patterns: [
          { day: 'Lunes', pattern: 'Alta demanda en la mañana', confidence: 0.85 },
          { day: 'Viernes', pattern: 'Picos de almuerzo intensos', confidence: 0.78 },
          { day: 'Sábado', pattern: 'Distribución uniforme', confidence: 0.72 },
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-900 dark:to-surface-800">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-64" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-surface-200 dark:bg-surface-700 rounded-2xl" />
              ))}
            </div>
            <div className="h-96 bg-surface-200 dark:bg-surface-700 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-900 dark:to-surface-800">
      {/* Header */}
      <div className="bg-white/80 dark:bg-surface-800/80 backdrop-blur-xl border-b border-surface-200 dark:border-surface-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/analytics"
                className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-xl transition-colors"
              >
                <svg
                  className="w-5 h-5 text-surface-600 dark:text-surface-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                  <BarChart3 className="h-6 w-6 inline" /> Análisis de Tráfico
                </h1>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  Impacto del tráfico en tus entregas
                </p>
              </div>
            </div>

            {/* Period Selector */}
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
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-kiwi-100 dark:bg-kiwi-900/30 rounded-xl flex items-center justify-center text-2xl">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                  {analytics?.totalDeliveries}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Entregas totales</p>
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
                <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                  {analytics?.averageDeliveryTime} min
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Tiempo promedio</p>
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
                  {analytics?.deliveriesAffected}
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
                  +{analytics?.trafficImpact.avgDelay} min
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Retraso promedio</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Traffic Impact Chart */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-6">
            📈 Impacto del Tráfico en Entregas
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* On-time vs Delayed */}
            <div>
              <h3 className="text-sm font-medium text-surface-600 dark:text-surface-400 mb-4">
                Entregas a tiempo vs retrasadas
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-surface-600 dark:text-surface-400">
                      <Check className="h-4 w-4 inline" /> A tiempo
                    </span>
                    <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
                      {analytics?.trafficImpact.onTime} (
                      {Math.round(
                        ((analytics?.trafficImpact.onTime || 0) /
                          (analytics?.totalDeliveries || 1)) *
                          100,
                      )}
                      %)
                    </span>
                  </div>
                  <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-kiwi-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${((analytics?.trafficImpact.onTime || 0) / (analytics?.totalDeliveries || 1)) * 100}%`,
                      }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-surface-600 dark:text-surface-400">
                      <AlertTriangle className="h-4 w-4 inline" /> Retrasadas
                    </span>
                    <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                      {analytics?.trafficImpact.delayed} (
                      {Math.round(
                        ((analytics?.trafficImpact.delayed || 0) /
                          (analytics?.totalDeliveries || 1)) *
                          100,
                      )}
                      %)
                    </span>
                  </div>
                  <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-orange-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${((analytics?.trafficImpact.delayed || 0) / (analytics?.totalDeliveries || 1)) * 100}%`,
                      }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Traffic Delay Breakdown */}
            <div>
              <h3 className="text-sm font-medium text-surface-600 dark:text-surface-400 mb-4">
                Minutos perdidos por tráfico
              </h3>
              <div className="text-center py-8">
                <motion.div
                  className="text-6xl font-bold text-orange-600 dark:text-orange-400"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                >
                  {analytics?.trafficDelayTotal}
                </motion.div>
                <p className="text-lg text-surface-600 dark:text-surface-400 mt-2">
                  minutos totales de retraso
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                  ≈ {Math.round((analytics?.trafficDelayTotal || 0) / 60)} horas perdidas
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Best & Worst Times */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Best Delivery Times */}
          <motion.div
            className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
              🟢 Mejores Horas para Entregas
            </h2>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
              Programa pedidos en estos horarios para evitar retrasos
            </p>

            <div className="space-y-3">
              {analytics?.bestDeliveryTimes.map((time, index) => (
                <motion.div
                  key={time.hour}
                  className="flex items-center gap-4 p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                >
                  <div className="w-16 text-center">
                    <p className="text-2xl font-bold text-kiwi-600 dark:text-kiwi-400">
                      {time.hour}:00
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
                      {time.reason}
                    </p>
                  </div>
                  <div className="text-kiwi-500">
                    <Check className="h-6 w-6" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Worst Delivery Times */}
          <motion.div
            className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
              🔴 Horas con Más Tráfico
            </h2>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
              Evita estos horarios o informa a clientes de posibles retrasos
            </p>

            <div className="space-y-3">
              {analytics?.worstDeliveryTimes.map((time, index) => (
                <motion.div
                  key={time.hour}
                  className="flex items-center gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                >
                  <div className="w-16 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {time.hour}:00
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
                      {time.reason}
                    </p>
                  </div>
                  <div className="text-red-500">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Weekly Traffic Pattern */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
            <Calendar className="h-5 w-5 inline" /> Patrones de Tráfico por Día
          </h2>

          <div className="grid grid-cols-7 gap-2">
            {/* Hour labels */}
            <div className="text-xs text-surface-500 dark:text-surface-400 text-center">Hora</div>
            {[6, 7, 8, 9, 10, 11, 12].map((hour) => (
              <div
                key={hour}
                className="text-xs text-surface-500 dark:text-surface-400 text-center"
              >
                {hour}:00
              </div>
            ))}

            {/* Monday */}
            <div className="text-xs text-surface-600 dark:text-surface-400 font-medium">Lun</div>
            {['green', 'orange', 'red', 'yellow', 'green', 'green', 'red'].map((color, i) => (
              <div
                key={`mon-${i}`}
                className={`h-8 rounded ${
                  color === 'green'
                    ? 'bg-kiwi-200 dark:bg-kiwi-800'
                    : color === 'yellow'
                      ? 'bg-yellow-200 dark:bg-yellow-800'
                      : color === 'orange'
                        ? 'bg-orange-200 dark:bg-orange-800'
                        : 'bg-red-200 dark:bg-red-800'
                }`}
              />
            ))}

            {/* Tuesday */}
            <div className="text-xs text-surface-600 dark:text-surface-400 font-medium">Mar</div>
            {['green', 'orange', 'red', 'yellow', 'green', 'yellow', 'orange'].map((color, i) => (
              <div
                key={`tue-${i}`}
                className={`h-8 rounded ${
                  color === 'green'
                    ? 'bg-kiwi-200 dark:bg-kiwi-800'
                    : color === 'yellow'
                      ? 'bg-yellow-200 dark:bg-yellow-800'
                      : color === 'orange'
                        ? 'bg-orange-200 dark:bg-orange-800'
                        : 'bg-red-200 dark:bg-red-800'
                }`}
              />
            ))}

            {/* Wednesday */}
            <div className="text-xs text-surface-600 dark:text-surface-400 font-medium">Mié</div>
            {['green', 'yellow', 'red', 'yellow', 'green', 'green', 'red'].map((color, i) => (
              <div
                key={`wed-${i}`}
                className={`h-8 rounded ${
                  color === 'green'
                    ? 'bg-kiwi-200 dark:bg-kiwi-800'
                    : color === 'yellow'
                      ? 'bg-yellow-200 dark:bg-yellow-800'
                      : color === 'orange'
                        ? 'bg-orange-200 dark:bg-orange-800'
                        : 'bg-red-200 dark:bg-red-800'
                }`}
              />
            ))}

            {/* Thursday */}
            <div className="text-xs text-surface-600 dark:text-surface-400 font-medium">Jue</div>
            {['green', 'yellow', 'orange', 'yellow', 'green', 'yellow', 'orange'].map(
              (color, i) => (
                <div
                  key={`thu-${i}`}
                  className={`h-8 rounded ${
                    color === 'green'
                      ? 'bg-kiwi-200 dark:bg-kiwi-800'
                      : color === 'yellow'
                        ? 'bg-yellow-200 dark:bg-yellow-800'
                        : color === 'orange'
                          ? 'bg-orange-200 dark:bg-orange-800'
                          : 'bg-red-200 dark:bg-red-800'
                  }`}
                />
              ),
            )}

            {/* Friday */}
            <div className="text-xs text-surface-600 dark:text-surface-400 font-medium">Vie</div>
            {['green', 'orange', 'red', 'orange', 'yellow', 'red', 'red'].map((color, i) => (
              <div
                key={`fri-${i}`}
                className={`h-8 rounded ${
                  color === 'green'
                    ? 'bg-kiwi-200 dark:bg-kiwi-800'
                    : color === 'yellow'
                      ? 'bg-yellow-200 dark:bg-yellow-800'
                      : color === 'orange'
                        ? 'bg-orange-200 dark:bg-orange-800'
                        : 'bg-red-200 dark:bg-red-800'
                }`}
              />
            ))}

            {/* Saturday */}
            <div className="text-xs text-surface-600 dark:text-surface-400 font-medium">Sáb</div>
            {['green', 'green', 'yellow', 'green', 'green', 'green', 'yellow'].map((color, i) => (
              <div
                key={`sat-${i}`}
                className={`h-8 rounded ${
                  color === 'green'
                    ? 'bg-kiwi-200 dark:bg-kiwi-800'
                    : color === 'yellow'
                      ? 'bg-yellow-200 dark:bg-yellow-800'
                      : color === 'orange'
                        ? 'bg-orange-200 dark:bg-orange-800'
                        : 'bg-red-200 dark:bg-red-800'
                }`}
              />
            ))}

            {/* Sunday */}
            <div className="text-xs text-surface-600 dark:text-surface-400 font-medium">Dom</div>
            {['green', 'green', 'green', 'green', 'green', 'green', 'green'].map((color, i) => (
              <div
                key={`sun-${i}`}
                className={`h-8 rounded ${
                  color === 'green'
                    ? 'bg-kiwi-200 dark:bg-kiwi-800'
                    : color === 'yellow'
                      ? 'bg-yellow-200 dark:bg-yellow-800'
                      : color === 'orange'
                        ? 'bg-orange-200 dark:bg-orange-800'
                        : 'bg-red-200 dark:bg-red-800'
                }`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-kiwi-200 dark:bg-kiwi-800 rounded" />
              <span className="text-xs text-surface-600 dark:text-surface-400">Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-200 dark:bg-yellow-800 rounded" />
              <span className="text-xs text-surface-600 dark:text-surface-400">Ligero</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-200 dark:bg-orange-800 rounded" />
              <span className="text-xs text-surface-600 dark:text-surface-400">Moderado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 dark:bg-red-800 rounded" />
              <span className="text-xs text-surface-600 dark:text-surface-400">Pesado</span>
            </div>
          </div>
        </motion.div>

        {/* Recommendations */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
            💡 Recomendaciones para Optimizar Entregas
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800">
              <div className="text-3xl mb-3">⏰</div>
              <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-2">
                Programa Pedidos Estratégicamente
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Los mejores horarios son 10:00 AM, 3:00 PM y 8:00 PM cuando el tráfico es mínimo.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
              <div className="text-3xl mb-3">📢</div>
              <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-2">
                Informa a tus Clientes
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Muestra alertas de tráfico en tu menú para que los clientes sepan cuando hay
                retrasos.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
              <div className="text-3xl mb-3">
                <BarChart3 className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-2">
                Revisa tus Métricas
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Usa este análisis para ajustar horarios de personal y preparación según el tráfico.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Daily Performance Chart */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-6">
            📈 Rendimiento Diario
          </h2>

          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-[600px]">
              {dailyStats.slice(-7).map((day, index) => (
                <div key={day.date} className="flex-1">
                  <div className="text-center mb-2">
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {new Date(day.date).toLocaleDateString('es-CR', { weekday: 'short' })}
                    </p>
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                      {new Date(day.date).getDate()}
                    </p>
                  </div>

                  <div className="h-32 flex items-end justify-center">
                    <motion.div
                      className="w-full max-w-[40px] rounded-t-lg"
                      style={{
                        height: `${(day.deliveries / 30) * 100}%`,
                        backgroundColor:
                          day.trafficLevel === 'heavy'
                            ? '#ef4444'
                            : day.trafficLevel === 'moderate'
                              ? '#f97316'
                              : day.trafficLevel === 'light'
                                ? '#84cc16'
                                : '#22c55e',
                      }}
                      initial={{ height: 0 }}
                      animate={{ height: `${(day.deliveries / 30) * 100}%` }}
                      transition={{ duration: 0.5, delay: 0.1 * index }}
                    />
                  </div>

                  <div className="text-center mt-2">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                      {day.deliveries}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      ₡{day.revenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Detected Patterns */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
            <Target className="h-5 w-5 inline" /> Patrones Detectados
          </h2>

          <div className="space-y-3">
            {analytics?.patterns.map((pattern, index) => (
              <motion.div
                key={index}
                className="flex items-center gap-4 p-4 rounded-xl bg-surface-50 dark:bg-surface-900"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + index * 0.1 }}
              >
                <div className="w-20 text-center">
                  <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                    {pattern.day}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-surface-800 dark:text-surface-200">
                    {pattern.pattern}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-kiwi-500 rounded-full"
                      style={{ width: `${pattern.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-surface-500 dark:text-surface-400">
                    {Math.round(pattern.confidence * 100)}%
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
