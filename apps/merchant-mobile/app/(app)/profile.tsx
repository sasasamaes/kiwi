import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useSession } from '../../src/session/useSession';
import { BottomNav } from '../../src/ui/BottomNav';

export default function Profile() {
  const { user, signOut } = useSession((s) => s);
  const router = useRouter();
  const businessName = user?.merchantProfile?.businessName ?? user?.fullName ?? 'Mi negocio';
  const phone = user?.phone ?? user?.merchantProfile?.phone ?? '';
  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {businessName}
      </Text>
      <Text style={{ color: tokens.color.muted, marginTop: 4 }}>{user?.email}</Text>
      {phone ? <Text style={{ color: tokens.color.muted, marginTop: 2 }}>{phone}</Text> : null}
      <View style={{ marginTop: 'auto' }}>
        <Button
          label="Cerrar sesión"
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
