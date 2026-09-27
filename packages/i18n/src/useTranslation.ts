// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

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
   * Get translation with optional interpolation
   */
  const translate = (path: string, variables?: Record<string, string | number>): string => {
    const value = getNestedValue(t, path);

    if (variables) {
      return interpolate(value, variables);
    }

    return value;
  };

  /**
   * Format relative time
   */
  const relativeTime = (date: Date) => formatRelativeTime(date, locale);

  /**
   * Format currency
   */
  const currency = (amount: number, currencyCode?: string) =>
    formatCurrency(amount, locale, currencyCode);

  /**
   * Format number
   */
  const number = (num: number) => formatNumber(num, locale);

  return {
    t,
    locale,
    setLocale,
    translate,
    relativeTime,
    currency,
    number,
  };
}

export default useTranslation;
