import { Text, View } from 'react-native';
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
  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {businessName}
      </Text>
      <Text style={{ color: tokens.color.muted, marginTop: 4 }}>{user?.email}</Text>
      {phone ? <Text style={{ color: tokens.color.muted, marginTop: 2 }}>{phone}</Text> : null}
      <View style={{ marginTop: 16 }}>
        <LanguageButton />
      </View>
      <View style={{ marginTop: 'auto' }}>
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
