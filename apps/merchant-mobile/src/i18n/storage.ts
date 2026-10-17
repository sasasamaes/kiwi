import * as SecureStore from 'expo-secure-store';
import type { LocaleStorage } from '@kiwi/i18n';
import type { Locale } from '@kiwi/i18n';

const KEY = 'kiwi_merchant_locale';

export const localeStorage: LocaleStorage = {
  getLocale: async () => {
    try {
      const v = await SecureStore.getItemAsync(KEY);
      return v === 'es' || v === 'en' ? (v as Locale) : null;
    } catch {
      return null;
    }
  },
  setLocale: async (locale: Locale) => {
    try {
      await SecureStore.setItemAsync(KEY, locale);
    } catch {
      // in-memory fallback (provider still works)
    }
  },
};
