import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { tokens } from '@kiwi/mobile-ui';
import { useSession } from '../src/session/useSession';

export default function Index() {
  const router = useRouter();
  const { user, hydrated, hydrate } = useSession((s) => s);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    if (hydrated) router.replace(user ? '/(app)/comandas' : '/(auth)/login');
  }, [hydrated, user, router]);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.canvas,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={tokens.color.kiwi} />
    </View>
  );
}
