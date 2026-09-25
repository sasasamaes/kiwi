'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  requestNotificationPermission,
  onMessageListener,
  cleanupLegacyMessagingSW,
} from './firebase';
import { api } from './api-client';
import { useAuth } from './AuthContext';
import { playNotificationSound } from './notification-sound';
import { buildNotificationKey, shouldNotify } from './notification-dedupe';

export type PushFailReason =
  | 'denied'
  | 'unsupported'
  | 'no-push-manager'
  | 'missing-vapid'
  | 'missing-config'
  | 'token-failed'
  | 'sync-failed';

export type PushUnsupportedReason =
  'ios-not-installed' | 'ios-old' | 'ios-push-unavailable' | 'no-push' | null;

/** Versión real de iOS parseada del userAgent. null = no iOS o no detectable. */
export interface IosVersion {
  major: number;
  minor: number;
}

/** Diagnóstico crudo del device para debuggear falsos "no soportado". */
export interface PushDebug {
  hasNotification: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  permission: string;
  standaloneMatch: boolean;
  navigatorStandalone: unknown;
  iosVersion: string;
  userAgent: string;
  /** SWs instalados en ESTE contexto (script + scope): el viejo duplicado se ve acá. */
  swRegistrations: Array<{ script: string; scope: string }>;
}

function parseIosVersion(ua: string): IosVersion | null {
  // iPhone OS 16_4, iPhone OS 26_7, CPU OS 17_2, etc.
  const m = ua.match(/OS (\d+)[_.](\d+)?/);
  if (/iPhone|iPad|iPod/.test(ua) && m) {
    return { major: Number(m[1]), minor: Number(m[2] ?? 0) };
  }
  return null;
}

function isIosDeviceUA(ua: string): boolean {
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS en modo escritorio se reporta como Macintosh + touch.
  if (
    /Macintosh/.test(ua) &&
    typeof navigator !== 'undefined' &&
    (navigator as any).maxTouchPoints > 1
  ) {
    return true;
  }
  return false;
}

interface UsePushNotificationsOptions {
  enabled?: boolean;
  onNotification?: (notification: any) => void;
}

function failReason(err: unknown): PushFailReason {
  if (err instanceof Error && err.message.startsWith('PUSH:')) {
    const code = err.message.slice(5).split('|')[0] as PushFailReason;
    if (
      code === 'denied' ||
      code === 'unsupported' ||
      code === 'no-push-manager' ||
      code === 'missing-vapid' ||
      code === 'missing-config' ||
      code === 'token-failed'
    ) {
      return code;
    }
  }
  return 'token-failed';
}

/** Detalle técnico tras '|' (ej. error real de FCM) para diagnóstico en UI. */
function failDetail(err: unknown): string | undefined {
  if (err instanceof Error && err.message.startsWith('PUSH:')) {
    const parts = err.message.slice(5).split('|');
    // Sin recorte agresivo: el motivo real de FCM viene al final del mensaje.
    if (parts.length > 1) return parts.slice(1).join('|').slice(0, 600);
    return undefined;
  }
  if (err instanceof Error && err.message) return err.message.slice(0, 600);
  return undefined;
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const { enabled = true, onNotification } = options;
  const { user, isAuthenticated } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [iosVersion, setIosVersion] = useState<IosVersion | null>(null);
  const [pushDebug, setPushDebug] = useState<PushDebug | null>(null);

  const refreshSwList = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
      const regs = await navigator.serviceWorker.getRegistrations();
      const list = regs.map((r) => ({
        script: (r.active?.scriptURL ?? r.installing?.scriptURL ?? '?').split('/').pop() ?? '?',
        scope: (() => {
          try {
            return new URL(r.scope).pathname;
          } catch {
            return r.scope;
          }
        })(),
      }));
      setPushDebug((prev) => (prev ? { ...prev, swRegistrations: list } : prev));
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    // SW legacy con scope '/' duplica cada push en este celu aunque el
    // servidor mande uno solo. Corre siempre, haya o no permiso.
    void cleanupLegacyMessagingSW().then(() => void refreshSwList());
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
    const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    // PushManager en window es el chequeo flaky en iOS: puede faltar aun con
    // PWA instalada y push real funcionando (el subscribe vive en el SW
    // registration). NO bloquear por esto: dejar intentar y que el error
    // exacto salga de requestPermission (PUSH:no-push-manager).
    const hasPushManager = typeof window !== 'undefined' && 'PushManager' in window;
    const ok = hasNotification && hasServiceWorker;
    setIsSupported(ok);
    if (hasNotification) {
      setPermission(Notification.permission);
    }
    // iOS no instalado: ni mostrar "Activar" (imposible) → guía de instalación.
    const isIosDevice = isIosDeviceUA(ua);
    const installed =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as any)?.standalone === true);
    const ver = isIosDevice ? parseIosVersion(ua) : null;
    setIsIos(isIosDevice);
    setIsInstalled(installed);
    setIosVersion(ver);
    setNeedsInstall(isIosDevice && !installed);
    const dbg: PushDebug = {
      hasNotification,
      hasServiceWorker,
      hasPushManager,
      permission: hasNotification ? Notification.permission : 'n/a',
      standaloneMatch:
        typeof window !== 'undefined'
          ? !!window.matchMedia?.('(display-mode: standalone)').matches
          : false,
      navigatorStandalone: (navigator as any)?.standalone,
      iosVersion: ver ? `${ver.major}.${ver.minor}` : 'n/a',
      userAgent: ua,
      swRegistrations: [],
    };
    setPushDebug(dbg);
    console.log('[push-debug]', JSON.stringify(dbg));
  }, []);

  const isOldIos =
    !!iosVersion && (iosVersion.major < 16 || (iosVersion.major === 16 && iosVersion.minor < 4));

  // Razón por la que NO se puede (para mensaje exacto en UI).
  // OJO: nunca inferir "viejo" por falta de PushManager — se chequea la
  // versión real. Y un iOS viejo se detecta por versión, no por capabilities.
  const unsupportedReason: PushUnsupportedReason = (() => {
    if (isIos && isInstalled && isOldIos) return 'ios-old';
    if (isSupported) return null;
    if (!isIos) return 'no-push';
    if (!isInstalled) return 'ios-not-installed';
    // Instalado y versión nueva (o desconocida) pero sin Notification/SW:
    // no mentir con "actualizá", es otro bloqueo.
    return 'ios-push-unavailable';
  })();

  // Request permission and register token. Devuelve el motivo exacto para
  // mostrar el paso que falló (permiso vs token vs servidor) más detalle
  // técnico cuando existe (error real de FCM tras getToken).
  const requestPermission = useCallback(async (): Promise<{
    ok: boolean;
    reason?: PushFailReason;
    detail?: string;
  }> => {
    if (!isSupported) {
      console.log('Notifications not supported');
      return { ok: false, reason: 'unsupported' };
    }

    try {
      const fcmToken = await requestNotificationPermission();

      setToken(fcmToken);
      setPermission('granted');

      // Register token with backend (no fatal: si el servidor falla, el
      // token local existe pero el push no llega → avisar, no mentir éxito).
      if (isAuthenticated && user) {
        const platform = /iPhone|iPad|iPod/.test(navigator.userAgent)
          ? 'ios'
          : /Android/.test(navigator.userAgent)
            ? 'android'
            : 'web';

        try {
          await api.registerDeviceToken(fcmToken, platform);
          // Rotación de token: cada reactivación o cambio de scope genera un
          // token NUEVO y el viejo queda en la BD → el backend manda el mismo
          // pedido a todos (banners duplicados). Se borra el anterior de ESTE
          // celu (guardado en localStorage); otros dispositivos no se tocan.
          try {
            const prev = localStorage.getItem('kiwi-fcm-token');
            if (prev && prev !== fcmToken) {
              await api.removeDeviceToken(prev).catch(() => undefined);
            }
            localStorage.setItem('kiwi-fcm-token', fcmToken);
          } catch {
            // localStorage privado/bloqueado: no bloquea la activación
          }
        } catch (syncErr) {
          console.error('Token ok pero no se registró en el servidor:', syncErr);
          return { ok: false, reason: 'sync-failed' };
        }
      }

      return { ok: true };
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return { ok: false, reason: failReason(error), detail: failDetail(error) };
    }
  }, [isSupported, isAuthenticated, user]);

  // Si el permiso YA estaba dado (ej. desde ajustes del celu) pero nunca se
  // obtuvo token, registrarlo solo una vez al montar.
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoTried.current) return;
    if (!isSupported || permission !== 'granted' || token) return;
    autoTried.current = true;
    requestPermission().catch(() => undefined);
  }, [isSupported, permission, token, requestPermission]);

  // Listen for foreground messages
  useEffect(() => {
    if (!enabled || !isSupported || permission !== 'granted') return;

    const unsubscribePromise = onMessageListener((payload) => {
      console.log('Foreground notification:', payload);

      // Dedupe: el mismo evento suele llegar por socket + push a la vez.
      // Sin esto cada acción suena/muestra 2-3 veces.
      const key = buildNotificationKey({
        type: payload?.data?.type,
        orderId: payload?.data?.orderId,
        status: payload?.data?.status,
      });
      if (!shouldNotify(key)) return;

      // Suena aunque la app esté abierta (push en foreground no hace ruido solo)
      playNotificationSound('default');

      // Show in-app notification
      if (onNotification) {
        onNotification(payload);
      }

      // Banner del sistema solo con la pestaña oculta: con la app visible el
      // popup del socket ya avisa (sin esto cada pedido alerta 2-3 veces:
      // popup + banner + push del SW). tag = colapsa reintentos del pedido.
      if (Notification.permission === 'granted' && document.hidden) {
        const notification = new Notification(payload.notification?.title || 'Kiwi', {
          body: payload.notification?.body,
          icon: '/icon.png',
          badge: '/icon.png',
          data: payload.data,
          tag: payload.data?.orderId ?? 'kiwi-notification',
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    });

    return () => {
      unsubscribePromise.then((unsubscribe) => unsubscribe?.());
    };
  }, [enabled, isSupported, permission, onNotification]);

  return {
    isSupported,
    /** iPhone en Safari (no instalada): el push es imposible, hay que instalar. */
    needsInstall,
    /** Por qué no se puede (null = se puede intentar). */
    unsupportedReason,
    isIos,
    isInstalled,
    iosVersion,
    pushDebug,
    permission,
    token,
    requestPermission,
    isGranted: permission === 'granted',
  };
}
