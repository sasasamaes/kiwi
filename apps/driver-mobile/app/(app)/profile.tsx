import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { useSession } from '../../src/session/useSession';
import { LanguageButton } from '../../src/i18n/LanguageButton';

export default function Profile() {
  const { t } = useTranslation();
  const { user, signOut } = useSession((s) => s);
  const router = useRouter();

  const ROWS: Array<{ label: string; href: '/(app)/earnings' | '/(app)/kyc' }> = [
    { label: t.earnings.title, href: '/(app)/earnings' },
    { label: t.kyc.title, href: '/(app)/kyc' },
  ];

  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {user?.driverProfile?.fullName ?? user?.email}
      </Text>
      <Text style={{ color: tokens.color.muted, marginTop: 4 }}>{user?.email}</Text>

      <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 16 }}>
        {ROWS.map((r) => (
          <Pressable
            key={r.href}
            accessibilityRole="button"
            onPress={() => router.push(r.href)}
            style={{
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.md,
              padding: 14,
              marginBottom: 8,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: tokens.color.ink, fontWeight: '600' }}>{r.label}</Text>
            <Text style={{ color: tokens.color.muted }}>›</Text>
          </Pressable>
        ))}
        <View style={{ marginTop: 8 }}>
          <LanguageButton />
        </View>
      </ScrollView>

      <View style={{ marginBottom: 8 }}>
        <Button
          label={t.auth.logout}
          variant="danger"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
        />
      </View>
    </Screen>
  );
}
