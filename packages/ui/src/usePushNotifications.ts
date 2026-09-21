'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { requestNotificationPermission, onMessageListener } from './firebase';
import { api } from './api-client';
import { useAuth } from './AuthContext';
import { playNotificationSound } from './notification-sound';

export type PushFailReason =
  | 'denied'
  | 'unsupported'
  | 'no-push-manager'
  | 'missing-vapid'
  | 'missing-config'
  | 'token-failed'
  | 'sync-failed';

export type PushUnsupportedReason = 'ios-not-installed' | 'ios-old' | 'no-push' | null;

interface UsePushNotificationsOptions {
  enabled?: boolean;
  onNotification?: (notification: any) => void;
}

function failReason(err: unknown): PushFailReason {
  if (err instanceof Error && err.message.startsWith('PUSH:')) {
    const code = err.message.slice(5) as PushFailReason;
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

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const { enabled = true, onNotification } = options;
  const { user, isAuthenticated } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Soporte REAL de push: en iPhone 'Notification' existe en Safari pero el
    // PushManager solo vive en la PWA instalada (Agregar a inicio). Sin ese
    // chequeo el botón se muestra, falla siempre y confunde.
    const ok =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    setIsSupported(ok);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    // iOS no instalado: ni mostrar "Activar" (imposible) → guía de instalación.
    const isIosDevice =
      typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
    const installed =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as any)?.standalone === true);
    setIsIos(isIosDevice);
    setIsInstalled(installed);
    setNeedsInstall(isIosDevice && !installed);
  }, []);

  // Razón por la que NO se puede (para mensaje exacto en UI).
  const unsupportedReason: PushUnsupportedReason = isSupported
    ? null
    : isIos
      ? isInstalled
        ? 'ios-old'
        : 'ios-not-installed'
      : 'no-push';

  // Request permission and register token. Devuelve el motivo exacto para
  // mostrar el paso que falló (permiso vs token vs servidor).
  const requestPermission = useCallback(async (): Promise<{
    ok: boolean;
    reason?: PushFailReason;
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
        } catch (syncErr) {
          console.error('Token ok pero no se registró en el servidor:', syncErr);
          return { ok: false, reason: 'sync-failed' };
        }
      }

      return { ok: true };
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return { ok: false, reason: failReason(error) };
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

      // Suena aunque la app esté abierta (push en foreground no hace ruido solo)
      playNotificationSound('default');

      // Show in-app notification
      if (onNotification) {
        onNotification(payload);
      }

      // Show browser notification if permitted
      if (Notification.permission === 'granted') {
        const notification = new Notification(payload.notification?.title || 'Kiwi', {
          body: payload.notification?.body,
          icon: '/kiwi-icon.png',
          badge: '/kiwi-badge.png',
          data: payload.data,
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
    permission,
    token,
    requestPermission,
    isGranted: permission === 'granted',
  };
}
