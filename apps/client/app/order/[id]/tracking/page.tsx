// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from '@kiwi/ui';

/**
 * Ruta legacy: redirige a la página canónica de seguimiento (/tracking/[id]),
 * que funciona con link público sin login.
 */
export default function LegacyOrderTrackingRedirect() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslations();
  const orderId = params.id as string;

  useEffect(() => {
    if (orderId) router.replace(`/tracking/${orderId}`);
  }, [orderId, router]);

  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
      <p className="text-surface-500 animate-pulse">{t('wcliord.tracking.opening')}</p>
    </main>
  );
}
