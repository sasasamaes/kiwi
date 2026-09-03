'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Check initial status
    setIsOffline(!navigator.onLine);

    // Load queued count from localStorage
    const loadQueueCount = () => {
      try {
        const stored = localStorage.getItem('kiwi_offline_queue');
        if (stored) {
          const queue = JSON.parse(stored);
          setQueuedCount(queue.length);
        }
      } catch {}
    };

    loadQueueCount();

    // Listen for connectivity changes
    const handleOnline = () => {
      setIsOffline(false);
      loadQueueCount();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll queue status
    const interval = setInterval(loadQueueCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Don't show if online and no queued requests
  if (!isOffline && queuedCount === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-20 left-4 right-4 z-50"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <motion.div
          className={`rounded-2xl p-4 shadow-2xl backdrop-blur-xl ${
            isOffline 
              ? 'bg-red-500/90 text-white' 
              : queuedCount > 0 
                ? 'bg-gold-500/90 text-white' 
                : 'bg-kiwi-500/90 text-white'
          }`}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="text-2xl"
                animate={isOffline ? { rotate: [0, -10, 10, 0] } : {}}
                transition={{ duration: 0.5, repeat: isOffline ? Infinity : 0, repeatDelay: 2 }}
              >
                {isOffline ? '📴' : queuedCount > 0 ? 'Upload' : '🟢'}
              </motion.div>
              <div>
                <p className="font-semibold text-sm">
                  {isOffline ? 'Sin conexión' : queuedCount > 0 ? 'Sincronizando...' : 'En línea'}
                </p>
                <p className="text-xs opacity-80">
                  {isOffline 
                    ? 'Los pedidos se enviarán cuando vuelva la conexión'
                    : queuedCount > 0 
                      ? `${queuedCount} pedidos pendientes`
                      : 'Conectado al servidor'
                  }
                </p>
              </div>
            </div>
            
            {queuedCount > 0 && (
              <motion.div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {queuedCount}
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
