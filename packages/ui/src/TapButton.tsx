'use client';

import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useCallback, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from './utils';

/**
 * Microinteracciones de botón — la capa táctil que hace que un botón se
 * sienta FÍSICO en lugar de pintado:
 *
 * - Press con spring (scale 0.94): hundimiento suave, no un "click" seco.
 * - Háptico opcional (navigator.vibrate 10ms): en Android/PWA el dedo
 *   también lo siente. iOS Safari lo ignora silenciosamente — no pasa nada.
 * - Flash de éxito opcional (`successOn`): al agregar al carrito, el botón
 *   muestra un check verde 600ms — confirmación visual del evento SIN
 *   toast ni saltos de layout.
 * - Reduced motion: sin escala ni vibración; el estado de éxito se muestra
 *   estático (color, no movimiento).
 *
 * A diferencia de AnimatedButton (botón de form con variantes de estilo),
 * TapButton es para iconos/CTAs circulares: +, −, enviar, confirmar.
 */

export interface TapButtonProps extends Omit<
  React.ComponentProps<typeof motion.button>,
  'ref' | 'onDrag' | 'onDragStart' | 'onDragEnd'
> {
  /** Vibración háptica al presionar (10ms, imperceptible si no existe). */
  haptic?: boolean;
  /** true = muestra check de éxito; número = ms custom (default 600). */
  success?: boolean | number;
  /** Se dispara al presionar, ANTES de tu onClick si envuelven lógica async. */
  onPressStart?: () => void;
  children: React.ReactNode;
}

export function TapButton({
  haptic = false,
  success = false,
  onPressStart,
  onClick,
  className,
  children,
  disabled,
  ...props
}: TapButtonProps) {
  const prefersReduced = useReducedMotion();
  const [showSuccess, setShowSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const successMs = typeof success === 'number' ? success : 600;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onPressStart?.();

      if (haptic && !prefersReduced && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }

      if (success) {
        setShowSuccess(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setShowSuccess(false), successMs);
      }

      onClick?.(e);
    },
    [onClick, onPressStart, haptic, success, successMs, prefersReduced],
  );

  return (
    <motion.button
      whileTap={disabled || prefersReduced ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={cn('relative select-none', className)}
      onClick={handleClick}
      disabled={disabled}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        {showSuccess ? (
          <motion.span
            key="success"
            className="absolute inset-0 flex items-center justify-center"
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
          >
            <Check className="h-5 w-5" />
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
      {/* Mantener ancho estable mientras el check reemplaza el contenido */}
      <span className="invisible">{children}</span>
    </motion.button>
  );
}
