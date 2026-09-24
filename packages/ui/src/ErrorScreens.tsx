'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home as HomeIcon, RefreshCw, SearchX } from 'lucide-react';
import { KiwiMark } from './KiwiMark';
import { captureException } from './sentry';

export interface ErrorStateProps {
  /** Texto del error para el usuario (no el stack). */
  title?: string;
  /** Detalle opcional (ej. el message capturado). */
  detail?: string | null;
  /** Reinicia el error del error-boundary (llama reset() de error.tsx). */
  onRetry?: () => void;
  /** Link de salida seguro (default: '/' — la home siempre existe). */
  homeHref?: string;
  homeLabel?: string;
}

/**
 * Pantalla de error de marca para error.tsx: kiwi triste + acción de
 * reintento + salida garantizada. Nunca muestra el stack trace; el error
 * real se reporta a Sentry.
 */
export function ErrorState({
  title = 'Algo salió mal',
  detail = null,
  onRetry,
  homeHref = '/',
  homeLabel = 'Ir al inicio',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <div className="opacity-70 grayscale">
        <KiwiMark size={80} floating={false} />
      </div>
      <h1 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
        {title}
      </h1>
      {detail && (
        <p className="max-w-sm text-sm text-surface-500 dark:text-surface-400">{detail}</p>
      )}
      <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
        {onRetry && (
          <motion.button
            type="button"
            onClick={onRetry}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-xl bg-kiwi-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-kiwi-800"
          >
            <RefreshCw className="h-4 w-4" /> Reintentar
          </motion.button>
        )}
        <Link
          href={homeHref}
          className="flex items-center gap-2 rounded-xl bg-surface-100 px-6 py-3 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
        >
          <HomeIcon className="h-4 w-4" /> {homeLabel}
        </Link>
      </div>
    </div>
  );
}

/**
 * Wrapper para error.tsx de Next: reporta a Sentry y muestra la pantalla
 * de marca. Los error.tsx son Client Components y reciben { error, reset }.
 */
export function AppErrorBoundary({
  error,
  reset,
  title,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  // Reporte fuera del render: los error.tsx se re-renderizan, no queremos
  // duplicar eventos en Sentry por cada repaint.
  if (typeof window !== 'undefined') {
    queueMicrotask(() => captureException(error));
  }
  return (
    <ErrorState
      title={title}
      detail={error.digest ? `Código de referencia: ${error.digest}` : null}
      onRetry={reset}
    />
  );
}

export interface NotFoundStateProps {
  title?: string;
  detail?: string;
  homeHref?: string;
  homeLabel?: string;
}

/**
 * Pantalla 404 de marca para not-found.tsx: sin retry (no hay nada que
 * reintentar), con salida clara a la home.
 */
export function NotFoundState({
  title = 'Página no encontrada',
  detail = 'El enlace que seguiste no existe o cambió de dirección.',
  homeHref = '/',
  homeLabel = 'Ir al inicio',
}: NotFoundStateProps) {
  return (
    <div
      role="status"
      className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-100 dark:bg-surface-800">
        <SearchX className="h-10 w-10 text-surface-400" />
      </div>
      <h1 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
        {title}
      </h1>
      <p className="max-w-sm text-sm text-surface-500 dark:text-surface-400">{detail}</p>
      <Link
        href={homeHref}
        className="mt-2 flex items-center gap-2 rounded-xl bg-kiwi-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-kiwi-800"
      >
        <HomeIcon className="h-4 w-4" /> {homeLabel}
      </Link>
    </div>
  );
}
