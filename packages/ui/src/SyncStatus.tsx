'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackgroundSync, type SyncQueueStats, type SyncAction } from './useBackgroundSync';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';

interface SyncStatusProps {
  className?: string;
  showDetails?: boolean;
}

export function SyncStatus({ className = '', showDetails = false }: SyncStatusProps) {
  const { stats, isSyncing, isOnline, processQueue, clearCompleted } = useBackgroundSync();
  const [showPanel, setShowPanel] = useState(false);

  // Don't show if no pending items and online
  if (!stats || (stats.pending === 0 && stats.syncing === 0 && isOnline)) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Sync Badge */}
      <motion.button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors ${
          isSyncing
            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
            : stats.pending > 0
              ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
        }`}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {isSyncing ? (
          <>
            <motion.span
              className="text-lg"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="h-4 w-4" />
            </motion.span>
            <span className="text-sm">Sincronizando...</span>
          </>
        ) : stats.pending > 0 ? (
          <>
            <motion.span
              className="text-lg"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Clock className="h-4 w-4" />
            </motion.span>
            <span className="text-sm">
              {stats.pending} pendiente{stats.pending !== 1 ? 's' : ''}
            </span>
          </>
        ) : null}
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
              className="relative w-full max-w-md bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6"
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
                  RefreshCw Cola de Sincronización
                </h3>
                <motion.button
                  className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                  onClick={() => setShowPanel(false)}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Status Overview */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {stats.pending}
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-400">Pendientes</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.syncing}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">Sincronizando</p>
                </div>
                <div className="p-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 text-center">
                  <p className="text-2xl font-bold text-kiwi-600 dark:text-kiwi-400">
                    {stats.completed}
                  </p>
                  <p className="text-xs text-kiwi-700 dark:text-kiwi-400">Completados</p>
                </div>
              </div>

              {/* Failed Actions */}
              {stats.failed > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-2xl h-6 w-6" />
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">
                        {stats.failed} acciones fallidas
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Se reintentarán automáticamente
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions by Type */}
              {Object.keys(stats.byType).length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                    Por Tipo
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(stats.byType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="text-surface-600 dark:text-surface-400 capitalize">
                          {type}
                        </span>
                        <span className="font-medium text-surface-800 dark:text-surface-200">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority Breakdown */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                  Por Prioridad
                </h4>
                <div className="space-y-2">
                  {[
                    { priority: 'critical', label: 'Crítica', color: 'bg-red-500' },
                    { priority: 'high', label: 'Alta', color: 'bg-orange-500' },
                    { priority: 'normal', label: 'Normal', color: 'bg-blue-500' },
                    { priority: 'low', label: 'Baja', color: 'bg-surface-400' },
                  ].map(({ priority, label, color }) => (
                    <div key={priority} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color}`} />
                        <span className="text-surface-600 dark:text-surface-400">{label}</span>
                      </div>
                      <span className="font-medium text-surface-800 dark:text-surface-200">
                        {stats.byPriority[priority as keyof typeof stats.byPriority]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                {!isOnline && (
                  <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-center">
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                      WifiOff Sin conexión - Las acciones se sincronizarán cuando vuelva la conexión
                    </p>
                  </div>
                )}

                {stats.pending > 0 && isOnline && (
                  <motion.button
                    className="w-full py-3 rounded-xl bg-kiwi-500 hover:bg-kiwi-600 text-white font-medium"
                    onClick={() => {
                      processQueue();
                      setShowPanel(false);
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    RefreshCw Sincronizar Ahora
                  </motion.button>
                )}

                {stats.completed > 0 && (
                  <motion.button
                    className="w-full py-3 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 font-medium"
                    onClick={() => {
                      clearCompleted();
                      setShowPanel(false);
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    🧹 Limpiar Completados
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact sync indicator for headers
 */
export function SyncIndicatorCompact({ className = '' }: { className?: string }) {
  const { stats, isSyncing } = useBackgroundSync();

  if (!stats || (stats.pending === 0 && stats.syncing === 0)) {
    return null;
  }

  return (
    <motion.div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
        isSyncing
          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
          : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400'
      } ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {isSyncing ? (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw className="h-4 w-4" />
        </motion.span>
      ) : (
        <Clock className="h-4 w-4" />
      )}
      <span>{stats.pending + stats.syncing}</span>
    </motion.div>
  );
}

/**
 * Banner that shows when there are pending syncs
 */
export function SyncBanner({ className = '' }: { className?: string }) {
  const { stats, isSyncing, isOnline, processQueue } = useBackgroundSync();
  const [dismissed, setDismissed] = useState(false);

  if (!stats || dismissed || (stats.pending === 0 && stats.syncing === 0)) {
    return null;
  }

  return (
    <motion.div
      className={`bg-blue-500 text-white px-4 py-3 ${className}`}
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSyncing ? (
            <motion.span
              className="text-xl"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="text-xl h-5 w-5" />
            </motion.span>
          ) : (
            <Clock className="text-xl h-5 w-5" />
          )}
          <div>
            <p className="font-semibold">
              {isSyncing
                ? 'Sincronizando datos...'
                : `${stats.pending} acciones pendientes de sincronizar`}
            </p>
            <p className="text-sm opacity-90">
              {isOnline
                ? 'Se sincronizarán automáticamente'
                : 'Se sincronizarán cuando vuelva la conexión'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isSyncing && isOnline && stats.pending > 0 && (
            <motion.button
              className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium"
              onClick={() => {
                processQueue();
                setDismissed(true);
              }}
              whileTap={{ scale: 0.95 }}
            >
              Sincronizar
            </motion.button>
          )}
          <motion.button
            className="text-white/80 hover:text-white"
            onClick={() => setDismissed(true)}
            whileTap={{ scale: 0.9 }}
          >
            ✕
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Sync status for a specific action type
 */
export function SyncActionStatus({ type, className = '' }: { type: string; className?: string }) {
  const { getAllActions } = useBackgroundSync();
  const [actions, setActions] = useState<SyncAction[]>([]);

  useEffect(() => {
    const loadActions = async () => {
      const allActions = await getAllActions();
      setActions(allActions.filter((a) => a.type.startsWith(type)));
    };

    loadActions();
    const interval = setInterval(loadActions, 5000);
    return () => clearInterval(interval);
  }, [type, getAllActions]);

  const pending = actions.filter((a) => a.status === 'pending').length;
  const syncing = actions.filter((a) => a.status === 'syncing').length;

  if (pending === 0 && syncing === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {syncing > 0 && (
        <motion.span
          className="text-blue-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw className="h-4 w-4" />
        </motion.span>
      )}
      <span className="text-surface-600 dark:text-surface-400">
        {pending + syncing} {type} pendiente{pending + syncing !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
