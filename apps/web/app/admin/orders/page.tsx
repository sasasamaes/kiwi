'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

const mockOrders = [
  {
    id: 'KIWI-1234',
    merchant: 'Bowl & Café Luis Alfredo',
    driver: 'Juan Carlos',
    customer: 'María García',
    status: 'delivered',
    amount: 5700,
    fee: 570,
    createdAt: '2024-03-20T10:30:00',
    deliveredAt: '2024-03-20T11:05:00',
  },
  {
    id: 'KIWI-1233',
    merchant: 'Punto Ácido',
    driver: 'Fran',
    customer: 'Pedro López',
    status: 'in_transit',
    amount: 3200,
    fee: 320,
    createdAt: '2024-03-20T10:15:00',
    deliveredAt: null,
  },
  {
    id: 'KIWI-1232',
    merchant: 'Los Efes',
    driver: null,
    customer: 'Ana Rodríguez',
    status: 'pending',
    amount: 4500,
    fee: 450,
    createdAt: '2024-03-20T09:45:00',
    deliveredAt: null,
  },
  {
    id: 'KIWI-1231',
    merchant: 'Twentis',
    driver: 'Joel',
    customer: 'Carlos Mendoza',
    status: 'delivered',
    amount: 2800,
    fee: 280,
    createdAt: '2024-03-20T09:30:00',
    deliveredAt: '2024-03-20T10:00:00',
  },
  {
    id: 'KIWI-1230',
    merchant: 'Bowl & Café Luis Alfredo',
    driver: 'Juan Carlos',
    customer: 'Laura Jiménez',
    status: 'cancelled',
    amount: 3500,
    fee: 0,
    createdAt: '2024-03-20T09:15:00',
    deliveredAt: null,
  },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState(mockOrders);
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'in_transit' | 'delivered' | 'cancelled'
  >('all');
  const [search, setSearch] = useState('');

  const filteredOrders = orders.filter((order) => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch =
      order.id.toLowerCase().includes(search.toLowerCase()) ||
      order.merchant.toLowerCase().includes(search.toLowerCase()) ||
      order.customer.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'in_transit':
        return 'bg-blue-100 text-blue-700';
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-surface-100 text-surface-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'in_transit':
        return 'En tránsito';
      case 'delivered':
        return 'Entregado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const stats = {
    total: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + o.amount, 0),
    totalFees: orders.reduce((sum, o) => sum + o.fee, 0),
    pending: orders.filter((o) => o.status === 'pending').length,
    inTransit: orders.filter((o) => o.status === 'in_transit').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          Gestión de Pedidos
        </h1>
        <p className="text-surface-500 dark:text-surface-400">{orders.length} pedidos totales</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          className="rounded-xl glass p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm text-surface-500 dark:text-surface-400">Total Pedidos</p>
          <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">{stats.total}</p>
        </motion.div>
        <motion.div
          className="rounded-xl glass p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm text-surface-500 dark:text-surface-400">Ingresos</p>
          <p className="text-2xl font-bold text-kiwi-600 dark:text-kiwi-400">
            ₡{stats.totalRevenue.toLocaleString()}
          </p>
        </motion.div>
        <motion.div
          className="rounded-xl glass p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-sm text-surface-500 dark:text-surface-400">Comisión Plataforma</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ₡{stats.totalFees.toLocaleString()}
          </p>
        </motion.div>
        <motion.div
          className="rounded-xl glass p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-surface-500 dark:text-surface-400">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { value: 'all', label: 'Todos', count: stats.total },
            { value: 'pending', label: 'Pendientes', count: stats.pending },
            { value: 'in_transit', label: 'En tránsito', count: stats.inTransit },
            { value: 'delivered', label: 'Entregados', count: stats.delivered },
            { value: 'cancelled', label: 'Cancelados', count: stats.cancelled },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                filter === tab.value
                  ? 'bg-kiwi-500 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar por ID, comercio o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
        />
      </div>

      {/* Orders Table */}
      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  ID
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Comercio
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Cliente
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Repartidor
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Estado
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Monto
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Comisión
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Fecha
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, index) => (
                <motion.tr
                  key={order.id}
                  className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td className="py-4 px-6">
                    <span className="font-mono font-medium text-surface-800 dark:text-surface-200">
                      {order.id}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-surface-800 dark:text-surface-200">
                      {order.merchant}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-surface-800 dark:text-surface-200">
                      {order.customer}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`text-sm ${order.driver ? 'text-surface-800 dark:text-surface-200' : 'text-surface-400'}`}
                    >
                      {order.driver || 'Sin asignar'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-medium text-surface-800 dark:text-surface-200">
                      ₡{order.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-kiwi-600 dark:text-kiwi-400">
                      ₡{order.fee.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-surface-500 dark:text-surface-400">
                      {new Date(order.createdAt).toLocaleDateString('es-CR')}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-surface-400 hover:text-kiwi-500 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/30 rounded-lg transition-colors">
                        👁️
                      </button>
                      <button className="p-2 text-surface-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                        ClipboardList
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
