// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useCallback, useMemo } from 'react';
import { useLanguage } from './LanguageContext';
import {
  getNestedValue,
  interpolate,
  formatRelativeTime,
  formatCurrency,
  formatNumber,
} from './utils';

/**
 * Main translation hook
 *
 * Usage:
 * const { t, locale, setLocale } = useTranslation();
 *
 * // Simple translation
 * <Text>{t.auth.login}</Text>
 *
 * // With variables
 * <Text>{t.time.minutesAgo({ count: 5 })}</Text>
 */
export function useTranslation() {
  const { locale, setLocale, t } = useLanguage();

  /**
   * Get translation with optional interpolation (memoized: safe in deps).
   */
  const translate = useCallback(
    (path: string, variables?: Record<string, string | number>): string => {
      const value = getNestedValue(t, path);

      if (variables) {
        return interpolate(value, variables);
      }

      return value;
    },
    [t],
  );

  /**
   * Format relative time
   */
  const relativeTime = useCallback((date: Date) => formatRelativeTime(date, locale), [locale]);

  /**
   * Format currency
   */
  const currency = useCallback(
    (amount: number, currencyCode?: string) => formatCurrency(amount, locale, currencyCode),
    [locale],
  );

  /**
   * Format number
   */
  const number = useCallback((num: number) => formatNumber(num, locale), [locale]);

  return useMemo(
    () => ({
      t,
      locale,
      setLocale,
      translate,
      relativeTime,
      currency,
      number,
    }),
    [t, locale, setLocale, translate, relativeTime, currency, number],
  );
}

export default useTranslation;
