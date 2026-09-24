'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Settings } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  pickupAddress: string;
  deliveryAddress: string;
  merchant?: { businessName: string };
  driver?: { fullName: string };
  items?: { name: string; quantity: number }[];
}

interface OrderSearchProps {
  orders: Order[];
  onFilterChange: (filtered: Order[]) => void;
  showMerchant?: boolean;
  showDriver?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos', icon: 'clipboard', color: 'bg-surface-100 text-surface-700' },
  { value: 'pending', label: 'Pendiente', icon: 'clock', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'assigned', label: 'Asignado', icon: 'check', color: 'bg-blue-100 text-blue-700' },
  {
    value: 'in_transit_to_pickup',
    label: 'En camino',
    icon: 'bike',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    value: 'picked_up',
    label: 'Recogido',
    icon: 'package',
    color: 'bg-indigo-100 text-indigo-700',
  },
  {
    value: 'in_transit_to_delivery',
    label: 'Entregando',
    icon: 'zap',
    color: 'bg-cyan-100 text-cyan-700',
  },
  { value: 'delivered', label: 'Entregado', icon: 'party', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelado', icon: 'close', color: 'bg-red-100 text-red-700' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Más reciente' },
  { value: 'oldest', label: 'Más antiguo' },
  { value: 'highest', label: 'Mayor monto' },
  { value: 'lowest', label: 'Menor monto' },
];

export function OrderSearch({
  orders,
  onFilterChange,
  showMerchant = true,
  showDriver = true,
}: OrderSearchProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Search filter
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (order) =>
          order.id.toLowerCase().includes(query) ||
          order.pickupAddress.toLowerCase().includes(query) ||
          order.deliveryAddress.toLowerCase().includes(query) ||
          order.merchant?.businessName?.toLowerCase().includes(query) ||
          order.driver?.fullName?.toLowerCase().includes(query) ||
          order.items?.some((item) => item.name.toLowerCase().includes(query)),
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((order) => order.status === statusFilter);
    }

    // Date range filter
    if (dateRange.start) {
      const start = new Date(dateRange.start);
      result = result.filter((order) => new Date(order.createdAt) >= start);
    }
    if (dateRange.end) {
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59);
      result = result.filter((order) => new Date(order.createdAt) <= end);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'highest':
        result.sort((a, b) => b.totalAmount - a.totalAmount);
        break;
      case 'lowest':
        result.sort((a, b) => a.totalAmount - b.totalAmount);
        break;
    }

    return result;
  }, [orders, search, statusFilter, sortBy, dateRange]);

  // Notify parent of filtered results
  useMemo(() => {
    onFilterChange(filteredOrders);
  }, [filteredOrders, onFilterChange]);

  const activeFilterCount = [
    statusFilter !== 'all',
    dateRange.start !== '',
    dateRange.end !== '',
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span className="text-surface-400">
            <Search className="h-4 w-4" />
          </span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por ID, dirección, comercio..."
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 focus:border-transparent transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-surface-400 hover:text-surface-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-surface-100 dark:bg-surface-800 rounded-lg text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        >
          <span>
            <Settings className="h-4 w-4" />
          </span>
          Filtros
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-kiwi-700 text-white text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-surface-500">
            {filteredOrders.length} de {orders.length} pedidos
          </span>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 space-y-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Estado
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setStatusFilter(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        statusFilter === option.value
                          ? `${option.color} ring-2 ring-offset-1 ring-kiwi-600`
                          : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Ordenar por
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-sm text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Rango de fechas
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-sm text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                  />
                  <span className="flex items-center text-surface-400">-</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-sm text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                  />
                </div>
              </div>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setDateRange({ start: '', end: '' });
                    setSearch('');
                  }}
                  className="text-sm text-kiwi-700 dark:text-kiwi-400 hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
