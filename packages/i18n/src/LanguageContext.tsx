'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { locales, defaultLocale, Locale, TranslationKeys } from './index';
import { getNestedValue, interpolate } from './utils';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
  localeConfig: (typeof locales)[Locale];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    // Load saved locale from localStorage
    const savedLocale = localStorage.getItem('kiwi-locale') as Locale;
    if (savedLocale && locales[savedLocale]) {
      setLocaleState(savedLocale);
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0] as Locale;
      if (locales[browserLang]) {
        setLocaleState(browserLang);
      }
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('kiwi-locale', newLocale);
    document.documentElement.lang = newLocale;
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
