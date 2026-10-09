// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@kiwi/ui';

/**
 * La home, el menú y el tracking son públicos: un 401 (token vencido o
 * revocado) NO debe patear al login ni recargar la página. Solo las rutas
 * protegidas (/orders) redirigen, y el login devuelve a donde estabas
 * (kiwi_redirect_after_login lo guarda el api-client).
 */
const PROTECTED_PREFIXES = ['/orders'];

export function UnauthorizedHandler() {
  const router = useRouter();

  useEffect(() => {
    api.onUnauthorized((here) => {
      if (PROTECTED_PREFIXES.some((p) => here === p || here.startsWith(`${p}/`))) {
        router.push('/login');
      }
      // En páginas públicas no se hace nada: la sesión ya quedó limpia y
      // la UI pasa a estado invitado (Entrar / Crear cuenta).
    });
    return () => {
      api.onUnauthorized(null);
    };
  }, [router]);

  return null;
}
