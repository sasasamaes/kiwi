/**
 * 🥝 KIWI - Consentimiento de cookies
 *
 * Fuente única de verdad del consentimiento. Persiste en localStorage con
 * la clave `kiwi-cookie-consent` (valores: 'all' | 'necessary' | null).
 *
 * `necessary` cubre sesión, tema, idioma, sonido, deviceId y sync offline
 * (inventario en legal.ts → cookiePolicy). La analítica (PostHog) y el
 * session replay de Sentry solo corren con 'all': analytics.ts consulta
 * `cookieConsent.allowsAnalytics()` antes de inicializar PostHog y sentry.ts
 * usa el mismo gate para replay/setSentryUser. La captura de errores de Sentry
 * sí corre siempre (diagnóstico técnico anonimizado, ver beforeSend).
 */

export type CookieConsentValue = 'all' | 'necessary' | null;

const CONSENT_KEY = 'kiwi-cookie-consent';

function readStored(): CookieConsentValue {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'all' || value === 'necessary' ? value : null;
  } catch {
    return null;
  }
}

export const cookieConsent = {
  /** Decisión guardada, o null si nunca respondió el banner. */
  get(): CookieConsentValue {
    return readStored();
  },

  /** true si falta la decisión (mostrar banner). */
  needsPrompt(): boolean {
    return readStored() === null;
  },

  /** true solo si el usuario aceptó explícitamente la analítica. */
  allowsAnalytics(): boolean {
    return readStored() === 'all';
  },

  /** Guarda la decisión y notifica a los suscriptores. */
  set(value: Exclude<CookieConsentValue, null>) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // storage bloqueado (modo privado): la sesión no persiste y el banner reaparece.
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kiwi:cookie-consent', { detail: value }));
    }
  },
};
