'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { offlineCache, type CacheStats } from './offline-cache';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function OfflineIndicator({ 
  className = '',
  showDetails = false 
}: OfflineIndicatorProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    // Check initial status
    setIsOffline(!navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load cache stats
    loadCacheStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadCacheStats = async () => {
    try {
      const stats = await offlineCache.getStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    }
  };

  const handleClearCache = async () => {
    await offlineCache.clear();
    await loadCacheStats();
    setShowPanel(false);
  };

  const handleCleanupExpired = async () => {
    const deleted = await offlineCache.cleanup();
    await loadCacheStats();
    console.log(`Cleaned up ${deleted} expired entries`);
  };

  // Don't show anything if online and no details requested
  if (!isOffline && !showDetails) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Offline Badge */}
      <motion.button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors ${
          isOffline
            ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400'
            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
        }`}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {isOffline ? (
          <>
            <motion.span
              className="text-lg"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              📡
            </motion.span>
            <span className="text-sm">Sin conexión</span>
          </>
        ) : (
          <>
            <span className="text-lg">🟢</span>
            <span className="text-sm">Conectado</span>
          </>
        )}
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
                  {isOffline ? '📡 Modo Offline' : '🟢 Estado de Conexión'}
                </h3>
                <motion.button
                  className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                  onClick={() => setShowPanel(false)}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Connection Status */}
              <div className={`p-4 rounded-xl mb-6 ${
                isOffline 
                  ? 'bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800'
                  : 'bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {isOffline ? '📡' : '🟢'}
                  </span>
                  <div>
                    <p className={`font-semibold ${
                      isOffline 
                        ? 'text-orange-700 dark:text-orange-400'
                        : 'text-kiwi-700 dark:text-kiwi-400'
                    }`}>
                      {isOffline ? 'Sin conexión a internet' : 'Conectado a internet'}
                    </p>
                    <p className="text-sm text-surface-600 dark:text-surface-400">
                      {isOffline 
                        ? 'Usando datos en caché'
                        : 'Datos actualizados en tiempo real'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Cache Stats */}
              {cacheStats && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                    📦 Datos en Caché
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                      <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                        {cacheStats.totalEntries}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        Entradas
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                      <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                        {Math.round(cacheStats.totalSize / 1024)} KB
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        Tamaño total
                      </p>
                    </div>
                  </div>

                  {/* Cache by Type */}
                  {Object.keys(cacheStats.entriesByType).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {Object.entries(cacheStats.entriesByType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between text-sm">
                          <span className="text-surface-600 dark:text-surface-400 capitalize">
                            {type}
                          </span>
                          <span className="font-medium text-surface-800 dark:text-surface-200">
                            {count} entradas
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Offline Capabilities */}
              {isOffline && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                    🔄 Funcionalidades Disponibles
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                      <span className="text-lg">🗺️</span>
                      <div>
                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                          Predicciones de Tráfico
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          Última actualización disponible
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                      <span className="text-lg">🚨</span>
                      <div>
                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                          Alertas de Tráfico
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          Datos almacenados localmente
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                      <span className="text-lg">📊</span>
                      <div>
                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                          Análisis Histórico
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          Patrones guardados
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <motion.button
                  className="w-full py-3 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 font-medium"
                  onClick={handleCleanupExpired}
                  whileTap={{ scale: 0.95 }}
                >
                  🧹 Limpiar Datos Expirados
                </motion.button>

                <motion.button
                  className="w-full py-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium"
                  onClick={handleClearCache}
                  whileTap={{ scale: 0.95 }}
                >
                  🗑️ Limpiar Todo el Caché
                </motion.button>
              </div>

              {/* Last Updated */}
              {cacheStats?.newestEntry && (
                <p className="text-xs text-surface-400 dark:text-surface-500 text-center mt-4">
                  Última actualización: {cacheStats.newestEntry.toLocaleString('es-CR')}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact offline indicator for headers/navigation
 */
export function OfflineIndicatorCompact({ className = '' }: { className?: string }) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <motion.div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 text-xs font-medium ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.span
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        📡
      </motion.span>
      <span>Offline</span>
    </motion.div>
  );
}

/**
 * Banner that shows when offline
 */
export function OfflineBanner({ className = '' }: { className?: string }) {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false);
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <motion.div
      className={`bg-orange-500 text-white px-4 py-3 ${className}`}
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.span
            className="text-xl"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            📡
          </motion.span>
          <div>
            <p className="font-semibold">Sin conexión a internet</p>
            <p className="text-sm opacity-90">
              Usando datos almacenados. Se sincronizará cuando vuelva la conexión.
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
