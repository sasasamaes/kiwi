'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Transición de entrada de página para App Router (usar desde template.tsx,
 * que se remonta en cada navegación). Solo entrada: fade + subir 12px.
 *
 * NOTA: no usamos AnimatePresence aquí — en App Router la página anterior se
 * desmonta antes de que una exit pueda correr, y fingir lo contrario con
 * mode="wait" sobre un hijo estático no anima nada. La entrada sola es lo
 * que se ve; el navegador completa el resto con el scroll restoration.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}
