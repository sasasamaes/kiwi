'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  LineChartComponent, 
  AreaChartComponent, 
  BarChartComponent, 
  PieChartComponent,
  StatCard,
  PeriodSelector 
} from '@kiwi/ui';

interface DriverAnalytics {
  overview: {
    totalDeliveries: number;
    totalEarnings: number;
    averageEarningPerDelivery: number;
    averageRating: number;
    completionRate: number;
    activeHours: number;
  };
  deliveries: {
    daily: { date: string; value: number }[];
    averageDistance: number;
    averageTime: number;
  };
  earnings: {
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
    utilizationRate: number;
  };
  trend: {
    deliveriesGrowth: number;
    earningsGrowth: number;
    ratingGrowth: number;
  };
}

// Mock data for demo
const mockDriverAnalytics: DriverAnalytics = {
  overview: {
    totalDeliveries: 156,
    totalEarnings: 234000,
    averageEarningPerDelivery: 1500,
    averageRating: 4.9,
    completionRate: 95,
    activeHours: 168,
  },
  deliveries: {
    daily: Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return { date: date.toISOString().split('T')[0], value: Math.floor(Math.random() * 10) + 2 };
    }),
    averageDistance: 3.2,
    averageTime: 25,
  },
  earnings: {
    daily: Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return { date: date.toISOString().split('T')[0], value: Math.floor(Math.random() * 15000) + 5000 };
    }),
    breakdown: [
      { type: 'Comisión por viaje', amount: 163800 },
      { type: 'Propinas', amount: 46800 },
      { type: 'Bonificaciones', amount: 23400 },
    ],
  },
  ratings: {
    average: 4.9,
    total: 156,
    distribution: [
      { stars: 5, count: 120 },
      { stars: 4, count: 28 },
      { stars: 3, count: 6 },
      { stars: 2, count: 1 },
      { stars: 1, count: 1 },
    ],
  },
  schedule: {
    activeHours: 168,
    averageHoursPerDay: 6.2,
    mostActiveDay: 'Sábado',
    utilizationRate: 75,
  },
  trend: {
    deliveriesGrowth: 18.5,
    earningsGrowth: 22.3,
    ratingGrowth: 0.2,
  },
};

export default function DriverAnalyticsPage() {
  const [period, setPeriod] = useState('week');
  const [analytics, setAnalytics] = useState<DriverAnalytics>(mockDriverAnalytics);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async (selectedPeriod: string) => {
    setLoading(true);
    // In production, this would fetch from API
    // const response = await fetch(`/api/analytics/driver?period=${selectedPeriod}`);
    // const data = await response.json();
    
    // For now, use mock data with simulated delay
    await new Promise(resolve => setTimeout(resolve, 500));
    setAnalytics(mockDriverAnalytics);
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalytics(period);
  }, [period]);

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString()}`;
  };

  return (
    <main className="min-h-screen bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
                📊 Mis Analytics
              </h1>
              <p className="text-surface-500 dark:text-surface-400 mt-1">
                Tu rendimiento como repartidor
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 transition-colors"
            >
              ← Volver
            </Link>
          </div>
        </div>
      </motion.header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Period Selector */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PeriodSelector selected={period} onSelect={setPeriod} />
        </motion.div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            title="Total Entregas"
            value={analytics.overview.totalDeliveries}
            change={analytics.trend.deliveriesGrowth}
            icon="📦"
            color="#22c55e"
          />
          <StatCard
            title="Ganancias"
            value={formatCurrency(analytics.overview.totalEarnings)}
            change={analytics.trend.earningsGrowth}
            icon="💰"
            color="#3b82f6"
          />
          <StatCard
            title="Promedio por Entrega"
            value={formatCurrency(analytics.overview.averageEarningPerDelivery)}
            icon="🧾"
            color="#f59e0b"
          />
          <StatCard
            title="Calificación"
            value={`${analytics.overview.averageRating} ⭐`}
            change={analytics.trend.ratingGrowth}
            icon="⭐"
            color="#eab308"
          />
          <StatCard
            title="Tasa Completado"
            value={`${analytics.overview.completionRate}%`}
            icon="✅"
            color="#22c55e"
          />
          <StatCard
            title="Horas Activas"
            value={`${analytics.overview.activeHours}h`}
            icon="⏱️"
            color="#8b5cf6"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Earnings Chart */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              💰 Mis Ganancias
            </h3>
            <AreaChartComponent data={analytics.earnings.daily} height={250} />
          </motion.div>

          {/* Deliveries Chart */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              📦 Entregas Diarias
            </h3>
            <LineChartComponent data={analytics.deliveries.daily} height={250} />
          </motion.div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Earnings Breakdown */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              💵 Desglose de Ganancias
            </h3>
            <PieChartComponent 
              data={analytics.earnings.breakdown.map(b => ({ 
                name: b.type, 
                value: b.amount 
              }))} 
              height={200}
            />
          </motion.div>

          {/* Schedule Stats */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              📅 Horario
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-surface-600 dark:text-surface-400">Horas totales</span>
                <span className="font-semibold text-surface-800 dark:text-surface-200">
                  {analytics.schedule.activeHours}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-surface-600 dark:text-surface-400">Promedio diario</span>
                <span className="font-semibold text-surface-800 dark:text-surface-200">
                  {analytics.schedule.averageHoursPerDay}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-surface-600 dark:text-surface-400">Día más activo</span>
                <span className="font-semibold text-kiwi-600 dark:text-kiwi-400">
                  {analytics.schedule.mostActiveDay}
                </span>
              </div>
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-surface-600 dark:text-surface-400">Utilización</span>
                  <span className="font-semibold text-surface-800 dark:text-surface-200">
                    {analytics.schedule.utilizationRate}%
                  </span>
                </div>
                <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-3">
                  <motion.div
                    className="bg-kiwi-500 h-3 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${analytics.schedule.utilizationRate}%` }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Performance Metrics */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              📊 Métricas
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-surface-600 dark:text-surface-400">Distancia promedio</span>
                <span className="font-semibold text-surface-800 dark:text-surface-200">
                  {analytics.deliveries.averageDistance} km
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-surface-600 dark:text-surface-400">Tiempo promedio</span>
                <span className="font-semibold text-surface-800 dark:text-surface-200">
                  {analytics.deliveries.averageTime} min
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-surface-600 dark:text-surface-400">Velocidad promedio</span>
                <span className="font-semibold text-surface-800 dark:text-surface-200">
                  {(analytics.deliveries.averageDistance / (analytics.deliveries.averageTime / 60)).toFixed(1)} km/h
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Ratings Section */}
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-6">
            ⭐ Calificaciones Recibidas
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Average Rating */}
            <div className="text-center">
              <div className="text-6xl font-bold text-surface-800 dark:text-surface-100 mb-2">
                {analytics.ratings.average}
              </div>
              <div className="text-4xl mb-2">⭐</div>
              <p className="text-surface-500 dark:text-surface-400">
                {analytics.ratings.total} calificaciones
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-3">
              {analytics.ratings.distribution.map((rating) => {
                const percentage = (rating.count / analytics.ratings.total) * 100;
                return (
                  <div key={rating.stars} className="flex items-center gap-3">
                    <span className="text-lg font-medium text-surface-800 dark:text-surface-200 w-12">
                      {rating.stars} ⭐
                    </span>
                    <div className="flex-1 bg-surface-200 dark:bg-surface-700 rounded-full h-4">
                      <motion.div
                        className="bg-yellow-500 h-4 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: 0.7, duration: 0.5 }}
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

        {/* Tips Section */}
        <motion.div
          className="mt-8 rounded-2xl bg-gradient-to-r from-kiwi-500 to-emerald-600 p-6 text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <h3 className="text-lg font-display font-semibold mb-4">
            💡 Consejos para Ganar Más
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/20 rounded-xl p-4">
              <p className="font-medium mb-1">🌅 Trabaja en horas pico</p>
              <p className="text-sm text-white/80">
                Las 11am-2pm y 5pm-8pm tienen más pedidos
              </p>
            </div>
            <div className="bg-white/20 rounded-xl p-4">
              <p className="font-medium mb-1">⭐ Mantén alta calificación</p>
              <p className="text-sm text-white/80">
                Los repartidores top reciben más pedidos premium
              </p>
            </div>
            <div className="bg-white/20 rounded-xl p-4">
              <p className="font-medium mb-1">🎯 Sé consistente</p>
              <p className="text-sm text-white/80">
                Trabaja al menos 5 días a la semana para bonos
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="bg-white dark:bg-surface-800 rounded-2xl p-8 shadow-2xl"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
          >
            <div className="flex items-center gap-4">
              <motion.div
                className="w-8 h-8 border-4 border-kiwi-500 border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <span className="text-surface-800 dark:text-surface-100 font-medium">
                Cargando analytics...
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </main>
  );
}
