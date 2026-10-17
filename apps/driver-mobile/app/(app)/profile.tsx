import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { useSession } from '../../src/session/useSession';
import { LanguageButton } from '../../src/i18n/LanguageButton';

export default function Profile() {
  const { t } = useTranslation();
  const { user, signOut } = useSession((s) => s);
  const router = useRouter();
  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {user?.driverProfile?.fullName ?? user?.email}
      </Text>
      <Text style={{ color: tokens.color.muted, marginTop: 4 }}>{user?.email}</Text>
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
    </Screen>
  );
}
