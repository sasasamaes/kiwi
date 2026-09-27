// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * Enlace "Saltar al contenido" — primer elemento enfocable de cada app.
 * Visible solo al enfocar con teclado (WCAG 2.4.1 Bypass Blocks). Apunta a
 * #main-content, que cada layout marca en su <main>.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-kiwi-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-kiwi-lg"
    >
      Saltar al contenido
    </a>
  );
}
