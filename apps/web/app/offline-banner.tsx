// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, socketClient } from '@kiwi/ui';

type BannerState = 'hidden' | 'offline' | 'reconnecting';

/**
 * Global connectivity banner for the merchant app.
 *
 * Two user-visible states:
 *  - offline:      navigator.onLine === false (no network at all)
 *  - reconnecting: online but the socket is not connected — "Wi-Fi up, API
 *                  down" used to be invisible until every request failed
 *
 * Socket state comes from the shared singleton. Mounted app-wide, this also
 * *drives* the connection while logged in (connect() is idempotent and reuses
 * the same socket), so real-time order events work on every merchant page,
 * not only the ones that call useSocket themselves.
 */
export function OfflineBanner() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    // Network reachability.
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Socket state from the shared client singleton.
    setSocketConnected(socketClient.isConnected());
    const offs = [
      socketClient.on('socket:connected', () => setSocketConnected(true)),
      socketClient.on('socket:disconnected', () => setSocketConnected(false)),
    ];

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      offs.forEach((off) => off());
    };
  }, []);

  // Keep the socket connected while logged in, wherever the merchant navigates.
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('kiwi_token');
    if (token) socketClient.connect(token);
  }, [user]);

  // Grace period: never flash "reconnecting" during a normal boot — only show
  // it once the socket has actually failed to connect for a few seconds.
  useEffect(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (isOnline && !socketConnected) {
      reconnectTimer.current = setTimeout(() => setShowReconnecting(true), 5000);
      return () => {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      };
    }
    setShowReconnecting(false);
  }, [isOnline, socketConnected]);

  if (!mounted || !user) return null;

  const state: BannerState = !isOnline ? 'offline' : showReconnecting ? 'reconnecting' : 'hidden';

  if (state === 'hidden') return null;

  const styles: Record<
    Exclude<BannerState, 'hidden'>,
    { bg: string; emoji: string; title: string; subtitle: string; animate?: any }
  > = {
    offline: {
      bg: 'bg-red-500/90 text-white',
      emoji: '📴',
      title: 'Sin conexión',
      subtitle: 'No puedes crear ni actualizar pedidos hasta que vuelva la conexión',
      animate: { rotate: [0, -10, 10, 0] },
    },
    reconnecting: {
      bg: 'bg-amber-500/90 text-white',
      emoji: '📡',
      title: 'Reconectando…',
      subtitle: 'Buscando señal con el servidor Kiwi',
      animate: { opacity: [1, 0.5, 1] },
    },
  };

  const s = styles[state];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:max-w-md"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <motion.div
          className={`rounded-2xl p-4 shadow-2xl backdrop-blur-xl ${s.bg}`}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="text-2xl"
              animate={state === 'offline' ? s.animate : {}}
              transition={{
                duration: 0.5,
                repeat: state === 'offline' ? Infinity : 0,
                repeatDelay: 2,
              }}
            >
              {s.emoji}
            </motion.div>
            <div>
              <p className="font-semibold text-sm">{s.title}</p>
              <p className="text-xs opacity-80">{s.subtitle}</p>
            </div>
          </div>

          {isExpanded && (
            <p className="mt-2 border-t border-white/20 pt-2 text-xs opacity-90">
              {state === 'offline'
                ? 'Revisa tu Wi-Fi o datos móviles. La app seguirá funcionando y se reconectará sola.'
                : 'Tus datos se actualizan en cuanto volvamos a conectar. No cierres la app.'}
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
