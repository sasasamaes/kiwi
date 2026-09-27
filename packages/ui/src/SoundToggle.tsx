// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import {
  isSoundEnabled,
  setSoundEnabled,
  subscribeSoundEnabled,
  playNotificationSound,
} from './notification-sound';

/**
 * Interruptor de sonido de notificaciones (local al dispositivo).
 * Al activar suena una prueba para confirmar que se oye.
 */
export function SoundToggle({ label = 'Sonido de notificaciones' }: { label?: string }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isSoundEnabled());
    return subscribeSoundEnabled(setEnabled);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setSoundEnabled(next);
    setEnabled(next);
    if (next) playNotificationSound('default');
  };

  return (
    <button
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={`${label}: ${enabled ? 'activado' : 'desactivado'}`}
      className="flex w-full items-center justify-between rounded-xl glass p-4"
    >
      <span className="flex items-center gap-3 text-surface-800 dark:text-surface-200">
        {enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        <span className="font-medium">{label}</span>
      </span>
      <span
        className={`relative h-11 w-[66px] shrink-0 rounded-full p-1.5 transition-colors ${
          enabled ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
        }`}
      >
        <span
          className={`block h-8 w-8 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-[22px]' : ''
          }`}
        />
      </span>
    </button>
  );
}
