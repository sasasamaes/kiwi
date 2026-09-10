'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { compression, type StorageStats } from './compression';
import { offlineCache, type CacheStats } from './offline-cache';
import { backgroundSync, type SyncQueueStats } from './background-sync';
import { offlineOrders } from './offline-orders';
import { AlertTriangle, ClipboardList, Package, RefreshCw } from 'lucide-react';

interface StorageManagerProps {
  className?: string;
  showDetails?: boolean;
}

interface StorageBreakdown {
  cache: CacheStats;
  syncQueue: SyncQueueStats;
  orders: { total: number; synced: number; unsynced: number };
  storage: StorageStats;
}

export function StorageManager({ className = '', showDetails = false }: StorageManagerProps) {
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    setIsLoading(true);
    try {
      const [cacheStats, syncStats, orderStats, storageStats] = await Promise.all([
        offlineCache.getStats(),
        backgroundSync.getStats(),
        offlineOrders.getStats(),
        compression.getStorageEstimate(),
      ]);

      const orders = await offlineOrders.getOrders();
      const synced = orders.filter((o) => o.syncStatus === 'synced').length;
      const unsynced = orders.filter((o) => o.syncStatus !== 'synced').length;

      setBreakdown({
        cache: cacheStats,
        syncQueue: syncStats,
        orders: { total: orderStats.total, synced, unsynced },
        storage: storageStats,
      });
    } catch (error) {
      console.error('Failed to load storage info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    await offlineCache.clear();
    await loadStorageInfo();
  };

  const handleClearSyncQueue = async () => {
    await backgroundSync.clearCompleted();
    await loadStorageInfo();
  };

  const handleClearOrders = async () => {
    await offlineOrders.clearAll();
    await loadStorageInfo();
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-24 bg-surface-200 dark:bg-surface-700 rounded-2xl" />
      </div>
    );
  }

  if (!breakdown) {
    return null;
  }

  const storagePercentage = breakdown.storage.percentage;

  return (
    <div className={`relative ${className}`}>
      {/* Storage Overview Card */}
      <motion.button
        onClick={() => setShowPanel(!showPanel)}
        className="w-full p-4 rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark text-left"
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-surface-800 dark:text-surface-100">
            💾 Almacenamiento
          </h3>
          <div className="flex items-center gap-2">
            {breakdown.storage.isCritical && (
              <AlertTriangle className="text-red-500 animate-pulse h-5 w-5" />
            )}
            <span className="text-sm font-medium text-surface-600 dark:text-surface-400">
              {compression.formatBytes(breakdown.storage.used)}
            </span>
          </div>
        </div>

        {/* Storage Bar */}
        <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden mb-2">
          <motion.div
            className={`h-full rounded-full ${
              storagePercentage > 90
                ? 'bg-red-500'
                : storagePercentage > 70
                  ? 'bg-orange-500'
                  : 'bg-kiwi-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(storagePercentage, 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>

        <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400">
          <span>{storagePercentage.toFixed(1)}% usado</span>
          <span>{compression.formatBytes(breakdown.storage.available)}</span>
        </div>

        <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">
          {breakdown.storage.message}
        </p>
      </motion.button>

      {/* Details Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowPanel(false)}
            />

            {/* Panel */}
            <motion.div
              className="relative w-full max-w-md max-h-[80vh] overflow-y-auto bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Handle */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1 bg-surface-300 dark:bg-surface-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                  💾 Gestión de Almacenamiento
                </h3>
                <motion.button
                  className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                  onClick={() => setShowPanel(false)}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Storage Overview */}
              <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Uso total</span>
                  <span className="font-bold text-surface-800 dark:text-surface-200">
                    {compression.formatBytes(breakdown.storage.used)}
                  </span>
                </div>
                <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      storagePercentage > 90
                        ? 'bg-red-500'
                        : storagePercentage > 70
                          ? 'bg-orange-500'
                          : 'bg-kiwi-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(storagePercentage, 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
                  <span>{storagePercentage.toFixed(1)}%</span>
                  <span>{compression.formatBytes(breakdown.storage.available)} disponible</span>
                </div>
              </div>

              {/* Storage Breakdown */}
              <div className="space-y-4 mb-6">
                <h4 className="text-sm font-semibold text-surface-600 dark:text-surface-400">
                  Desglose por categoría
                </h4>

                {/* Cache */}
                <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="text-lg h-5 w-5" />
                      <div>
                        <p className="font-medium text-surface-800 dark:text-surface-200">
                          Caché de tráfico
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {breakdown.cache.totalEntries} entradas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        {compression.formatBytes(breakdown.cache.totalSize)}
                      </p>
                      <button
                        onClick={handleClearCache}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sync Queue */}
                <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="text-lg h-5 w-5" />
                      <div>
                        <p className="font-medium text-surface-800 dark:text-surface-200">
                          Cola de sincronización
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {breakdown.syncQueue.pending} pendientes
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        {breakdown.syncQueue.total} acciones
                      </p>
                      {breakdown.syncQueue.completed > 0 && (
                        <button
                          onClick={handleClearSyncQueue}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Limpiar completadas
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Orders */}
                <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="text-lg h-5 w-5" />
                      <div>
                        <p className="font-medium text-surface-800 dark:text-surface-200">
                          Pedidos offline
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {breakdown.orders.unsynced} sin sincronizar
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        {breakdown.orders.total} pedidos
                      </p>
                      {breakdown.orders.total > 0 && (
                        <button
                          onClick={handleClearOrders}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Limpiar todos
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Compression Stats */}
              <div className="p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800 mb-6">
                <h4 className="text-sm font-semibold text-kiwi-700 dark:text-kiwi-400 mb-2">
                  🗜️ Compresión de datos
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-kiwi-600 dark:text-kiwi-400">Datos comprimidos</span>
                    <span className="font-medium text-kiwi-800 dark:text-kiwi-300">
                      {compression.formatBytes(compression.getStats().totalSaved)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-kiwi-600 dark:text-kiwi-400">Ahorro promedio</span>
                    <span className="font-medium text-kiwi-800 dark:text-kiwi-300">
                      {Math.round((1 - compression.getStats().averageRatio) * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-kiwi-600 dark:text-kiwi-400">Operaciones</span>
                    <span className="font-medium text-kiwi-800 dark:text-kiwi-300">
                      {compression.getStats().compressionCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <motion.button
                  className="w-full py-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-medium"
                  onClick={async () => {
                    await handleClearCache();
                    await handleClearSyncQueue();
                    await handleClearOrders();
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  🧹 Limpiar Todo
                </motion.button>

                <motion.button
                  className="w-full py-3 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 font-medium"
                  onClick={loadStorageInfo}
                  whileTap={{ scale: 0.95 }}
                >
                  RefreshCw Actualizar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Storage warning banner
 */
export function StorageWarning({ className = '' }: { className?: string }) {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      const storageStats = await compression.getStorageEstimate();
      setStats(storageStats);
    };

    loadStats();
    const interval = setInterval(loadStats, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  if (!stats || dismissed || !stats.isLow) {
    return null;
  }

  return (
    <motion.div
      className={`px-4 py-3 ${
        stats.isCritical ? 'bg-red-500' : 'bg-orange-500'
      } text-white ${className}`}
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">💾</span>
          <div>
            <p className="font-semibold">
              {stats.isCritical ? 'Almacenamiento crítico' : 'Almacenamiento bajo'}
            </p>
            <p className="text-sm opacity-90">
              {compression.formatBytes(stats.used)} de {compression.formatBytes(stats.available)}{' '}
              usado
            </p>
          </div>
        </div>
        <motion.button
          className="text-white/80 hover:text-white"
          onClick={() => setDismissed(true)}
          whileTap={{ scale: 0.9 }}
        >
          ✕
        </motion.button>
      </div>
    </motion.div>
  );
}

/**
 * Compact storage indicator
 */
export function StorageIndicatorCompact({ className = '' }: { className?: string }) {
  const [stats, setStats] = useState<StorageStats | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      const storageStats = await compression.getStorageEstimate();
      setStats(storageStats);
    };

    loadStats();
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!stats || !stats.isLow) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
        stats.isCritical
          ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
          : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400'
      } ${className}`}
    >
      <span>💾</span>
      <span>{stats.percentage.toFixed(0)}%</span>
    </div>
  );
}
