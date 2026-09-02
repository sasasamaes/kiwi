'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  LineChartComponent, 
  AreaChartComponent, 
  BarChartComponent, 
  PieChartComponent,
  StatCard,
  PeriodSelector,
  StaggerContainer,
  StaggerItem
} from '@kiwi/ui';

// Mock data for demo
const mockStats = {
  overview: {
    totalUsers: 1250,
    activeUsers: 890,
    totalOrders: 5420,
    totalRevenue: 27100000,
    platformFee: 2710000,
    activeDrivers: 120,
    activeMerchants: 45,
  },
  recentActivity: [
    { type: 'user', message: 'Nuevo repartidor registrado: Juan Carlos', time: 'Hace 5 min' },
    { type: 'order', message: 'Pedido #KIWI-1234 completado', time: 'Hace 12 min' },
    { type: 'kyc', message: 'KYC pendiente de revisión: María García', time: 'Hace 30 min' },
    { type: 'payment', message: 'Pago procesado: ₡125,000', time: 'Hace 1 hora' },
    { type: 'user', message: 'Nuevo comercio registrado: Punto Ácido', time: 'Hace 2 horas' },
  ],
  dailyRevenue: Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return { date: date.toISOString().split('T')[0], value: Math.floor(Math.random() * 2000000) + 500000 };
  }),
  dailyOrders: Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return { date: date.toISOString().split('T')[0], value: Math.floor(Math.random() * 300) + 100 };
  }),
  userGrowth: [
    { name: 'Ene', value: 250 },
    { name: 'Feb', value: 380 },
    { name: 'Mar', value: 520 },
    { name: 'Abr', value: 680 },
    { name: 'May', value: 850 },
    { name: 'Jun', value: 1020 },
    { name: 'Jul', value: 1250 },
  ],
  ordersByStatus: [
    { name: 'Completados', value: 4986 },
    { name: 'Cancelados', value: 271 },
    { name: 'Pendientes', value: 163 },
  ],
  topMerchants: [
    { name: 'Bowl & Café Luis Alfredo', orders: 456, revenue: 2280000 },
    { name: 'Punto Ácido', orders: 389, revenue: 1556000 },
    { name: 'Los Efes Cevichería', orders: 312, revenue: 1872000 },
    { name: 'Twentis', orders: 278, revenue: 1112000 },
  ],
  topDrivers: [
    { name: 'Juan Carlos', deliveries: 234, rating: 4.9, earnings: 351000 },
    { name: 'Fran', deliveries: 198, rating: 4.8, earnings: 297000 },
    { name: 'Joel', deliveries: 176, rating: 4.7, earnings: 264000 },
  ],
};

export default function AdminDashboard() {
  const [period, setPeriod] = useState('week');
  const [stats, setStats] = useState(mockStats);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `₡${(amount / 1000000).toFixed(1)}M`;
    }
    return `₡${(amount / 1000).toFixed(0)}k`;
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <PeriodSelector selected={period} onSelect={setPeriod} />
        <div className="flex gap-2">
          <button className="px-4 py-2 text-sm font-medium bg-kiwi-500 text-white rounded-lg hover:bg-kiwi-600 transition-colors">
            📥 Exportar
          </button>
          <button className="px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors">
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StaggerItem>
          <StatCard
            title="Usuarios Totales"
            value={stats.overview.totalUsers.toLocaleString()}
            icon="👥"
            color="#3b82f6"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Usuarios Activos"
            value={stats.overview.activeUsers.toLocaleString()}
            icon="🟢"
            color="#22c55e"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Total Pedidos"
            value={stats.overview.totalOrders.toLocaleString()}
            icon="📦"
            color="#8b5cf6"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Ingresos Totales"
            value={formatCurrency(stats.overview.totalRevenue)}
            icon="💰"
            color="#f59e0b"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Comisión Plataforma"
            value={formatCurrency(stats.overview.platformFee)}
            icon="🏦"
            color="#06b6d4"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Repartidores Activos"
            value={stats.overview.activeDrivers.toString()}
            icon="🛵"
            color="#22c55e"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Comercios Activos"
            value={stats.overview.activeMerchants.toString()}
            icon="🏪"
            color="#ec4899"
          />
        </StaggerItem>
      </StaggerContainer>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            💰 Ingresos de la Plataforma
          </h3>
          <AreaChartComponent data={stats.dailyRevenue} height={250} />
        </motion.div>

        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            📦 Pedidos Diarios
          </h3>
          <LineChartComponent data={stats.dailyOrders} height={250} />
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            👥 Crecimiento de Usuarios
          </h3>
          <BarChartComponent data={stats.userGrowth} height={200} />
        </motion.div>

        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            📊 Pedidos por Estado
          </h3>
          <PieChartComponent data={stats.ordersByStatus} height={200} />
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            📋 Actividad Reciente
          </h3>
          <div className="space-y-4">
            {stats.recentActivity.map((activity, index) => (
              <motion.div
                key={index}
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  activity.type === 'user' ? 'bg-blue-100 text-blue-600' :
                  activity.type === 'order' ? 'bg-green-100 text-green-600' :
                  activity.type === 'kyc' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  {activity.type === 'user' ? '👤' :
                   activity.type === 'order' ? '📦' :
                   activity.type === 'kyc' ? '🪪' : '💰'}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-surface-800 dark:text-surface-200">{activity.message}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">{activity.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Merchants */}
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            🏆 Top Comercios
          </h3>
          <div className="space-y-4">
            {stats.topMerchants.map((merchant, index) => (
              <motion.div
                key={index}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-200">{merchant.name}</p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">{merchant.orders} pedidos</p>
                  </div>
                </div>
                <span className="font-semibold text-kiwi-600 dark:text-kiwi-400">
                  {formatCurrency(merchant.revenue)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Top Drivers */}
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            🏆 Top Repartidores
          </h3>
          <div className="space-y-4">
            {stats.topDrivers.map((driver, index) => (
              <motion.div
                key={index}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-200">{driver.name}</p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      {driver.deliveries} entregas • ⭐ {driver.rating}
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-kiwi-600 dark:text-kiwi-400">
                  {formatCurrency(driver.earnings)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
          ⚡ Acciones Rápidas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-600 dark:text-kiwi-400 hover:bg-kiwi-100 dark:hover:bg-kiwi-900/50 transition-colors">
            <span className="text-2xl block mb-2">👥</span>
            <span className="text-sm font-medium">Gestionar Usuarios</span>
          </button>
          <button className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
            <span className="text-2xl block mb-2">📦</span>
            <span className="text-sm font-medium">Ver Pedidos</span>
          </button>
          <button className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors">
            <span className="text-2xl block mb-2">🪪</span>
            <span className="text-sm font-medium">Aprobar KYC</span>
          </button>
          <button className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors">
            <span className="text-2xl block mb-2">💰</span>
            <span className="text-sm font-medium">Ver Pagos</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
