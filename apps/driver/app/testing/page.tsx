// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FlaskConical } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { useAuth, usePushNotifications, api, TapButton, KiwiLoader } from '@kiwi/ui';

/** Mensaje exacto según el paso que falló (permiso vs token vs servidor). */
function pushErrorMessage(reason?: string): string {
  switch (reason) {
    case 'denied':
      return 'No se pudieron activar las alertas. Revisá el permiso en tu navegador.';
    case 'no-push-manager':
    case 'unsupported':
      return 'Este navegador no soporta alertas. Probá con Chrome o instalando la app.';
    case 'missing-vapid':
    case 'missing-config':
      return 'Falta configuración del servidor para alertas. Avisanos por WhatsApp.';
    case 'sync-failed':
      return 'Se activó en el celu pero no llegó al servidor. Revisá tu conexión y reintentá.';
    case 'token-failed':
      return 'No se pudo registrar este celu para alertas. Revisá tu conexión y reintentá.';
    default:
      return 'No se pudo completar la activación. Reintentá con buena conexión.';
  }
}

export default function TestingPage() {
  const router = useRouter();
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
            <span className="text-sm font-medium">Perfil</span>
          </Link>
          <h1 className="flex items-center gap-2 font-display font-semibold text-surface-800 dark:text-surface-100">
            <FlaskConical className="h-5 w-5" /> Pruebas
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
        <div className="mb-4 rounded-2xl glass p-4">
          <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
            Probar notificaciones
          </p>
          {pushTest ? (
            <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">{pushTest}</p>
          ) : (
            <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
              ¿No te llegan? Probá ahora y te decimos dónde se corta.
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
                  setPushTest('El servidor no tiene push configurado. Avisanos por WhatsApp.');
                } else if (r.tokens === 0) {
                  setPushTokenMissing(true);
                  setPushTest('Este celu no registró token: tocá Reactivar abajo.');
                } else {
                  setPushTokenMissing(false);
                  void refreshDeviceTokens();
                  const bad = r.results.filter((x) => !x.ok);
                  setPushTest(
                    bad.length === 0
                      ? `Prueba enviada ${r.sent ?? 1} vez a este celu. Si ves 2 banners, el duplicado está en el celu.`
                      : `Falló el envío (${bad[0]?.error ?? 'error'}). Reinstalá la app y reactivá.`,
                  );
                }
              } catch {
                setPushTest('No se pudo probar. Revisá tu conexión.');
              } finally {
                setPushTesting(false);
              }
            }}
          >
            {pushTesting ? 'Probando…' : 'Probar alerta'}
          </TapButton>
          {pushDebug?.swRegistrations && pushDebug.swRegistrations.length > 0 && (
            <p className="mt-2 text-[11px] text-surface-400">
              SW: {pushDebug.swRegistrations.map((s) => `${s.script}@${s.scope}`).join(' · ')}
            </p>
          )}
          {/* Registros duplicados: si hay más de 1, cada push llega N veces */}
          {deviceTokens.length > 1 && (
            <div className="mt-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-3 py-2">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Tenés {deviceTokens.length} registros (
                {deviceTokens.map((t) => t.platform).join(', ')}): cada alerta te llega{' '}
                {deviceTokens.length} veces.
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
                        ? `Borramos ${r.removed} registro(s) viejo(s). Probá de nuevo.`
                        : 'Ya hay un solo registro. Probá de nuevo.',
                    );
                    await refreshDeviceTokens();
                  } catch {
                    setPushTest('No se pudo limpiar. Revisá tu conexión.');
                  } finally {
                    setPruningTokens(false);
                  }
                }}
              >
                {pruningTokens ? 'Limpiando…' : 'Limpiar duplicados'}
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
                    setPushTest('Token registrado. Tocá Probar alerta de nuevo.');
                    void refreshDeviceTokens();
                  } else {
                    setPageError(pushErrorMessage(res.reason));
                  }
                } finally {
                  setPushBusy(false);
                }
              }}
            >
              {pushBusy ? 'Reactivando…' : 'Reactivar alertas'}
            </TapButton>
          )}
        </div>

        {/* Diagnóstico técnico */}
        {pushDebug && (
          <details className="rounded-2xl glass p-4 text-xs text-surface-500 dark:text-surface-400">
            <summary className="font-semibold">Diagnóstico</summary>
            <pre className="mt-1 whitespace-pre-wrap break-all">
              {JSON.stringify(pushDebug, null, 1)}
            </pre>
          </details>
        )}

        {deviceTokens.length > 0 && (
          <div className="mt-4 rounded-2xl glass p-4">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
              Registros de este usuario ({deviceTokens.length})
            </p>
            <div className="mt-2 space-y-1">
              {deviceTokens.map((t) => (
                <p key={t.short} className="font-mono text-[11px] text-surface-500">
                  {t.short} · {t.platform}
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
