// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@kiwi/ui';
import { ComingSoon } from './ComingSoon';

/** Rutas que siguen abiertas cuando la app está en modo Próximamente. */
const OPEN_PATHS = [
  '/register',
  '/login',
  '/privacy',
  '/terms',
  '/cookies',
  '/refunds',
  '/tracking',
];

/** El link de seguimiento siempre funciona: el pedido ya existe y el
 *  cliente solo mira su estado (no usa la app). Cubre /tracking/[id] y
 *  /order/[id]/tracking. */
function isTrackingPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/tracking' || /(^|\/)tracking(\/|$)/.test(pathname);
}

/**
 * Bloquea la app cliente en prelanzamiento: todo redirige a Próximamente
 * salvo registro/login/legales y seguimiento de pedidos.
 * Fail-open: sin respuesta del API, la app abre.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getFeatureFlags()
      .then((f) => {
        if (!cancelled) setBlocked((f as any).clientAppEnabled === false);
      })
      .catch(() => {
        if (!cancelled) setBlocked(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (
    blocked === true &&
    !isTrackingPath(pathname) &&
    !OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return <ComingSoon />;
  }
  return <>{children}</>;
}
