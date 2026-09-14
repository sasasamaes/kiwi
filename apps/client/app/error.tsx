'use client';

import { AppErrorBoundary } from '@kiwi/ui';

/** Pantalla de error de ruta: marca + reintentar + salida a la home. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorBoundary error={error} reset={reset} />;
}
