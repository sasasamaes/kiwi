'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useCacheWarmingProgress, type WarmTask } from './useCacheWarming';

interface StartupProgressProps {
  className?: string;
  /** Show detailed task list */
  showDetails?: boolean;
  /** Auto-hide when complete */
  autoHide?: boolean;
  /** Delay before auto-hide (ms) */
  autoHideDelay?: number;
  /** Callback when complete */
  onComplete?: () => void;
}

export function StartupProgress({
  className = '',
  showDetails = false,
  autoHide = true,
  autoHideDelay = 2000,
  onComplete,
}: StartupProgressProps) {
  const {
    progress,
    isWarming,
    isComplete,
    elapsedTime,
    estimatedRemaining,
    statusMessage,
    progressMessage,
    progressPercent,
  } = useCacheWarmingProgress();

  const [isHidden, setIsHidden] = useState(false);

  // Auto-hide when complete
  useEffect(() => {
    if (isComplete && autoHide) {
      const timer = setTimeout(() => {
        setIsHidden(true);
        onComplete?.();
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [isComplete, autoHide, autoHideDelay, onComplete]);

  // Don't show if hidden or idle with no tasks
  if (isHidden || (!isWarming && !isComplete && progress.total === 0)) {
    return null;
  }

  return (
    <motion.div
      className={`glass rounded-2xl overflow-hidden ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isWarming ? (
              <motion.div
                className="text-2xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                RefreshCw
              </motion.div>
            ) : isComplete ? (
              <motion.div
                className="text-2xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500 }}
              >
                Check
              </motion.div>
            ) : (
              <span className="text-2xl"></span>
            )}
            <div>
              <h3 className="font-display font-bold text-surface-800 dark:text-surface-100">
                {statusMessage}
              </h3>
              <p className="text-sm text-surface-500 dark:text-surface-400">{progressMessage}</p>
            </div>
          </div>

          {isWarming && (
            <div className="text-right">
              <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                {Math.round(progressPercent)}%
              </p>
              {estimatedRemaining > 0 && (
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  ~{Math.round(estimatedRemaining / 1000)}s restantes
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-4">
        <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden mb-4">
          <motion.div
            className={`h-full rounded-full ${isComplete ? 'bg-kiwi-500' : 'bg-blue-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        {/* Task Stats */}
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-4">
            {progress.completed > 0 && (
              <span className="flex items-center gap-1 text-kiwi-600 dark:text-kiwi-400">
                <Check className="h-4 w-4" />
                <span>{progress.completed}</span>
              </span>
            )}
            {progress.skipped > 0 && (
              <span className="flex items-center gap-1 text-surface-500 dark:text-surface-400">
                <span>⏭️</span>
                <span>{progress.skipped}</span>
              </span>
            )}
            {progress.failed > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <span>X</span>
                <span>{progress.failed}</span>
              </span>
            )}
          </div>

          {isWarming && elapsedTime > 0 && (
            <span className="text-surface-500 dark:text-surface-400">
              {Math.round(elapsedTime / 1000)}s
            </span>
          )}
        </div>
      </div>

      {/* Detailed Task List */}
      {showDetails && (
        <div className="px-4 pb-4">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <AnimatePresence>
              {Array.from(
                progress.total > 0
                  ? ['critical', 'high', 'normal', 'low'].flatMap((priority) =>
                      Array.from({ length: Math.min(2, progress.total) }, (_, i) => ({
                        id: `${priority}-${i}`,
                        name: getTaskName(priority, i),
                        priority,
                        status: getTaskStatus(priority, i),
                      })),
                    )
                  : [],
              )
                .slice(0, 6)
                .map((task) => (
                  <motion.div
                    key={task.id}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      task.status === 'completed'
                        ? 'bg-kiwi-50 dark:bg-kiwi-900/30'
                        : task.status === 'warming'
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : task.status === 'failed'
                            ? 'bg-red-50 dark:bg-red-900/30'
                            : 'bg-surface-50 dark:bg-surface-900'
                    }`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {task.status === 'completed'
                          ? 'Check'
                          : task.status === 'warming'
                            ? 'refresh'
                            : task.status === 'failed'
                              ? 'close'
                              : 'clock'}
                      </span>
                      <span className="text-sm text-surface-700 dark:text-surface-300">
                        {task.name}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        task.priority === 'critical'
                          ? 'text-red-500'
                          : task.priority === 'high'
                            ? 'text-orange-500'
                            : task.priority === 'normal'
                              ? 'text-blue-500'
                              : 'text-surface-400'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Helper functions for demo data
function getTaskName(priority: string, index: number): string {
  const names: Record<string, string[]> = {
    critical: ['Tráfico actual', 'Perfil del comerciante'],
    high: ['Predicciones', 'Alertas de tráfico'],
    normal: ['Sugerencias de ruta', 'Historial de tráfico'],
    low: ['Ubicación del repartidor', 'Datos de usuario'],
  };
  return names[priority]?.[index] || `Tarea ${priority}`;
}

function getTaskStatus(priority: string, index: number): string {
  // This would come from actual task status
  if (index === 0 && priority === 'critical') return 'completed';
  if (index === 0 && priority === 'high') return 'warming';
  return 'pending';
}

/**
 * Compact startup progress for headers
 */
export function StartupProgressCompact({ className = '' }: { className?: string }) {
  const { isWarming, isComplete, progressPercent, progressMessage } = useCacheWarmingProgress();

  if (!isWarming && !isComplete) {
    return null;
  }

  return (
    <motion.div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${
        isComplete
          ? 'bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-400'
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
      } ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {isWarming ? (
        <motion.div
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      ) : (
        <Check className="text-sm h-4 w-4" />
      )}
      <span className="text-sm font-medium">
        {isComplete ? 'Listo' : `${Math.round(progressPercent)}%`}
      </span>
    </motion.div>
  );
}

/**
 * Full-screen startup splash
 */
export function StartupSplash({
  className = '',
  onComplete,
}: {
  className?: string;
  onComplete?: () => void;
}) {
  const { isWarming, isComplete, progressPercent, statusMessage } = useCacheWarmingProgress();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        onComplete?.();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isComplete, onComplete]);

  if (!showSplash) {
    return null;
  }

  return (
    <motion.div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-kiwi-500 to-kiwi-600 ${className}`}
      initial={{ opacity: 1 }}
      animate={{ opacity: isComplete ? 0 : 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center">
        {/* Logo */}
        <motion.div
          className="text-8xl mb-6"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        ></motion.div>

        {/* App Name */}
        <motion.h1
          className="text-4xl font-display font-bold text-white mb-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Kiwi
        </motion.h1>

        <motion.p
          className="text-lg text-white/80 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Tu app de delivery
        </motion.p>

        {/* Progress */}
        <motion.div
          className="w-64 mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <p className="text-sm text-white/80">{isComplete ? '¡Listo!' : statusMessage}</p>
        </motion.div>

        {/* Loading indicator */}
        {isWarming && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <motion.div
              className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full mx-auto"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
