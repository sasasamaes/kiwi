// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { motion } from 'framer-motion';

/**
 * Cuenta creada fuera de cobertura: se anotó en la lista de espera y se le
 * avisa por correo al llegar. Se muestra en vez del formulario tras un
 * registro con `outsideCoverage`.
 */
export function WaitlistNotice({
  city,
  message,
  actionLabel = 'Continuar',
  onContinue,
}: {
  city: string;
  message: string;
  actionLabel?: string;
  onContinue: () => void;
}) {
  return (
    <motion.div
      className="w-full max-w-md mx-auto rounded-3xl glass-strong border border-white/30 shadow-kiwi-lg p-8 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
    >
      <p className="text-4xl mb-3">🗺️</p>
      <h1 className="text-2xl font-display font-bold text-surface-800">¡Cuenta creada!</h1>
      <p className="text-surface-500 mt-2 text-sm">{message}</p>
      <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">
        Sos de {city}: en cuanto operemos ahí te escribimos.
      </p>
      <motion.button
        onClick={onContinue}
        className="mt-6 w-full py-3 px-4 rounded-xl font-semibold text-white bg-kiwi-gradient hover:shadow-kiwi transition-all"
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        {actionLabel}
      </motion.button>
    </motion.div>
  );
}
