import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { useSession } from '../../src/session/useSession';
import { BottomNav } from '../../src/ui/BottomNav';
import { LanguageButton } from '../../src/i18n/LanguageButton';

export default function Profile() {
  const { t } = useTranslation();
  const { user, signOut } = useSession((s) => s);
  const router = useRouter();
  const businessName = user?.merchantProfile?.businessName ?? user?.fullName ?? t.merchant.title;
  const phone = user?.phone ?? user?.merchantProfile?.phone ?? '';

  const ROWS: Array<{
    label: string;
    href:
      | '/(app)/business'
      | '/(app)/credits'
      | '/(app)/analytics'
      | '/(app)/announce'
      | '/(app)/kyc'
      | '/(app)/notifications';
  }> = [
    { label: t.merchantProfile.title, href: '/(app)/business' },
    { label: t.credits.title, href: '/(app)/credits' },
    { label: t.analytics.merchantTitle, href: '/(app)/analytics' },
    { label: t.announce.title, href: '/(app)/announce' },
    { label: t.kyc.title, href: '/(app)/kyc' },
    { label: t.merchantNotifications.title, href: '/(app)/notifications' },
  ];

  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {businessName}
      </Text>
      <Text style={{ color: tokens.color.muted, marginTop: 4 }}>{user?.email}</Text>
      {phone ? <Text style={{ color: tokens.color.muted, marginTop: 2 }}>{phone}</Text> : null}

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
      <BottomNav active="profile" />
    </Screen>
  );
}
