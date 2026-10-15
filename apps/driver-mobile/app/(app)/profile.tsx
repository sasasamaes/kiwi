import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useSession } from '../../src/session/useSession';

export default function Profile() {
  const { user, signOut } = useSession((s) => s);
  const router = useRouter();
  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {user?.driverProfile?.fullName ?? user?.email}
      </Text>
      <Text style={{ color: tokens.color.muted, marginTop: 4 }}>{user?.email}</Text>
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
    </Screen>
  );
}
