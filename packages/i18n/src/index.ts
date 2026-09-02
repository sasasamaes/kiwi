/**
 * 🥝 KIWI i18n - Internationalization System
 */

import es from './locales/es';
import en from './locales/en';

export type Locale = 'es' | 'en';
export type TranslationKeys = typeof es;

export const locales = {
  es: { label: 'Español', flag: '🇨🇷', translations: es },
  en: { label: 'English', flag: '🇺🇸', translations: en },
} as const;

export const defaultLocale: Locale = 'es';

export { es, en };

// Re-export everything
export * from './LanguageContext';
export * from './LanguageSwitcher';

export default { es, en, locales, defaultLocale };
