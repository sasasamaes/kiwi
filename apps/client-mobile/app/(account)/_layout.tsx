import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useSession } from '../../src/session/useSession';
import { notificationsApi } from '../../src/api/notifications';
import { http } from '../../src/api/http';
import { registerPush } from '../../src/notifications/register';
import { getDevicePushToken, currentOs } from '../../src/notifications/useNativeToken';

export default function AccountLayout() {
  const { user, hydrated, hydrate } = useSession((s) => s);
  const router = useRouter();
  const pushRegistered = useRef(false);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (hydrated && !user) router.replace('/(auth)/login');
  }, [hydrated, user, router]);

  useEffect(() => {
    if (user && !pushRegistered.current) {
      pushRegistered.current = true;
      void registerPush(notificationsApi(http), getDevicePushToken, currentOs()).catch(() => {});
    }
  }, [user]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
