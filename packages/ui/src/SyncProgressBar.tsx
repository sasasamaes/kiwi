// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useSyncProgress, type SyncProgressItem } from './useSyncProgress';

interface SyncProgressBarProps {
  className?: string;
  /** Show detailed view */
  showDetails?: boolean;
  /** Show individual items */
  showItems?: boolean;
  /** Auto-hide when complete */
  autoHide?: boolean;
  /** Delay before auto-hide (ms) */
  autoHideDelay?: number;
  /** Position */
  position?: 'top' | 'bottom' | 'inline';
}

interface SyncItemProps {
  item: SyncProgressItem;
  onCancel?: (id: string) => void;
}

function SyncItem({ item, onCancel }: SyncItemProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'syncing':
        return 'refresh';
      case 'completed':
        return 'Check';
      case 'failed':
        return 'close';
      case 'paused':
        return '⏸️';
      default:
        return 'clock';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'syncing':
        return 'text-blue-600 dark:text-blue-400';
      case 'completed':
        return 'text-kiwi-700 dark:text-kiwi-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      case 'paused':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-surface-500 dark:text-surface-400';
    }
  };

  return (
    <motion.div
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-900"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      layout
    >
      {/* Status Icon */}
      <span className="text-lg">{getStatusIcon(item.status)}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
            {item.name}
          </span>
          <span className={`text-xs font-medium ${getStatusColor(item.status)}`}>
            {Math.round(item.progress)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden mb-1">
          <motion.div
            className={`h-full rounded-full ${
              item.status === 'completed'
                ? 'bg-kiwi-500'
                : item.status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-blue-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${item.progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Details */}
        <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
          <span>
            {item.operation === 'upload' ? '⬆️' : item.operation === 'download' ? '⬇️' : 'refresh'}{' '}
            {item.speed > 0 && `${(item.speed / 1024).toFixed(1)} KB/s`}
          </span>
          <span>
            {item.estimatedRemaining > 0 && `~${Math.round(item.estimatedRemaining / 1000)}s`}
          </span>
        </div>
      </div>

      {/* Cancel Button */}
      {item.status === 'syncing' && onCancel && (
        <motion.button
          onClick={() => onCancel(item.id)}
          className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
          whileTap={{ scale: 0.9 }}
        >
          ✕
        </motion.button>
      )}
    </motion.div>
  );
}

export function SyncProgressBar({
  className = '',
  showDetails = false,
  showItems = false,
  autoHide = true,
  autoHideDelay = 3000,
  position = 'top',
}: SyncProgressBarProps) {
  const {
    state,
    isSyncing,
    overallProgress,
    activeCount,
    completedCount,
    failedCount,
    totalCount,
    speed,
    estimatedTime,
    formattedProgress,
    formattedTransferred,
    formattedTotal,
    cancelSync,
    reset,
  } = useSyncProgress();

  const [isHidden, setIsHidden] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-hide when complete
  useEffect(() => {
    if (!isSyncing && state.status === 'completed' && autoHide) {
      const timer = setTimeout(() => {
        setIsHidden(true);
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [isSyncing, state.status, autoHide, autoHideDelay]);

  // Reset hidden state when new sync starts
  useEffect(() => {
    if (isSyncing) {
      setIsHidden(false);
    }
  }, [isSyncing]);

  // Don't show if hidden or idle
  if (isHidden || (!isSyncing && state.status === 'idle')) {
    return null;
  }

  const positionClasses = {
    top: 'fixed top-0 left-0 right-0 z-50',
    bottom: 'fixed bottom-0 left-0 right-0 z-50',
    inline: '',
  };

  return (
    <motion.div
      className={`${positionClasses[position]} bg-white dark:bg-surface-800 shadow-lg ${className}`}
      initial={{ y: position === 'top' ? -100 : 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: position === 'top' ? -100 : 100, opacity: 0 }}
    >
      {/* Main Progress Bar */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <motion.div
                className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <Check className="text-lg h-5 w-5" />
            )}
            <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
              {isSyncing ? 'Sincronizando...' : 'Sincronización completa'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {showDetails && isSyncing && (
              <span className="text-xs text-surface-500 dark:text-surface-400">
                {speed} • {estimatedTime}
              </span>
            )}

            <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
              {formattedProgress}
            </span>

            {showItems && (
              <motion.button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                whileTap={{ scale: 0.9 }}
              >
                <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} className="block">
                  ▼
                </motion.span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              state.status === 'completed'
                ? 'bg-kiwi-500'
                : state.status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-blue-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Stats */}
        {showDetails && (
          <div className="flex items-center justify-between mt-2 text-xs text-surface-500 dark:text-surface-400">
            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  {activeCount} activo{activeCount !== 1 ? 's' : ''}
                </span>
              )}
              {completedCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-kiwi-500 rounded-full" />
                  {completedCount} completado{completedCount !== 1 ? 's' : ''}
                </span>
              )}
              {failedCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                  {failedCount} fallido{failedCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <span>
              {formattedTransferred} / {formattedTotal}
            </span>
          </div>
        )}
      </div>

      {/* Expanded Items List */}
      <AnimatePresence>
        {isExpanded && showItems && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-surface-100 dark:border-surface-700"
          >
            <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
              <AnimatePresence>
                {Array.from(state.items.values()).map((item) => (
                  <SyncItem key={item.id} item={item} onCancel={cancelSync} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Compact sync indicator for headers
 */
export function SyncIndicator({ className = '' }: { className?: string }) {
  const { isSyncing, overallProgress, formattedProgress, activeCount } = useSyncProgress();

  if (!isSyncing) {
    return null;
  }

  return (
    <motion.div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <span className="text-sm font-medium">{formattedProgress}</span>
      {activeCount > 1 && <span className="text-xs">({activeCount})</span>}
    </motion.div>
  );
}

/**
 * Sync progress toast notification
 */
export function SyncToast({ className = '' }: { className?: string }) {
  const { isSyncing, completedCount, failedCount, overallProgress, formattedProgress } =
    useSyncProgress();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (isSyncing) {
      setToastMessage(`Sincronizando... ${formattedProgress}`);
      setShowToast(true);
    } else if (completedCount > 0) {
      setToastMessage(`Check ${completedCount} elementos sincronizados`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } else if (failedCount > 0) {
      setToastMessage(`X ${failedCount} elementos fallidos`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  }, [isSyncing, completedCount, failedCount, formattedProgress]);

  if (!showToast) {
    return null;
  }

  return (
    <motion.div
      className={`fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-surface-800 text-white px-4 py-3 rounded-xl shadow-lg z-50 ${className}`}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
    >
      <div className="flex items-center gap-3">
        {isSyncing ? (
          <motion.div
            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        ) : (
          <span className="text-lg">{failedCount > 0 ? 'close' : 'Check'}</span>
        )}
        <span className="text-sm">{toastMessage}</span>
      </div>
    </motion.div>
  );
}

/**
 * Full sync status page
 */
export function SyncStatusPage({ className = '' }: { className?: string }) {
  const {
    state,
    isSyncing,
    overallProgress,
    activeCount,
    completedCount,
    failedCount,
    totalCount,
    speed,
    estimatedTime,
    formattedProgress,
    formattedTransferred,
    formattedTotal,
    getItems,
    reset,
  } = useSyncProgress();

  const items = getItems();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            RefreshCw Estado de Sincronización
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {isSyncing ? 'Sincronizando datos...' : 'Todo sincronizado'}
          </p>
        </div>
        <motion.button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 font-medium"
          whileTap={{ scale: 0.95 }}
        >
          RefreshCw Actualizar
        </motion.button>
      </div>

      {/* Overall Progress */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-100">
            Progreso General
          </h2>
          <span className="text-2xl font-bold text-kiwi-700 dark:text-kiwi-400">
            {formattedProgress}
          </span>
        </div>

        <div className="h-4 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden mb-4">
          <motion.div
            className={`h-full rounded-full ${
              state.status === 'completed'
                ? 'bg-kiwi-500'
                : state.status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-blue-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
            <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
              {totalCount}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">Total</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activeCount}</p>
            <p className="text-xs text-blue-700 dark:text-blue-400">Activos</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30">
            <p className="text-2xl font-bold text-kiwi-700 dark:text-kiwi-400">{completedCount}</p>
            <p className="text-xs text-kiwi-700 dark:text-kiwi-400">Completados</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-900/30">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{failedCount}</p>
            <p className="text-xs text-red-700 dark:text-red-400">Fallidos</p>
          </div>
        </div>

        {isSyncing && (
          <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-700">
            <div className="flex items-center justify-between text-sm text-surface-600 dark:text-surface-400">
              <span>Velocidad: {speed}</span>
              <span>Tiempo restante: {estimatedTime}</span>
            </div>
          </div>
        )}
      </div>

      {/* Items List */}
      {items.length > 0 && (
        <div className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-100 mb-4">
            Elementos ({items.length})
          </h2>
          <div className="space-y-3">
            <AnimatePresence>
              {items.map((item) => (
                <SyncItem key={item.id} item={item} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
