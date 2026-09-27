// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Ruta legacy: redirige a la página canónica de seguimiento (/tracking/[id]),
 * que funciona con link público sin login.
 */
export default function LegacyOrderTrackingRedirect() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  useEffect(() => {
    if (orderId) router.replace(`/tracking/${orderId}`);
  }, [orderId, router]);

  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
      <p className="text-surface-500 animate-pulse">Abriendo seguimiento…</p>
    </main>
  );
}
