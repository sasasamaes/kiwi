'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { cn } from './utils';

/**
 * Reveal suave al hacer scroll: el contenido entra con fade + slide corto
 * la PRIMERA vez que entra al viewport (once: true — no re-anima al volver
 * a subir, que es lo que hace sentir "vendida" una página).
 *
 * - Respeto real a prefers-reduced-motion: sin desplazamiento, solo fade
 *   corto (los usuarios con motion reducido no soportan slides).
 * - Soft: desplazamiento de 24px máximo y spring suave — nada de rebotes.
 * - amount 0.15: dispara cuando 15% del elemento es visible; ni prematuro
 *   (se ve el movimiento) ni tardío (parece que no carga).
 */

const hidden: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 20,
      // Delay escalonado SOLO dentro del primer lote visible (hasta 5 items):
      // evita el efecto "ola" infinito en listas largas.
      delay: Math.min(i, 5) * 0.06,
    },
  }),
};

const reducedHidden: Variants = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { duration: 0.2, delay: Math.min(i, 5) * 0.04 },
  }),
};

export interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Índice de stagger dentro del grupo visible actual (0-4 animan con
   * descuento creciente; >5 animan al máximo delay, sin ola infinita).
   */
  index?: number;
  /** Contenido SIEMPRE visible (no animar): por defecto false. */
  disabled?: boolean;
  /** Etiqueta semántica del contenedor (div, section, li...). */
  as?: 'div' | 'section' | 'li' | 'article' | 'header' | 'footer';
}

export function ScrollReveal({
  children,
  className,
  index = 0,
  disabled = false,
  as = 'div',
}: ScrollRevealProps) {
  const prefersReduced = useReducedMotion();
  const MotionTag = (motion as any)[as] ?? motion.div;

  if (disabled) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={cn(className)}
      variants={prefersReduced ? reducedHidden : hidden}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      custom={index}
    >
      {children}
    </MotionTag>
  );
}
