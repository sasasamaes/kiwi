// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, WifiOff } from 'lucide-react';

/**
 * Indicadores de conectividad — SIN dependencias de la isla offline.
 * OfflineIndicator ya no carga offline-cache (IndexedDB) para sus estadísticas:
 * cuenta entradas con un helper inline. Así el módulo entra en el bundle
 * inicial sin arrastrar la isla offline completa.
 */

const CACHE_DB_NAME = 'kiwi-traffic-cache';
const CACHE_STORE_NAME = 'traffic-data';

/** Cuenta entradas en el caché IndexedDB sin instanciar el servicio completo. */
async function countCacheEntries(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0;
  return new Promise((resolve) => {
    let settled = false;
    const done = (n: number) => {
      if (!settled) {
        settled = true;
        resolve(n);
      }
    };
    try {
      const req = indexedDB.open(CACHE_DB_NAME, 1);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction([CACHE_STORE_NAME], 'readonly');
          const countReq = tx.objectStore(CACHE_STORE_NAME).count();
          countReq.onsuccess = () => {
            db.close();
            done(countReq.result ?? 0);
          };
          countReq.onerror = () => {
            db.close();
            done(0);
          };
        } catch {
          db.close();
          done(0);
        }
      };
      req.onerror = () => done(0);
      req.onblocked = () => done(0);
    } catch {
      done(0);
    }
  });
}

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function OfflineIndicator({ className = '', showDetails = false }: OfflineIndicatorProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    countCacheEntries().then(setEntryCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showDetails) {
    return null;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        onClick={() => setShowPanel((v) => !v)}
        className="flex items-center gap-2 rounded-xl bg-orange-100 dark:bg-orange-900/50 px-3 py-2 text-sm font-medium text-orange-700 dark:text-orange-400"
      >
        <AlertTriangle className="h-4 w-4" />
        Offline
        {entryCount !== null && <span className="text-xs opacity-70">({entryCount} en caché)</span>}
      </button>
      {showPanel && (
        <p className="mt-2 text-xs text-surface-500 dark:text-surface-400">
          Las acciones pendientes se sincronizan automáticamente al reconectar.
        </p>
      )}
    </motion.div>
  );
}

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
      <WifiOff className="h-3 w-3" />
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
          <WifiOff className="h-5 w-5" />
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
