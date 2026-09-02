import { useLanguage } from '@kiwi/i18n';
import { getNestedValue, interpolate, formatRelativeTime, formatCurrency, formatNumber } from '@kiwi/i18n/src/utils';

/**
 * Mobile translation hook
 * 
 * Usage:
 * const { t, locale, setLocale } = useTranslation();
 * 
 * // Simple translation
 * <Text>{t.auth.login}</Text>
 */
export function useTranslation() {
  const { locale, setLocale, t } = useLanguage();

  /**
   * Get translation with optional interpolation
   */
  const translate = (
    path: string,
    variables?: Record<string, string | number>
  ): string => {
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
