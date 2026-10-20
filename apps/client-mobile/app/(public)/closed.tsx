import { Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';

// Fuente canónica del contacto: packages/ui/src/business.ts (web).
const WHATSAPP_URL = 'https://wa.me/50688264007';
const WHATSAPP_DISPLAY = '+506 8826 4007';

export default function Closed() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View
          style={{
            backgroundColor: tokens.color.surface,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 6,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: tokens.color.kiwi, fontWeight: '800', fontSize: 11 }}>
            {t.closed.badge.toUpperCase()}
          </Text>
        </View>
        <Text
          style={{
            color: tokens.color.ink,
            fontSize: 24,
            fontWeight: '800',
            textAlign: 'center',
          }}
        >
          {t.closed.title}
        </Text>
        <Text style={{ color: tokens.color.muted, textAlign: 'center', marginTop: 8 }}>
          {t.closed.body}
        </Text>
        <View style={{ marginTop: 16, width: '100%' }}>
          <Button
            label={`${t.closed.whatsapp} · ${WHATSAPP_DISPLAY}`}
            onPress={() => void Linking.openURL(WHATSAPP_URL)}
          />
        </View>
        <View style={{ marginTop: 8, width: '100%' }}>
          <Button
            label={t.customer.login}
            variant="secondary"
            onPress={() => router.push('/(auth)/login')}
          />
        </View>
      </View>
    </Screen>
  );
}
