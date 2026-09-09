'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from './api-client';

export interface TrafficPattern {
  hour: number;
  dayOfWeek: number;
  averageLevel: string;
  averageSpeed: number;
  sampleCount: number;
}

export interface TrafficTrend {
  period: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export interface TrafficHeatmapData {
  lat: number;
  lng: number;
  intensity: number;
  level: string;
}

export interface MerchantTrafficReport {
  merchantId: string;
  period: 'day' | 'week' | 'month';
  summary: {
    totalDeliveries: number;
    averageTrafficLevel: string;
    averageDeliveryTime: number;
    trafficDelayedDeliveries: number;
    estimatedTimeLost: number;
  };
  patterns: TrafficPattern[];
  trends: TrafficTrend[];
  recommendations: string[];
}

export interface TrafficAnalyticsProps {
  merchantId: string;
  className?: string;
}

// Traffic level colors
const LEVEL_COLORS = {
  free: '#22c55e',
  light: '#84cc16',
  moderate: '#eab308',
  heavy: '#f97316',
  severe: '#ef4444',
};

// Day names in Spanish
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function TrafficAnalytics({ merchantId, className = '' }: TrafficAnalyticsProps) {
  const [report, setReport] = useState<MerchantTrafficReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'recommendations'>(
    'overview',
  );

  useEffect(() => {
    fetchReport();
  }, [merchantId, period]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(
        `/api/routing/history/merchant/${merchantId}?period=${period}`,
      );
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Failed to fetch traffic report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-64 w-full rounded-2xl bg-surface-200 dark:bg-surface-700" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className={`rounded-2xl glass p-8 text-center ${className}`}>
        <span className="text-4xl block mb-3">BarChart3</span>
        <p className="text-surface-500 dark:text-surface-400">
          No hay datos de tráfico disponibles
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="p-6 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-surface-800 dark:text-surface-100">
            BarChart3 Análisis de Tráfico
          </h3>
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as const).map((p) => (
              <motion.button
                key={p}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                }`}
                onClick={() => setPeriod(p)}
                whileTap={{ scale: 0.95 }}
              >
                {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-100 dark:bg-surface-700 rounded-xl p-1">
          {[
            { id: 'overview' as const, label: 'Resumen', icon: '📈' },
            { id: 'patterns' as const, label: 'Patrones', icon: 'clock' },
            { id: 'recommendations' as const, label: 'Recomendaciones', icon: '💡' },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 shadow-sm'
                  : 'text-surface-500 dark:text-surface-400'
              }`}
              onClick={() => setActiveTab(tab.id)}
              whileTap={{ scale: 0.98 }}
            >
              {tab.icon} {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <OverviewTab report={report} />
            </motion.div>
          )}

          {activeTab === 'patterns' && (
            <motion.div
              key="patterns"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <PatternsTab patterns={report.patterns} />
            </motion.div>
          )}

          {activeTab === 'recommendations' && (
            <motion.div
              key="recommendations"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <RecommendationsTab recommendations={report.recommendations} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({ report }: { report: MerchantTrafficReport }) {
  const { summary, trends } = report;
  const levelColor =
    LEVEL_COLORS[summary.averageTrafficLevel as keyof typeof LEVEL_COLORS] || '#84cc16';

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Package Entregas</p>
          <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
            {summary.totalDeliveries}
          </p>
        </motion.div>

        <motion.div
          className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">⏱️ Tiempo Prom.</p>
          <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
            {summary.averageDeliveryTime} min
          </p>
        </motion.div>

        <motion.div
          className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">🚦 Tráfico Prom.</p>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: levelColor }} />
            <p className="text-lg font-bold capitalize" style={{ color: levelColor }}>
              {summary.averageTrafficLevel}
            </p>
          </div>
        </motion.div>

        <motion.div
          className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">🐢 Retrasos</p>
          <p className="text-2xl font-bold text-orange-600">{summary.trafficDelayedDeliveries}</p>
        </motion.div>
      </div>

      {/* Time Lost */}
      {summary.estimatedTimeLost > 0 && (
        <motion.div
          className="rounded-xl bg-orange-50 dark:bg-orange-900/30 p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <div>
              <p className="font-semibold text-orange-700 dark:text-orange-400">
                {summary.estimatedTimeLost} minutos perdidos por tráfico
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-300">
                {summary.trafficDelayedDeliveries} entregas afectadas
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Trends */}
      {trends.length > 0 && (
        <div>
          <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
            📈 Tendencias
          </h4>
          {trends.map((trend, index) => (
            <motion.div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-900"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            >
              <span className="text-sm text-surface-600 dark:text-surface-400">
                Velocidad promedio
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-surface-800 dark:text-surface-200">
                  {Math.round(trend.current * 100)}%
                </span>
                <span
                  className={`text-sm font-medium ${
                    trend.changePercent > 0
                      ? 'text-green-600 dark:text-green-400'
                      : trend.changePercent < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-surface-500 dark:text-surface-400'
                  }`}
                >
                  {trend.changePercent > 0 ? '↑' : trend.changePercent < 0 ? '↓' : '→'}
                  {Math.abs(trend.changePercent)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// Patterns Tab
function PatternsTab({ patterns }: { patterns: TrafficPattern[] }) {
  // Group patterns by day of week
  const patternsByDay = DAY_NAMES.map((day, dayIndex) => ({
    day,
    patterns: patterns.filter((p) => p.dayOfWeek === dayIndex),
  }));

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
        Clock Patrones por Día y Hora
      </h4>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex gap-1 mb-2">
            <div className="w-12" />
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[10px] text-surface-400 dark:text-surface-500"
              >
                {i}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {patternsByDay.map((dayData, dayIndex) => (
            <motion.div
              key={dayIndex}
              className="flex gap-1 mb-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: dayIndex * 0.05 }}
            >
              <div className="w-12 text-xs font-medium text-surface-600 dark:text-surface-400 flex items-center">
                {dayData.day}
              </div>
              {Array.from({ length: 24 }, (_, hour) => {
                const pattern = dayData.patterns.find((p) => p.hour === hour);
                const level = pattern?.averageLevel || 'free';
                const color = LEVEL_COLORS[level as keyof typeof LEVEL_COLORS] || '#22c55e';
                const opacity = pattern ? 0.3 + pattern.averageSpeed * 0.7 : 0.2;

                return (
                  <motion.div
                    key={hour}
                    className="flex-1 h-6 rounded-sm cursor-pointer"
                    style={{ backgroundColor: color, opacity }}
                    whileHover={{ scale: 1.2, opacity: 1 }}
                    title={`${dayData.day} ${hour}:00 - ${level}`}
                  />
                );
              })}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4">
        {Object.entries(LEVEL_COLORS).map(([level, color]) => (
          <div key={level} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-surface-500 dark:text-surface-400 capitalize">
              {level}
            </span>
          </div>
        ))}
      </div>

      {/* Peak Hours */}
      <div className="mt-6">
        <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
          BarChart3 Horas Pico
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-3">
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
              🟢 Mejores Horarios
            </p>
            <p className="text-xs text-green-600 dark:text-green-300">6-7 AM, 9-11 AM, 8-10 PM</p>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3">
            <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">🔴 Horas Pico</p>
            <p className="text-xs text-red-600 dark:text-red-300">7-9 AM, 12-2 PM, 5-7 PM</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Recommendations Tab
function RecommendationsTab({ recommendations }: { recommendations: string[] }) {
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
        💡 Recomendaciones
      </h4>

      {recommendations.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-4xl block mb-3">Check</span>
          <p className="text-surface-500 dark:text-surface-400">
            No hay recomendaciones en este momento
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <motion.div
              key={index}
              className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <p className="text-sm text-surface-700 dark:text-surface-300">{rec}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Best Times Card */}
      <div className="mt-6 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4">
        <h5 className="font-semibold text-kiwi-700 dark:text-kiwi-400 mb-2">
          ⏰ Horarios Recomendados para Delivery
        </h5>
        <div className="grid grid-cols-3 gap-2">
          {[
            { time: '6-7 AM', level: 'free', label: '🟢 Excelente' },
            { time: '9-11 AM', level: 'light', label: '🟡 Bueno' },
            { time: '8-10 PM', level: 'free', label: '🟢 Excelente' },
          ].map((slot, index) => (
            <div key={index} className="text-center p-2 rounded-lg bg-white dark:bg-surface-800">
              <p className="text-sm font-bold text-surface-800 dark:text-surface-100">
                {slot.time}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">{slot.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Worst Times Card */}
      <div className="rounded-xl bg-red-50 dark:bg-red-900/30 p-4">
        <h5 className="font-semibold text-red-700 dark:text-red-400 mb-2">
          AlertTriangle Horarios a Evitar
        </h5>
        <div className="grid grid-cols-3 gap-2">
          {[
            { time: '7-9 AM', level: 'heavy', label: '🟠 Pesado' },
            { time: '12-2 PM', level: 'heavy', label: '🟠 Pesado' },
            { time: '5-7 PM', level: 'heavy', label: '🟠 Pesado' },
          ].map((slot, index) => (
            <div key={index} className="text-center p-2 rounded-lg bg-white dark:bg-surface-800">
              <p className="text-sm font-bold text-surface-800 dark:text-surface-100">
                {slot.time}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">{slot.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Traffic Heatmap Component
export function TrafficHeatmap({
  data,
  className = '',
}: {
  data: TrafficHeatmapData[];
  className?: string;
}) {
  if (data.length === 0) {
    return (
      <div className={`rounded-2xl glass p-8 text-center ${className}`}>
        <span className="text-4xl block mb-3">Map</span>
        <p className="text-surface-500 dark:text-surface-400">
          No hay datos de mapa de calor disponibles
        </p>
      </div>
    );
  }

  // Normalize intensity for visualization
  const maxIntensity = Math.max(...data.map((d) => d.intensity));

  return (
    <div className={`rounded-2xl glass p-4 ${className}`}>
      <h4 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
        Map Mapa de Calor del Tráfico
      </h4>

      <div className="relative h-64 bg-surface-100 dark:bg-surface-900 rounded-xl overflow-hidden">
        {data.map((point, index) => {
          const normalizedIntensity = point.intensity / maxIntensity;
          const color = LEVEL_COLORS[point.level as keyof typeof LEVEL_COLORS] || '#84cc16';

          // Calculate position (simplified - in real app would use map projection)
          const x = ((point.lng + 85.46) / 0.02) * 100;
          const y = ((10.16 - point.lat) / 0.02) * 100;

          return (
            <motion.div
              key={index}
              className="absolute rounded-full"
              style={{
                left: `${Math.max(0, Math.min(100, x))}%`,
                top: `${Math.max(0, Math.min(100, y))}%`,
                width: `${20 + normalizedIntensity * 30}px`,
                height: `${20 + normalizedIntensity * 30}px`,
                backgroundColor: color,
                opacity: 0.3 + normalizedIntensity * 0.5,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.02 }}
              whileHover={{ scale: 1.5, opacity: 1 }}
              title={`${point.level} - Intensidad: ${Math.round(point.intensity * 100)}%`}
            />
          );
        })}

        {/* Center marker (Nicoya) */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="h-4 w-4 rounded-full bg-kiwi-500 border-2 border-white shadow-lg" />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-kiwi-500" />
          <span className="text-xs text-surface-500 dark:text-surface-400">Nicoya Centro</span>
        </div>
        {Object.entries(LEVEL_COLORS)
          .slice(0, 3)
          .map(([level, color]) => (
            <div key={level} className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full opacity-60" style={{ backgroundColor: color }} />
              <span className="text-xs text-surface-500 dark:text-surface-400 capitalize">
                {level}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
