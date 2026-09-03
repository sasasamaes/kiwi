'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  AreaChartComponent, 
  PieChartComponent,
  StatCard 
} from '@kiwi/ui';

const mockPayments = [
  { id: 'PAY-001', orderId: 'KIWI-1234', merchant: 'Bowl & Café Luis Alfredo', driver: 'Juan Carlos', amount: 5700, fee: 570, driverPayout: 5130, method: 'sinpe', status: 'completed', createdAt: '2024-03-20T11:05:00' },
  { id: 'PAY-002', orderId: 'KIWI-1231', merchant: 'Twentis', driver: 'Joel', amount: 2800, fee: 280, driverPayout: 2520, method: 'card', status: 'completed', createdAt: '2024-03-20T10:00:00' },
  { id: 'PAY-003', orderId: 'KIWI-1230', merchant: 'Bowl & Café Luis Alfredo', driver: null, amount: 3500, fee: 350, driverPayout: 0, method: 'cash', status: 'refunded', createdAt: '2024-03-20T09:15:00' },
  { id: 'PAY-004', orderId: 'KIWI-1229', merchant: 'Punto Ácido', driver: 'Fran', amount: 4200, fee: 420, driverPayout: 3780, method: 'crypto', status: 'completed', createdAt: '2024-03-19T18:30:00' },
  { id: 'PAY-005', orderId: 'KIWI-1228', merchant: 'Los Efes', driver: 'Juan Carlos', amount: 6500, fee: 650, driverPayout: 5850, method: 'sinpe', status: 'completed', createdAt: '2024-03-19T17:45:00' },
];

const dailyRevenue = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return { date: date.toISOString().split('T')[0], value: Math.floor(Math.random() * 500000) + 100000 };
});

const paymentMethods = [
  { name: 'SINPE', value: 45 },
  { name: 'Tarjeta', value: 30 },
  { name: 'Efectivo', value: 20 },
  { name: 'Crypto', value: 5 },
];

export default function PaymentsPage() {
  const [payments, setPayments] = useState(mockPayments);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'refunded'>('all');

  const filteredPayments = payments.filter(p => 
    filter === 'all' || p.status === filter
  );

  const stats = {
    totalRevenue: payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0),
    totalFees: payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.fee, 0),
    totalPayouts: payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.driverPayout, 0),
    pendingPayouts: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.driverPayout, 0),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'refunded': return 'bg-red-100 text-red-700';
      default: return 'bg-surface-100 text-surface-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'pending': return 'Pendiente';
      case 'refunded': return 'Reembolsado';
      default: return status;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'sinpe': return 'Smartphone';
      case 'card': return 'CreditCard';
      case 'cash': return 'DollarSign';
      case 'crypto': return '₿';
      default: return 'Coins';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          Gestión de Pagos
        </h1>
        <p className="text-surface-500 dark:text-surface-400">
          Resumen de transacciones y pagos
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos Totales"
          value={`₡${stats.totalRevenue.toLocaleString()}`}
          icon="Coins"
          color="#22c55e"
        />
        <StatCard
          title="Comisiones"
          value={`₡${stats.totalFees.toLocaleString()}`}
          icon="🏦"
          color="#3b82f6"
        />
        <StatCard
          title="Pagos a Repartidores"
          value={`₡${stats.totalPayouts.toLocaleString()}`}
          icon="Bike"
          color="#8b5cf6"
        />
        <StatCard
          title="Pagos Pendientes"
          value={`₡${stats.pendingPayouts.toLocaleString()}`}
          icon="Clock"
          color="#f59e0b"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          className="lg:col-span-2 rounded-2xl glass p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            Ingresos Diarios
          </h3>
          <AreaChartComponent data={dailyRevenue} height={250} />
        </motion.div>

        <motion.div
          className="rounded-2xl glass p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            Metodos de Pago
          </h3>
          <PieChartComponent data={paymentMethods} height={200} />
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'Todos' },
          { value: 'completed', label: 'Completados' },
          { value: 'pending', label: 'Pendientes' },
          { value: 'refunded', label: 'Reembolsados' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value as any)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === tab.value
                ? 'bg-kiwi-500 text-white'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Payments Table */}
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
                  Pedido
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Comercio
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Método
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Monto
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Comisión
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Pago Repartidor
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Estado
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment, index) => (
                <motion.tr
                  key={payment.id}
                  className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td className="py-4 px-6">
                    <span className="font-mono text-sm text-surface-800 dark:text-surface-200">
                      {payment.id}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-mono text-sm text-surface-800 dark:text-surface-200">
                      {payment.orderId}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-surface-800 dark:text-surface-200">{payment.merchant}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="flex items-center gap-2">
                      <span>{getMethodIcon(payment.method)}</span>
                      <span className="text-sm text-surface-800 dark:text-surface-200 capitalize">
                        {payment.method}
                      </span>
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-medium text-surface-800 dark:text-surface-200">
                      ₡{payment.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-kiwi-600 dark:text-kiwi-400">
                      ₡{payment.fee.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      {payment.driver ? `₡${payment.driverPayout.toLocaleString()}` : '-'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                      {getStatusLabel(payment.status)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-surface-500 dark:text-surface-400">
                      {new Date(payment.createdAt).toLocaleDateString('es-CR')}
                    </span>
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
