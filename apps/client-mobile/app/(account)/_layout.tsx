import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useSession } from '../../src/session/useSession';

export default function AccountLayout() {
  const { user, hydrated, hydrate } = useSession((s) => s);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (hydrated && !user) router.replace('/(auth)/login');
  }, [hydrated, user, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
