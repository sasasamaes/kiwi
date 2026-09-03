'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConflictResolution, type Conflict, type MergeAction } from './useConflictResolution';

interface ConflictResolverProps {
  className?: string;
  /** Show only pending conflicts */
  pendingOnly?: boolean;
  /** Callback when all conflicts resolved */
  onAllResolved?: () => void;
}

interface ConflictCardProps {
  conflict: Conflict;
  onResolve: (conflictId: string, action: MergeAction) => void;
  onDismiss: (conflictId: string) => void;
}

function ConflictCard({ conflict, onResolve, onDismiss }: ConflictCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMergeOptions, setShowMergeOptions] = useState(false);

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'order': return 'package';
      case 'menu': return 'utensils';
      case 'profile': return 'user';
      case 'location': return 'location';
      default: return '📄';
    }
  };

  const getDataTypeLabel = (type: string) => {
    switch (type) {
      case 'order': return 'Pedido';
      case 'menu': return 'Menú';
      case 'profile': return 'Perfil';
      case 'location': return 'Ubicación';
      default: return 'Datos';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('es-CR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      className="bg-white dark:bg-surface-800 rounded-2xl shadow-soft dark:shadow-dark overflow-hidden border border-orange-200 dark:border-orange-800"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      {/* Header */}
      <div className="p-4 bg-orange-50 dark:bg-orange-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getDataTypeIcon(conflict.dataType)}</span>
            <div>
              <h3 className="font-semibold text-surface-800 dark:text-surface-100">
                Conflicto en {getDataTypeLabel(conflict.dataType)}
              </h3>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                {conflict.dataId}
              </p>
            </div>
          </div>
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            whileTap={{ scale: 0.9 }}
          >
            <motion.span
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="block"
            >
              ▼
            </motion.span>
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Conflict Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30">
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Local</p>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
              v{conflict.local.version}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {formatDate(conflict.local.lastModified)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30">
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Remoto</p>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
              v{conflict.remote.version}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {formatDate(conflict.remote.lastModified)}
            </p>
          </div>
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Data Comparison */}
              <div className="space-y-3 mb-4">
                <h4 className="text-sm font-semibold text-surface-600 dark:text-surface-400">
                  Comparación de datos
                </h4>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-surface-50 dark:bg-surface-900">
                    <p className="font-medium text-surface-600 dark:text-surface-400">Local</p>
                    <pre className="mt-1 text-surface-800 dark:text-surface-200 whitespace-pre-wrap">
                      {JSON.stringify(conflict.local.data, null, 2)}
                    </pre>
                  </div>
                  <div className="p-2 rounded bg-surface-50 dark:bg-surface-900">
                    <p className="font-medium text-surface-600 dark:text-surface-400">Remoto</p>
                    <pre className="mt-1 text-surface-800 dark:text-surface-200 whitespace-pre-wrap">
                      {JSON.stringify(conflict.remote.data, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Auto-merge available */}
              {conflict.autoMergeResult && (
                <div className="p-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">Sparkles</span>
                    <p className="font-medium text-kiwi-700 dark:text-kiwi-400">
                      Auto-merge disponible
                    </p>
                  </div>
                  <p className="text-sm text-kiwi-600 dark:text-kiwi-400">
                    Los cambios no se superponen y pueden combinarse automáticamente.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="space-y-2">
          {!showMergeOptions ? (
            <div className="flex gap-2">
              <motion.button
                onClick={() => onResolve(conflict.id, 'keep-local')}
                className="flex-1 py-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium text-sm"
                whileTap={{ scale: 0.95 }}
              >
                Smartphone Usar Local
              </motion.button>
              <motion.button
                onClick={() => onResolve(conflict.id, 'keep-remote')}
                className="flex-1 py-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium text-sm"
                whileTap={{ scale: 0.95 }}
              >
                ☁️ Usar Remoto
              </motion.button>
              <motion.button
                onClick={() => setShowMergeOptions(true)}
                className="flex-1 py-2 rounded-xl bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-400 font-medium text-sm"
                whileTap={{ scale: 0.95 }}
              >
                🔀 Combinar
              </motion.button>
            </div>
          ) : (
            <div className="space-y-2">
              {conflict.autoMergeResult && (
                <motion.button
                  onClick={() => onResolve(conflict.id, 'merge')}
                  className="w-full py-2 rounded-xl bg-kiwi-500 text-white font-medium"
                  whileTap={{ scale: 0.95 }}
                >
                  Sparkles Auto-combinar
                </motion.button>
              )}
              <motion.button
                onClick={() => setShowMergeOptions(false)}
                className="w-full py-2 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 font-medium"
                whileTap={{ scale: 0.95 }}
              >
                ← Volver
              </motion.button>
            </div>
          )}

          <motion.button
            onClick={() => onDismiss(conflict.id)}
            className="w-full py-2 rounded-xl text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 font-medium text-sm"
            whileTap={{ scale: 0.95 }}
          >
            Descartar
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export function ConflictResolver({
  className = '',
  pendingOnly = true,
  onAllResolved,
}: ConflictResolverProps) {
  const { 
    conflicts, 
    pendingCount, 
    stats, 
    resolveConflict, 
    dismissConflict, 
    clearResolved,
    clearAll,
  } = useConflictResolution();

  const displayConflicts = pendingOnly 
    ? conflicts.filter(c => c.status === 'pending')
    : conflicts;

  const handleResolve = (conflictId: string, action: MergeAction) => {
    resolveConflict(conflictId, action);
    
    // Check if all conflicts resolved
    if (pendingCount <= 1) {
      onAllResolved?.();
    }
  };

  const handleDismiss = (conflictId: string) => {
    dismissConflict(conflictId);
    
    if (pendingCount <= 1) {
      onAllResolved?.();
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">AlertTriangle</span>
          <div>
            <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
              Conflictos
            </h2>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {stats.resolved > 0 && (
            <motion.button
              onClick={clearResolved}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
              whileTap={{ scale: 0.95 }}
            >
              🧹 Limpiar ({stats.resolved})
            </motion.button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-center">
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
              {stats.pending}
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-400">Pendientes</p>
          </div>
          <div className="p-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 text-center">
            <p className="text-xl font-bold text-kiwi-600 dark:text-kiwi-400">
              {stats.resolved}
            </p>
            <p className="text-xs text-kiwi-700 dark:text-kiwi-400">Resueltos</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-center">
            <p className="text-xl font-bold text-surface-600 dark:text-surface-400">
              {stats.dismissed}
            </p>
            <p className="text-xs text-surface-700 dark:text-surface-400">Descartados</p>
          </div>
        </div>
      )}

      {/* Conflict List */}
      {displayConflicts.length === 0 ? (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="text-5xl mb-4"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Check
          </motion.div>
          <h3 className="text-lg font-semibold text-surface-800 dark:text-surface-100 mb-2">
            {pendingOnly ? 'Sin conflictos pendientes' : 'Sin conflictos'}
          </h3>
          <p className="text-surface-500 dark:text-surface-400">
            {pendingOnly 
              ? 'Todos los conflictos han sido resueltos'
              : 'No hay conflictos registrados'
            }
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {displayConflicts.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={handleResolve}
                onDismiss={handleDismiss}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/**
 * Compact conflict indicator
 */
export function ConflictIndicator({ className = '' }: { className?: string }) {
  const { pendingCount } = useConflictResolution();

  if (pendingCount === 0) {
    return null;
  }

  return (
    <motion.div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 text-xs font-medium ${className}`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500 }}
    >
      <span>AlertTriangle</span>
      <span>{pendingCount}</span>
    </motion.div>
  );
}

/**
 * Conflict resolution banner
 */
export function ConflictBanner({ className = '' }: { className?: string }) {
  const { pendingCount, hasPendingConflicts } = useConflictResolution();

  if (!hasPendingConflicts) {
    return null;
  }

  return (
    <motion.div
      className={`bg-orange-500 text-white px-4 py-3 ${className}`}
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">AlertTriangle</span>
          <div>
            <p className="font-semibold">
              {pendingCount} conflicto{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
            </p>
            <p className="text-sm opacity-90">
              Se detectaron cambios simultáneos que requieren tu atención
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
