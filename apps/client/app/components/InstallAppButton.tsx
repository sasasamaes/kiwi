// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Botón "Instalar app". En Android/desktop usa beforeinstallprompt; en
 * iPhone muestra la guía (Compartir → Agregar a inicio). Si ya está
 * instalada no muestra nada.
 */
export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as any)?.standalone === true;
    setInstalled(standalone);
    setIsIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (installed) return null;

  if (deferred) {
    return (
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await deferred.prompt();
            await deferred.userChoice;
          } catch {
            // el usuario cerró el diálogo: queda el botón para reintentar
          } finally {
            setBusy(false);
            setDeferred(null);
          }
        }}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        <Download className="h-4 w-4" />
        {busy ? 'Instalando…' : 'Instalar app en tu celu'}
      </button>
    );
  }

  if (isIos) {
    return (
      <div className="rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-xs text-surface-600 dark:text-surface-300 flex items-start gap-2">
        <Share className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          En iPhone: tocá <strong>Compartir</strong> → <strong>Agregar a inicio</strong> para
          instalar KiWi y recibir avisos.
        </span>
      </div>
    );
  }

  return null;
}
