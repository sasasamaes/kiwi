// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FlaskConical } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import {
  useAuth,
  usePushNotifications,
  api,
  TapButton,
  KiwiLoader,
  useTranslations,
} from '@kiwi/ui';

/** Mensaje exacto según el paso que falló (permiso vs token vs servidor). */
function pushErrorMessage(
  t: (key: string, vars?: Record<string, string | number>) => string,
  reason?: string,
): string {
  switch (reason) {
    case 'denied':
      return t('wdrvmisc.testing.errDenied');
    case 'no-push-manager':
    case 'unsupported':
      return t('wdrvmisc.testing.errUnsupported');
    case 'missing-vapid':
    case 'missing-config':
      return t('wdrvmisc.testing.errConfig');
    case 'sync-failed':
      return t('wdrvmisc.testing.errSync');
    case 'token-failed':
      return t('wdrvmisc.testing.errToken');
    default:
      return t('wdrvmisc.testing.errDefault');
  }
}

export default function TestingPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const {
    permission: pushPermission,
    requestPermission: requestPushPermission,
    pushDebug,
  } = usePushNotifications({ enabled: false });

  const [pushBusy, setPushBusy] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);
  const [pushTest, setPushTest] = useState<string | null>(null);
  const [pushTokenMissing, setPushTokenMissing] = useState(false);
  const [deviceTokens, setDeviceTokens] = useState<
    Array<{ short: string; platform: string; lastUsedAt: string; createdAt: string }>
  >([]);
  const [pruningTokens, setPruningTokens] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
    else if ((user as any).role && (user as any).role !== 'driver') router.push('/login');
  }, [user, authLoading, router]);

  const refreshDeviceTokens = useCallback(async () => {
    try {
      setDeviceTokens(await api.getDeviceTokens());
    } catch {
      // best-effort: el diagnóstico no bloquea nada
    }
  }, []);

  useEffect(() => {
    if (user && pushPermission === 'granted') void refreshDeviceTokens();
  }, [user, pushPermission, refreshDeviceTokens]);

  if (authLoading) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <KiwiLoader size={56} />
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      <header className="pt-safe sticky top-0 z-50 glass-strong">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between">
          <Link
            href="/profile"
            className="flex min-h-[44px] items-center gap-2 text-surface-600 dark:text-surface-400"
          >
            <span>←</span>
            <span className="text-sm font-medium">{t('wdrvmisc.testing.back')}</span>
          </Link>
          <h1 className="flex items-center gap-2 font-display font-semibold text-surface-800 dark:text-surface-100">
            <FlaskConical className="h-5 w-5" /> {t('wdrvmisc.testing.title')}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 pt-6 pb-28">
        {pageError && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {pageError}
          </div>
        )}

        {/* Prueba de notificaciones con diagnóstico real del servidor */}
        <div className="mb-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4">
          <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
            {t('wdrvmisc.testing.pushTitle')}
          </p>
          {pushTest ? (
            <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">{pushTest}</p>
          ) : (
            <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
              {t('wdrvmisc.testing.pushHint')}
            </p>
          )}
          <TapButton
            variant="secondary"
            className="mt-3 h-10 w-full rounded-xl text-sm"
            disabled={pushTesting}
            onClick={async () => {
              setPushTesting(true);
              setPushTest(null);
              try {
                const r = await api.sendTestPush();
                if (!r.fcmConfigured) {
                  setPushTokenMissing(false);
                  setPushTest(t('wdrvmisc.testing.noFcm'));
                } else if (r.tokens === 0) {
                  setPushTokenMissing(true);
                  setPushTest(t('wdrvmisc.testing.noToken'));
                } else {
                  setPushTokenMissing(false);
                  void refreshDeviceTokens();
                  const bad = r.results.filter((x) => !x.ok);
                  setPushTest(
                    bad.length === 0
                      ? t('wdrvmisc.testing.sentOk', { count: r.sent ?? 1 })
                      : t('wdrvmisc.testing.sendFailed', { error: bad[0]?.error ?? 'error' }),
                  );
                }
              } catch {
                setPushTest(t('wdrvmisc.testing.testFailed'));
              } finally {
                setPushTesting(false);
              }
            }}
          >
            {pushTesting ? t('wdrvmisc.testing.testingAlert') : t('wdrvmisc.testing.testAlert')}
          </TapButton>
          {pushDebug?.swRegistrations && pushDebug.swRegistrations.length > 0 && (
            <p className="mt-2 text-[11px] text-surface-500 dark:text-surface-400">
              {t('wdrvmisc.testing.sw', {
                list: pushDebug.swRegistrations.map((s) => `${s.script}@${s.scope}`).join(' · '),
              })}
            </p>
          )}
          {/* Registros duplicados: si hay más de 1, cada push llega N veces */}
          {deviceTokens.length > 1 && (
            <div className="mt-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-3 py-2">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {t('wdrvmisc.testing.duplicates', {
                  count: deviceTokens.length,
                  platforms: deviceTokens.map((tok) => tok.platform).join(', '),
                })}
              </p>
              <TapButton
                variant="secondary"
                className="mt-2 h-9 w-full rounded-xl text-xs"
                disabled={pruningTokens}
                onClick={async () => {
                  setPruningTokens(true);
                  try {
                    const r = await api.pruneDeviceTokens();
                    setPushTest(
                      r.removed > 0
                        ? t('wdrvmisc.testing.pruned', { count: r.removed })
                        : t('wdrvmisc.testing.singleRecord'),
                    );
                    await refreshDeviceTokens();
                  } catch {
                    setPushTest(t('wdrvmisc.testing.cleanFailed'));
                  } finally {
                    setPruningTokens(false);
                  }
                }}
              >
                {pruningTokens
                  ? t('wdrvmisc.testing.cleaningDupes')
                  : t('wdrvmisc.testing.cleanDupes')}
              </TapButton>
            </div>
          )}
          {pushTokenMissing && (
            <TapButton
              variant="gradient"
              haptic
              className="mt-2 h-11 w-full rounded-xl text-sm"
              disabled={pushBusy}
              onClick={async () => {
                setPushBusy(true);
                setPageError(null);
                try {
                  const res = await requestPushPermission();
                  if (res.ok) {
                    setPushTokenMissing(false);
                    setPushTest(t('wdrvmisc.testing.tokenOk'));
                    void refreshDeviceTokens();
                  } else {
                    setPageError(pushErrorMessage(t, res.reason));
                  }
                } finally {
                  setPushBusy(false);
                }
              }}
            >
              {pushBusy ? t('wdrvmisc.testing.reactivating') : t('wdrvmisc.testing.reactivate')}
            </TapButton>
          )}
        </div>

        {/* Diagnóstico técnico */}
        {pushDebug && (
          <details className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 text-xs text-surface-500 dark:text-surface-400">
            <summary className="font-semibold">{t('wdrvmisc.testing.diagnostics')}</summary>
            <pre className="mt-1 whitespace-pre-wrap break-all">
              {JSON.stringify(pushDebug, null, 1)}
            </pre>
          </details>
        )}

        {deviceTokens.length > 0 && (
          <div className="mt-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
              {t('wdrvmisc.testing.userTokens', { count: deviceTokens.length })}
            </p>
            <div className="mt-2 space-y-1">
              {deviceTokens.map((tok) => (
                <p key={tok.short} className="font-mono text-[11px] text-surface-500">
                  {tok.short} · {tok.platform}
                </p>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </main>
  );
}
