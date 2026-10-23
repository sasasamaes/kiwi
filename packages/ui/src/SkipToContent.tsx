// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useCallback } from 'react';

/**
 * Enlace "Saltar al contenido" — primer elemento enfocable de cada app.
 * Visible solo al enfocar con teclado (WCAG 2.4.1 Bypass Blocks). Si la
 * página no marca #main-content, usa el primer <main> y lo etiqueta.
 */
export function SkipToContent() {
  const handleClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById('main-content') ?? document.querySelector('main');
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    if (!target.id) target.id = 'main-content';
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: false });
    target.scrollIntoView();
  }, []);

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-kiwi-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-kiwi-lg"
    >
      Saltar al contenido
    </a>
  );
}
