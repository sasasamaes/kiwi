// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Actualizador de service workers.
 *
 * Problema que resuelve: las apps son SPA — el navegador casi nunca hace
 * una navegación completa, que es lo único que dispara el chequeo
 * automático de updates del SW. Resultado: el celu se queda con un worker
 * viejo (ej. notificaciones genéricas) y la única salida era reinstalar.
 *
 * Esto chequea explícitamente (registration.update) al abrir la app, al
 * volver a ella y cada 30 min, para TODOS los workers registrados (app +
 * Firebase Messaging). Si aparece versión nueva, muestra un banner con
 * un toque para aplicarla — sin reinstalar nada y sin recargas sorpresa
 * a mitad de un pedido (la recarga solo pasa al tocar Actualizar).
 */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function ServiceWorkerUpdater() {
  const [updateReady, setUpdateReady] = useState(false);
  const notifiedRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    try {
      if (!('serviceWorker' in navigator)) return;
      // Un worker distinto en el futuro vuelve a disparar onstatechange;
      // resetear permite avisar de esa próxima versión.
      notifiedRef.current = false;
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        reg.onupdatefound = () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.onstatechange = () => {
            // Hay worker nuevo instalado y la página sigue controlada por
            // el viejo: avisar una vez hasta que se aplique.
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              if (!notifiedRef.current) {
                notifiedRef.current = true;
                setUpdateReady(true);
              }
            }
          };
        };
        await reg.update().catch(() => null);
      }
    } catch {
      // best-effort: no bloquea nada
    }
  }, []);

  useEffect(() => {
    void checkForUpdate();
    const timer = setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
    const onReturn = () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [checkForUpdate]);

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[70] px-4 pt-safe">
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-kiwi-300 dark:border-kiwi-700 bg-white/95 dark:bg-surface-800/95 shadow-kiwi-lg backdrop-blur-xl px-4 py-3">
        <p className="flex-1 text-sm font-medium text-surface-800 dark:text-surface-100">
          Hay una nueva versión de la app
        </p>
        <button
          onClick={() => setUpdateReady(false)}
          aria-label="Descartar actualización"
          className="rounded-lg px-2 py-1 text-sm text-surface-400"
        >
          ✕
        </button>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-xl bg-kiwi-700 px-4 py-2 text-sm font-bold text-white"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
