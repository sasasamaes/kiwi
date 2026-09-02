/**
 * 🥝 KIWI i18n - Utility Functions
 */

import { TranslationKeys } from './index';

/**
 * Get nested value from object using dot notation
 * Example: getNestedValue(obj, 'auth.login')
 */
export function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj) || path;
}

/**
 * Interpolate variables in translation string
 * Example: interpolate('Hello {{name}}', { name: 'World' }) => 'Hello World'
 */
export function interpolate(
  template: string,
  variables: Record<string, string | number>
): string {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), String(value)),
    template
  );
}

/**
 * Create a translation function for a specific namespace
 * Example: const t = createTranslator(translations, 'auth');
 *          t('login') => translations.auth.login
 */
export function createTranslator(
  translations: TranslationKeys,
  namespace?: string
) {
  return (key: string, variables?: Record<string, string | number>): string => {
    const path = namespace ? `${namespace}.${key}` : key;
    const value = getNestedValue(translations, path);
    
    if (variables) {
      return interpolate(value, variables);
    }
    
    return value;
  };
}

/**
 * Format relative time based on locale
 */
export function formatRelativeTime(
  date: Date,
  locale: 'es' | 'en'
): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return locale === 'es' ? 'Ahora' : 'Now';
  }
  
  if (minutes < 60) {
    return locale === 'es' 
      ? `hace ${minutes} min`
      : `${minutes} min ago`;
  }
  
  if (hours < 24) {
    return locale === 'es'
      ? `hace ${hours}h`
      : `${hours}h ago`;
  }
  
  if (days < 7) {
    return locale === 'es'
      ? `hace ${days} días`
      : `${days} days ago`;
  }
  
  return date.toLocaleDateString(locale === 'es' ? 'es-CR' : 'en-US');
}

/**
 * Format currency based on locale
 */
export function formatCurrency(
  amount: number,
  locale: 'es' | 'en',
  currency: string = 'CRC'
): string {
  const formatter = new Intl.NumberFormat(locale === 'es' ? 'es-CR' : 'en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  
  return formatter.format(amount);
}

/**
 * Format number based on locale
 */
export function formatNumber(
  number: number,
  locale: 'es' | 'en'
): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-CR' : 'en-US').format(number);
}
