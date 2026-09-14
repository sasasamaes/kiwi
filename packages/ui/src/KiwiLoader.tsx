'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { KiwiSlice } from './KiwiMark';

export interface KiwiLoaderProps {
  /** Tamaño en px (default 48). */
  size?: number;
  /** Etiqueta accesible (default "Cargando…"). */
  label?: string;
  className?: string;
}

/**
 * Loader de marca: el kiwi gira suave con un pulso de escala. Con
 * prefers-reduced-motion queda estático (solo un fade-in) — nada de giros.
 */
export function KiwiLoader({ size = 48, label = 'Cargando…', className = '' }: KiwiLoaderProps) {
  const reduced = useReducedMotion();

  return (
    <div
      role="status"
      aria-label={label}
      className={`flex items-center justify-center ${className}`}
    >
      <motion.div
        animate={reduced ? undefined : { rotate: 360, scale: [1, 1.06, 1] }}
        transition={
          reduced
            ? { duration: 0.3 }
            : {
                rotate: { duration: 1.8, ease: 'linear', repeat: Infinity },
                scale: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
              }
        }
      >
        <KiwiSlice size={size} />
      </motion.div>
    </div>
  );
}

export interface KiwiSplashProps {
  /** Texto bajo el kiwi (default "Kiwi"). */
  title?: string;
  className?: string;
}

/**
 * Pantalla de carga completa: kiwi + wordmark centrados. Para loading.tsx
 * de ruta — cubre el hueco entre navegaciones con marca en vez de blanco.
 */
export function KiwiSplash({ title = 'Kiwi', className = '' }: KiwiSplashProps) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={`flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 ${className}`}
    >
      <KiwiLoader size={72} label="" />
      <motion.span
        className="font-display text-2xl font-bold text-kiwi-600 dark:text-kiwi-400"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        {title}
      </motion.span>
    </div>
  );
}
