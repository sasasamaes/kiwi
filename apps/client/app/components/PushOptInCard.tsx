// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotifications, useTranslations } from '@kiwi/ui';

const DISMISS_KEY = 'kiwi-push-optin-dismissed';

/**
 * Card para activar notificaciones push. Aparece solo si el navegador
 * soporta push y el permiso está en 'default'. Si lo niega, no se insiste
 * (el switch de ofertas en perfil sigue disponible). Descartable con X.
 */
export function PushOptInCard() {
  const { isSupported, permission, needsInstall, requestPermission } = usePushNotifications();
  const { t } = useTranslations();
  const [dismissed, setDismissed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!isSupported || dismissed || permission !== 'default') return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // sin storage: se oculta igual en esta sesión
    }
    setDismissed(true);
  };

  const activate = async () => {
    setLoading(true);
    setError(null);
    const res = await requestPermission();
    setLoading(false);
    if (res.ok) {
      setDone(true);
      try {
        window.localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        // noop
      }
      return;
    }
    if (res.reason === 'denied') {
      // Respeto: no volver a mostrar.
      dismiss();
      return;
    }
    setError(
      res.reason === 'unsupported'
        ? t('wclihome.home.pushUnsupported')
        : t('wclihome.home.pushFailed'),
    );
  };

  if (done) {
    return (
      <div className="mb-6 rounded-2xl bg-kiwi-50 dark:bg-kiwi-400/10 border border-kiwi-600/20 p-4">
        <p className="text-sm text-kiwi-700 dark:text-kiwi-300 flex items-center gap-2">
          <Bell className="h-4 w-4" /> {t('wclihome.home.pushDone')}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4 shadow-soft dark:shadow-dark">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-400/10">
          <Bell className="h-5 w-5 text-kiwi-700 dark:text-kiwi-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-surface-800 dark:text-surface-100 text-sm">
            {needsInstall
              ? t('wclihome.home.pushTitleInstall')
              : t('wclihome.home.pushTitleDefault')}
          </p>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
            {needsInstall ? t('wclihome.home.pushDescInstall') : t('wclihome.home.pushDescDefault')}
          </p>
          {!needsInstall && (
            <button
              onClick={activate}
              disabled={loading}
              className="mt-2 rounded-xl bg-kiwi-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? t('wclihome.home.pushActivating') : t('wclihome.home.pushCta')}
            </button>
          )}
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
        <button
          onClick={dismiss}
          aria-label={t('wclihome.home.pushDismiss')}
          className="rounded-full p-1 text-surface-500 dark:text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
