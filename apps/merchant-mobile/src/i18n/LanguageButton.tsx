import { Pressable, Text } from 'react-native';
import { useLanguage } from '@kiwi/i18n';

/** Compact ES ⇄ EN toggle for native screens (profile, header, etc.). */
export function LanguageButton() {
  const { locale, setLocale } = useLanguage();
  const next = locale === 'es' ? 'en' : 'es';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locale === 'es' ? 'Switch to English' : 'Cambiar a español'}
      onPress={() => setLocale(next)}
      className="self-start rounded-full border border-surface-200 bg-white px-2.5 py-1.5 dark:border-surface-700 dark:bg-surface-800"
    >
      <Text className="text-xs font-bold text-surface-800 dark:text-surface-100">
        {locale === 'es' ? '🇨🇷 ES · EN' : '🇺🇸 EN · ES'}
      </Text>
    </Pressable>
  );
}
