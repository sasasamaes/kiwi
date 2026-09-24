'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Smartphone, X } from 'lucide-react';
import { adminSyncMonitoring, type DeviceSyncInfo, type SyncStatus } from './admin-sync-monitor';

interface AdminSyncDashboardProps {
  className?: string;
  refreshInterval?: number;
}

export function AdminSyncDashboard({
  className = '',
  refreshInterval = 5000,
}: AdminSyncDashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [devices, setDevices] = useState<DeviceSyncInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSyncInfo | null>(null);
  const [filter, setFilter] = useState<'all' | 'merchant' | 'driver' | 'customer'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, filter]);

  const loadData = async () => {
    try {
      const dashboardStats = await adminSyncMonitoring.getDashboardStats();
      setStats(dashboardStats);

      const filterOptions = filter !== 'all' ? { userType: filter as any } : undefined;
      const allDevices = await adminSyncMonitoring.getDevices(filterOptions);
      setDevices(allDevices);
    } catch (error) {
      console.error('Failed to load sync data:', error);
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
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-surface-200 dark:bg-surface-700 rounded-2xl" />
            ))}
          </div>
          <div className="h-96 bg-surface-200 dark:bg-surface-700 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            BarChart3 Monitor de Sincronización
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Estado en tiempo real de todos los dispositivos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-3 h-3 bg-kiwi-500 rounded-full"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-sm text-surface-600 dark:text-surface-400">En vivo</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-xl">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                {stats.totalDevices}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Total dispositivos</p>
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
            <div className="w-10 h-10 bg-kiwi-100 dark:bg-kiwi-900/30 rounded-xl flex items-center justify-center text-xl">
              🟢
            </div>
            <div>
              <p className="text-2xl font-bold text-kiwi-700 dark:text-kiwi-400">
                {stats.activeDevices}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Activos</p>
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
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-xl">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {stats.totalPendingSync}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Pendientes sync</p>
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
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center text-xl">
              <X className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.errorDevices}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Con errores</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Sync Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
            Estado de Sincronización
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.bySyncStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: adminSyncMonitoring.getStatusColor(status as SyncStatus),
                    }}
                  />
                  <span className="text-sm text-surface-600 dark:text-surface-400 capitalize">
                    {status === 'synced'
                      ? 'Sincronizado'
                      : status === 'syncing'
                        ? 'Sincronizando'
                        : status === 'offline'
                          ? 'Sin conexión'
                          : status === 'error'
                            ? 'Error'
                            : 'Obsoleto'}
                  </span>
                </div>
                <span className="font-medium text-surface-800 dark:text-surface-200">
                  {count as number}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
            Por Tipo de Usuario
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.byUserType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {type === 'merchant' ? '🏪' : type === 'driver' ? 'bike' : 'user'}
                  </span>
                  <span className="text-sm text-surface-600 dark:text-surface-400 capitalize">
                    {type === 'merchant'
                      ? 'Comerciantes'
                      : type === 'driver'
                        ? 'Repartidores'
                        : 'Clientes'}
                  </span>
                </div>
                <span className="font-medium text-surface-800 dark:text-surface-200">
                  {count as number}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Device List */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <div className="p-4 border-b border-surface-100 dark:border-surface-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
              Dispositivos ({devices.length})
            </h3>
            <div className="flex gap-2">
              {(['all', 'merchant', 'driver', 'customer'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-kiwi-700 text-white'
                      : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                  }`}
                >
                  {f === 'all'
                    ? 'Todos'
                    : f === 'merchant'
                      ? '🏪 Comerciantes'
                      : f === 'driver'
                        ? 'Bike Repartidores'
                        : 'User Clientes'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-surface-100 dark:divide-surface-700 max-h-[500px] overflow-y-auto">
          {devices.map((device) => (
            <motion.div
              key={device.deviceId}
              className={`p-4 hover:bg-surface-50 dark:hover:bg-surface-900 cursor-pointer transition-colors ${
                selectedDevice?.deviceId === device.deviceId ? 'bg-kiwi-50 dark:bg-kiwi-900/30' : ''
              }`}
              onClick={() =>
                setSelectedDevice(selectedDevice?.deviceId === device.deviceId ? null : device)
              }
              whileHover={{ x: 2 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="text-2xl">
                      {device.userType === 'merchant'
                        ? '🏪'
                        : device.userType === 'driver'
                          ? 'bike'
                          : 'user'}
                    </span>
                    <div
                      className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-surface-800"
                      style={{
                        backgroundColor: adminSyncMonitoring.getStatusColor(device.syncStatus),
                      }}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-200">
                      {device.userName}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {device.platform.toUpperCase()} •{' '}
                      {adminSyncMonitoring.formatLastSeen(device.lastSeenAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {device.pendingSync > 0 && (
                    <span className="px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-medium">
                      {device.pendingSync} sync
                    </span>
                  )}
                  {device.pendingOrders > 0 && (
                    <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                      {device.pendingOrders} pedidos
                    </span>
                  )}
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: adminSyncMonitoring.getStatusColor(device.syncStatus),
                    }}
                  />
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {selectedDevice?.deviceId === device.deviceId && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-2 rounded-lg bg-surface-50 dark:bg-surface-900 text-center">
                        <p className="text-lg font-bold text-surface-800 dark:text-surface-100">
                          {device.pendingOrders}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          Pedidos pendientes
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-50 dark:bg-surface-900 text-center">
                        <p className="text-lg font-bold text-surface-800 dark:text-surface-100">
                          {device.pendingPayments}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          Pagos pendientes
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-50 dark:bg-surface-900 text-center">
                        <p className="text-lg font-bold text-surface-800 dark:text-surface-100">
                          {device.totalCached}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">En caché</p>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-50 dark:bg-surface-900 text-center">
                        <p className="text-lg font-bold text-surface-800 dark:text-surface-100">
                          {device.connectionType}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">Conexión</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
