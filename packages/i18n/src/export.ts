// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * 🥝 KIWI i18n - Exports
 */

// Core
export { locales, defaultLocale } from './index';
export type { Locale, TranslationKeys } from './index';

// Context & Hooks
export { LanguageProvider, useLanguage, useTranslations } from './LanguageContext';

// Components
export { LanguageSwitcher, LanguageSwitcherCompact } from './LanguageSwitcher';

// Translations
export { es, en } from './index';
