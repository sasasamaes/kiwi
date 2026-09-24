'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';
import { cookieConsent, type CookieConsentValue } from './cookie-consent';
import { analytics } from './analytics';

export interface CookieConsentBannerProps {
  /** Ruta de la política de cookies para el enlace "Leer más". */
  policyHref?: string;
}

/**
 * Banner de consentimiento (GDPR-style, adaptado a CR). Aparece solo si no hay
 * decisión guardada. "Solo necesarias" deja la analítica apagada; "Aceptar"
 * la habilita. La decisión se persiste y se puede cambiar desde /cookies.
 */
export function CookieConsentBanner({ policyHref = '/cookies' }: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    // Punto único de arranque de la analítica en las apps web: si ya hay
    // consentimiento 'all', inicializa PostHog; si no, el listener interno
    // lo hará cuando el usuario acepte acá mismo.
    void analytics.init();
    if (cookieConsent.needsPrompt()) {
      // Esperar al primer paint para no competir con la hidratación.
      const id = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(id);
    }
  }, []);

  const decide = (value: Exclude<CookieConsentValue, null>) => {
    cookieConsent.set(value);
    setVisible(false);
    // Al aceptar, arrancar la analítica en caliente (el gate de analytics.ts
    // devolvió null en init() porque aún no había decisión).
    if (value === 'all') void analytics.init();
  };

  // Pageview por navegación (App Router). El gate de consentimiento vive en
  // analytics.ts: sin 'all' esto no envía nada. Se deduplica por pathname
  // (usePathname no cambia en re-renders sin navegación real).
  useEffect(() => {
    if (!pathname || lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;
    void analytics.page(pathname);
  }, [pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-live="polite"
          aria-label="Preferencias de cookies"
          className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-safe"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="mx-auto mb-3 max-w-2xl rounded-2xl glass-strong p-4 shadow-kiwi-lg">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kiwi-gradient text-white">
                <Cookie className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                  Cookies y almacenamiento local
                </p>
                {!showDetail ? (
                  <>
                    <p className="mt-1 text-xs leading-relaxed text-surface-600 dark:text-surface-300">
                      Usamos almacenamiento necesario para tu sesión y preferencias. ¿Nos permitís
                      también usar analítica anónima para mejorar Kiwi?{' '}
                      <Link
                        href={policyHref}
                        className="font-medium text-kiwi-700 underline underline-offset-2 dark:text-kiwi-400"
                      >
                        Más info
                      </Link>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => decide('all')}
                        className="min-h-[44px] flex-1 rounded-xl bg-kiwi-gradient px-4 py-2 text-sm font-semibold text-white shadow-kiwi hover:opacity-90"
                      >
                        Aceptar todo
                      </button>
                      <button
                        onClick={() => decide('necessary')}
                        className="min-h-[44px] flex-1 rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
                      >
                        Solo necesarias
                      </button>
                      <button
                        onClick={() => setShowDetail(true)}
                        className="min-h-[44px] rounded-xl px-3 py-2 text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                      >
                        Personalizar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <ul className="mt-2 space-y-2 text-xs text-surface-600 dark:text-surface-300">
                      {/* dark:surface-300 = 9.7:1 sobre glass oscuro ✓ */}
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 rounded bg-kiwi-100 px-1.5 py-0.5 text-[10px] font-semibold text-kiwi-700 dark:bg-kiwi-900/40 dark:text-kiwi-300">
                          Siempre
                        </span>
                        <span>
                          <strong>Necesarias</strong> — sesión, tema, idioma, sync offline. Sin
                          estas la app no funciona.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 rounded bg-surface-100 px-1.5 py-0.5 text-[10px] font-semibold text-surface-500 dark:bg-surface-800 dark:text-surface-300">
                          Opcional
                        </span>
                        <span>
                          <strong>Analítica</strong> (PostHog) — métricas anónimas de uso. Apagada
                          por defecto.
                        </span>
                      </li>
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => decide('all')}
                        className="min-h-[44px] flex-1 rounded-xl bg-kiwi-gradient px-4 py-2 text-sm font-semibold text-white shadow-kiwi hover:opacity-90"
                      >
                        Aceptar todo
                      </button>
                      <button
                        onClick={() => decide('necessary')}
                        className="min-h-[44px] flex-1 rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
                      >
                        Solo necesarias
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
