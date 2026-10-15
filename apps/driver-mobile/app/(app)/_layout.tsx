import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useSession } from '../../src/session/useSession';
import { queue } from '../../src/queue/useQueue';
import { notificationsApi } from '../../src/api/notifications';
import { http } from '../../src/api/client';
import { registerPush } from '../../src/notifications/register';
import { getDevicePushToken, currentOs } from '../../src/notifications/useNativeToken';

export default function AppLayout() {
  const { user, hydrated } = useSession((s) => s);
  const router = useRouter();
  const pushRegistered = useRef(false);
  useEffect(() => {
    if (hydrated && !user) router.replace('/(auth)/login');
  }, [hydrated, user, router]);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void queue.flush();
    });
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (user?.role === 'driver' && !pushRegistered.current) {
      pushRegistered.current = true;
      void registerPush(notificationsApi(http), getDevicePushToken, currentOs()).catch(() => {});
    }
  }, [user]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
