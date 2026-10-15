import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '../../src/session/useSession';

export default function AppLayout() {
  const { user, hydrated } = useSession((s) => s);
  const router = useRouter();
  useEffect(() => {
    if (hydrated && !user) router.replace('/(auth)/login');
  }, [hydrated, user, router]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
