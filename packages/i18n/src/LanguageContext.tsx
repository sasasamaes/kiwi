// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { locales, defaultLocale, Locale, TranslationKeys } from './index';
import { getNestedValue, interpolate } from './utils';

/**
 * Storage adapter so the provider works on web (localStorage)
 * and on React Native / Expo (e.g. expo-secure-store).
 *
 * Web default is used automatically when no storage is provided
 * and `window.localStorage` exists. On native, pass a storage
 * backed by SecureStore/AsyncStorage, or omit for in-memory only.
 */
export interface LocaleStorage {
  getLocale: () => Promise<Locale | null> | Locale | null;
  setLocale: (locale: Locale) => Promise<void> | void;
}

function webStorage(): LocaleStorage | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null;
  return {
    getLocale: () => {
      try {
        const saved = window.localStorage.getItem('kiwi-locale') as Locale | null;
        return saved && locales[saved] ? saved : null;
      } catch {
        return null;
      }
    },
    setLocale: (locale: Locale) => {
      try {
        window.localStorage.setItem('kiwi-locale', locale);
      } catch {
        // storage unavailable (private mode, etc.) — locale still works in memory
      }
    },
  };
}

function detectBrowserLocale(): Locale | null {
  if (typeof navigator === 'undefined' || !navigator.language) return null;
  const browserLang = navigator.language.split('-')[0] as Locale;
  return locales[browserLang] ? browserLang : null;
}

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
  localeConfig: (typeof locales)[Locale];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
  /** Force an initial locale (useful on native where detection is custom). */
  initialLocale?: Locale;
  /** Custom storage (SecureStore/AsyncStorage on native). Defaults to localStorage on web. */
  storage?: LocaleStorage;
  /** Custom device-locale detection (e.g. expo-localization). Defaults to navigator on web. */
  detectLocale?: () => Locale | null;
}

export function LanguageProvider({
  children,
  initialLocale,
  storage,
  detectLocale,
}: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? defaultLocale);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const store = storage ?? webStorage();
      if (store) {
        try {
          const saved = await store.getLocale();
          if (!cancelled && saved && locales[saved]) {
            setLocaleState(saved);
            return;
          }
        } catch {
          // fall through to detection
        }
      }
      const detected = detectLocale ? detectLocale() : detectBrowserLocale();
      if (!cancelled && detected && locales[detected] && detected !== initialLocale) {
        setLocaleState(detected);
      }
    };
    if (!initialLocale) void resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    const store = storage ?? webStorage();
    try {
      void store?.setLocale(newLocale);
    } catch {
      // in-memory fallback
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = newLocale;
    }
  };

  const value: LanguageContextType = {
    locale,
    setLocale,
    t: locales[locale].translations,
    localeConfig: locales[locale],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Helper hook for translations
// Returns a translate function that resolves flat dot-path keys, e.g. t('traffic.free')
export function useTranslations() {
  const { t, locale } = useLanguage();

  const translate = (key: string, variables?: Record<string, string | number>): string => {
    const value = getNestedValue(t, key);
    if (variables) {
      return interpolate(value, variables);
    }
    return value;
  };

  return { t: translate, locale };
}
