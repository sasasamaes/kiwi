'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { offlineAnalytics, type OfflineUsageStats } from './offline-analytics';

interface OfflineAnalyticsDashboardProps {
  className?: string;
  period?: number; // days
}

export function OfflineAnalyticsDashboard({
  className = '',
  period = 7,
}: OfflineAnalyticsDashboardProps) {
  const [stats, setStats] = useState<OfflineUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    try {
      const data = await offlineAnalytics.getStats(period);
      setStats(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className={`${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-surface-200 dark:bg-surface-700 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const maxDailyOrders = Math.max(...stats.dailyTrends.map(d => d.orders), 1);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            📊 Analíticas Offline
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Uso offline en los últimos {period} días
          </p>
        </div>
        <motion.button
          onClick={loadStats}
          className="px-4 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 font-medium"
          whileTap={{ scale: 0.95 }}
        >
          🔄 Actualizar
        </motion.button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-xl">
              📡
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                {offlineAnalytics.formatDuration(stats.totalOfflineTime)}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Tiempo offline total</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-xl">
              📦
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.offlineOrders}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Pedidos offline</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-kiwi-100 dark:bg-kiwi-900/30 rounded-xl flex items-center justify-center text-xl">
              💳
            </div>
            <div>
              <p className="text-2xl font-bold text-kiwi-600 dark:text-kiwi-400">
                {stats.offlinePayments}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Pagos offline</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-xl">
              🔄
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.syncSuccessRate.toFixed(0)}%
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Éxito sync</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Offline Sessions */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
            Sesiones Offline
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-xl bg-surface-50 dark:bg-surface-900">
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {stats.offlineSessions}
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400">Total sesiones</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-surface-50 dark:bg-surface-900">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {offlineAnalytics.formatDuration(stats.avgOfflineSessionDuration)}
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400">Promedio duración</p>
            </div>
          </div>
        </motion.div>

        {/* Network Distribution */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
            Distribución de Red
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.networkDistribution).map(([network, count]) => {
              const total = Object.values(stats.networkDistribution).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              
              return (
                <div key={network}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-surface-600 dark:text-surface-400">{network}</span>
                    <span className="font-medium text-surface-800 dark:text-surface-200">{percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-kiwi-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Feature Usage */}
      <motion.div
        className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
          Funciones Usadas Offline
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(stats.offlineFeatureUsage).map(([feature, count]) => (
            <div key={feature} className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-center">
              <p className="text-xl font-bold text-surface-800 dark:text-surface-100">{count}</p>
              <p className="text-xs text-surface-500 dark:text-surface-400 capitalize">
                {feature.replace(/_/g, ' ')}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Daily Trends Chart */}
      <motion.div
        className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
          Tendencias Diarias
        </h3>
        <div className="flex items-end gap-2 h-40">
          {stats.dailyTrends.map((day, index) => (
            <div key={day.date} className="flex-1 flex flex-col items-center">
              <div className="w-full flex items-end justify-center gap-0.5 h-32">
                <motion.div
                  className="w-1/3 bg-kiwi-500 rounded-t"
                  initial={{ height: 0 }}
                  animate={{ height: `${(day.orders / maxDailyOrders) * 100}%` }}
                  transition={{ delay: 0.9 + index * 0.05 }}
                />
                <motion.div
                  className="w-1/3 bg-blue-500 rounded-t"
                  initial={{ height: 0 }}
                  animate={{ height: `${(day.payments / maxDailyOrders) * 100}%` }}
                  transition={{ delay: 0.95 + index * 0.05 }}
                />
                <motion.div
                  className="w-1/3 bg-purple-500 rounded-t"
                  initial={{ height: 0 }}
                  animate={{ height: `${(day.syncs / maxDailyOrders) * 100}%` }}
                  transition={{ delay: 1.0 + index * 0.05 }}
                />
              </div>
              <p className="text-[10px] text-surface-500 dark:text-surface-400 mt-1">
                {new Date(day.date).toLocaleDateString('es-CR', { weekday: 'short' })}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-kiwi-500 rounded" />
            <span className="text-surface-600 dark:text-surface-400">Pedidos</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-surface-600 dark:text-surface-400">Pagos</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500 rounded" />
            <span className="text-surface-600 dark:text-surface-400">Syncs</span>
          </div>
        </div>
      </motion.div>

      {/* Insights */}
      <motion.div
        className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
      >
        <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
          💡 Insights
        </h3>
        <div className="space-y-3">
          {stats.syncSuccessRate < 90 && (
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-700 dark:text-orange-400">
                ⚠️ La tasa de sincronización es {stats.syncSuccessRate.toFixed(0)}%. Considera mejorar la conectividad.
              </p>
            </div>
          )}
          {stats.offlineOrders > stats.offlinePayments && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                📦 Hay {stats.offlineOrders - stats.offlinePayments} pedidos offline sin pago procesado.
              </p>
            </div>
          )}
          {stats.conflictsDetected > 0 && (
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-purple-700 dark:text-purple-400">
                ⚠️ Se detectaron {stats.conflictsDetected} conflictos. La resolución automática está funcionando.
              </p>
            </div>
          )}
          <div className="p-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800">
            <p className="text-sm text-kiwi-700 dark:text-kiwi-400">
              ✅ Las rutas offline se han cacheado {stats.routesCached} veces, ahorrando datos y tiempo.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
