'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

export interface ScrollToTopProps {
  /** px de scroll antes de que aparezca el botón (default 400). */
  threshold?: number;
  /** Clases extra para reposicionarlo (default: abajo-derecha, safe-area aware). */
  className?: string;
  /** Texto accesible del botón. */
  label?: string;
}

/**
 * Botón flotante "volver arriba": aparece tras hacer scroll (threshold px)
 * y sube suave. Posicionado abajo-derecha con safe-area inline (env()) para
 * no chocar con la home indicator en iOS standalone — sin depender del CSS
 * de cada app.
 *
 * En prefers-reduced-motion: window.scrollTo con behavior 'instant' — el
 * navegador ya lo respeta si pedimos 'smooth', pero lo hacemos explícito.
 */
export function ScrollToTop({
  threshold = 400,
  className = '',
  label = 'Volver arriba',
}: ScrollToTopProps) {
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onMq = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onMq);
    return () => {
      window.removeEventListener('scroll', onScroll);
      mq.removeEventListener('change', onMq);
    };
  }, [threshold]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          aria-label={label}
          title={label}
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: reducedMotion ? 'instant' : 'smooth',
            })
          }
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          whileTap={{ scale: 0.92 }}
          style={{
            marginBottom: 'env(safe-area-inset-bottom, 0px)',
            marginRight: 'env(safe-area-inset-right, 0px)',
          }}
          className={`fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-kiwi-500 text-white shadow-kiwi-lg hover:bg-kiwi-600 focus:outline-none focus:ring-2 focus:ring-kiwi-400 md:bottom-6 ${className}`}
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
