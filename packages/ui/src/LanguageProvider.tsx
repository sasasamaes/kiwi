'use client';

import React from 'react';
import { LanguageProvider as I18nProvider, useLanguage, useTranslations } from '@kiwi/i18n';
import { LanguageSwitcher, LanguageSwitcherCompact } from '@kiwi/i18n';
import type { Locale, TranslationKeys } from '@kiwi/i18n';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

export { useLanguage, useTranslations, LanguageSwitcher, LanguageSwitcherCompact };
export type { Locale, TranslationKeys };
