import { Pressable, Text } from 'react-native';
import { useLanguage } from '@kiwi/i18n';
import { tokens } from '@kiwi/mobile-ui';

/** Compact ES ⇄ EN toggle for native screens (profile, header, etc.). */
export function LanguageButton() {
  const { locale, setLocale } = useLanguage();
  const next = locale === 'es' ? 'en' : 'es';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locale === 'es' ? 'Switch to English' : 'Cambiar a español'}
      onPress={() => setLocale(next)}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: tokens.color.surface,
        borderWidth: 1,
        borderColor: tokens.color.border,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: tokens.color.ink, fontSize: 12, fontWeight: '700' }}>
        {locale === 'es' ? '🇨🇷 ES · EN' : '🇺🇸 EN · ES'}
      </Text>
    </Pressable>
  );
}
