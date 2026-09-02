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

interface AnalyticsData {
  overview: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    completionRate: number;
    averageDeliveryTime: number;
    customerSatisfaction: number;
  };
  orders: {
    daily: { date: string; value: number }[];
    byStatus: { status: string; count: number }[];
  };
  revenue: {
    daily: { date: string; value: number }[];
    byPaymentMethod: { method: string; amount: number }[];
  };
  topItems: { id: string; name: string; orders: number; revenue: number; image: string }[];
  peakHours: { hour: number; orders: number; revenue: number }[];
  customerStats: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    averageRating: number;
    ratingDistribution: { stars: number; count: number }[];
  };
  trend: {
    ordersGrowth: number;
    revenueGrowth: number;
    customerGrowth: number;
    averageOrderGrowth: number;
  };
}

// Mock data for demo
const mockAnalytics: AnalyticsData = {
  overview: {
    totalOrders: 342,
    totalRevenue: 1710000,
    averageOrderValue: 5000,
    completionRate: 92,
    averageDeliveryTime: 28,
    customerSatisfaction: 4.8,
  },
  orders: {
    daily: Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return { date: date.toISOString().split('T')[0], value: Math.floor(Math.random() * 30) + 5 };
    }),
    byStatus: [
      { status: 'Completado', count: 315 },
      { status: 'Cancelado', count: 17 },
      { status: 'Pendiente', count: 10 },
    ],
  },
  revenue: {
    daily: Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return { date: date.toISOString().split('T')[0], value: Math.floor(Math.random() * 100000) + 30000 };
    }),
    byPaymentMethod: [
      { method: 'SINPE', amount: 769500 },
      { method: 'Tarjeta', amount: 513000 },
      { method: 'Efectivo', amount: 342000 },
      { method: 'Crypto', amount: 85500 },
    ],
  },
  topItems: [
    { id: '1', name: 'Bowl de Pollo', orders: 156, revenue: 702000, image: '🥗' },
    { id: '2', name: 'Café Americano', orders: 134, revenue: 174200, image: '☕' },
    { id: '3', name: 'Smoothie Tropical', orders: 98, revenue: 245000, image: '🥤' },
    { id: '4', name: 'Bowl Vegano', orders: 87, revenue: 417600, image: '🥬' },
    { id: '5', name: 'Latte con Leche', orders: 76, revenue: 152000, image: '☕' },
  ],
  peakHours: [
    { hour: 7, orders: 12, revenue: 54000 },
    { hour: 8, orders: 28, revenue: 126000 },
    { hour: 9, orders: 45, revenue: 202500 },
    { hour: 10, orders: 38, revenue: 171000 },
    { hour: 11, orders: 52, revenue: 234000 },
    { hour: 12, orders: 68, revenue: 306000 },
    { hour: 13, orders: 62, revenue: 279000 },
    { hour: 14, orders: 42, revenue: 189000 },
    { hour: 15, orders: 35, revenue: 157500 },
    { hour: 16, orders: 28, revenue: 126000 },
    { hour: 17, orders: 45, revenue: 202500 },
    { hour: 18, orders: 38, revenue: 171000 },
    { hour: 19, orders: 22, revenue: 99000 },
    { hour: 20, orders: 15, revenue: 67500 },
  ],
  customerStats: {
    totalCustomers: 234,
    newCustomers: 45,
    returningCustomers: 189,
    averageRating: 4.8,
    ratingDistribution: [
      { stars: 5, count: 156 },
      { stars: 4, count: 52 },
      { stars: 3, count: 18 },
      { stars: 2, count: 5 },
      { stars: 1, count: 3 },
    ],
  },
  trend: {
    ordersGrowth: 12.5,
    revenueGrowth: 15.3,
    customerGrowth: 8.2,
    averageOrderGrowth: 2.8,
  },
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('week');
  const [analytics, setAnalytics] = useState<AnalyticsData>(mockAnalytics);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async (selectedPeriod: string) => {
    setLoading(true);
    // In production, this would fetch from API
    // const response = await fetch(`/api/analytics/merchant?period=${selectedPeriod}`);
    // const data = await response.json();
    
    // For now, use mock data with simulated delay
    await new Promise(resolve => setTimeout(resolve, 500));
    setAnalytics(mockAnalytics);
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
                📊 Analytics
              </h1>
              <p className="text-surface-500 dark:text-surface-400 mt-1">
                Rendimiento de tu negocio
              </p>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 transition-colors"
            >
              ← Volver al Dashboard
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
            title="Total Pedidos"
            value={analytics.overview.totalOrders}
            change={analytics.trend.ordersGrowth}
            icon="📦"
            color="#22c55e"
          />
          <StatCard
            title="Ingresos"
            value={formatCurrency(analytics.overview.totalRevenue)}
            change={analytics.trend.revenueGrowth}
            icon="💰"
            color="#3b82f6"
          />
          <StatCard
            title="Ticket Promedio"
            value={formatCurrency(analytics.overview.averageOrderValue)}
            change={analytics.trend.averageOrderGrowth}
            icon="🧾"
            color="#f59e0b"
          />
          <StatCard
            title="Tasa Completado"
            value={`${analytics.overview.completionRate}%`}
            icon="✅"
            color="#22c55e"
          />
          <StatCard
            title="Tiempo Promedio"
            value={`${analytics.overview.averageDeliveryTime} min`}
            icon="⏱️"
            color="#8b5cf6"
          />
          <StatCard
            title="Satisfacción"
            value={`${analytics.overview.customerSatisfaction} ⭐`}
            icon="😊"
            color="#06b6d4"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              💰 Ingresos Diarios
            </h3>
            <AreaChartComponent data={analytics.revenue.daily} height={250} />
          </motion.div>

          {/* Orders Chart */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              📦 Pedidos Diarios
            </h3>
            <LineChartComponent data={analytics.orders.daily} height={250} />
          </motion.div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Peak Hours */}
          <motion.div
            className="lg:col-span-2 rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              🕐 Horas Pico
            </h3>
            <BarChartComponent 
              data={analytics.peakHours.map(h => ({ 
                name: `${h.hour}:00`, 
                value: h.orders 
              }))} 
              height={250} 
            />
          </motion.div>

          {/* Payment Methods */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              💳 Métodos de Pago
            </h3>
            <PieChartComponent 
              data={analytics.revenue.byPaymentMethod.map(p => ({ 
                name: p.method, 
                value: p.amount 
              }))} 
              height={200}
            />
          </motion.div>
        </div>

        {/* Top Items */}
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            🏆 Productos Más Vendidos
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">
                    Producto
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">
                    Pedidos
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">
                    Ingresos
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">
                    Popularidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {analytics.topItems.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.image}</span>
                        <div>
                          <p className="font-medium text-surface-800 dark:text-surface-200">
                            {item.name}
                          </p>
                          <p className="text-sm text-surface-500 dark:text-surface-400">
                            #{index + 1}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-surface-800 dark:text-surface-200">
                        {item.orders}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-surface-800 dark:text-surface-200">
                        {formatCurrency(item.revenue)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-24 bg-surface-200 dark:bg-surface-700 rounded-full h-2">
                        <div
                          className="bg-kiwi-500 h-2 rounded-full"
                          style={{ width: `${(item.orders / analytics.topItems[0].orders) * 100}%` }}
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Customer Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Overview */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              👥 Clientes
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                <p className="text-3xl font-bold text-kiwi-600 dark:text-kiwi-400">
                  {analytics.customerStats.totalCustomers}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Total</p>
              </div>
              <div className="text-center p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {analytics.customerStats.newCustomers}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Nuevos</p>
              </div>
              <div className="text-center p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {analytics.customerStats.returningCustomers}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Recurrentes</p>
              </div>
              <div className="text-center p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {analytics.customerStats.averageRating} ⭐
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">Satisfacción</p>
              </div>
            </div>
          </motion.div>

          {/* Rating Distribution */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              ⭐ Distribución de Calificaciones
            </h3>
            <div className="space-y-3">
              {analytics.customerStats.ratingDistribution.map((rating) => {
                const percentage = (rating.count / analytics.customerStats.totalCustomers) * 100;
                return (
                  <div key={rating.stars} className="flex items-center gap-3">
                    <span className="text-lg font-medium text-surface-800 dark:text-surface-200 w-8">
                      {rating.stars}⭐
                    </span>
                    <div className="flex-1 bg-surface-200 dark:bg-surface-700 rounded-full h-3">
                      <motion.div
                        className="bg-yellow-500 h-3 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: 0.8, duration: 0.5 }}
                      />
                    </div>
                    <span className="text-sm text-surface-500 dark:text-surface-400 w-12 text-right">
                      {rating.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
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
