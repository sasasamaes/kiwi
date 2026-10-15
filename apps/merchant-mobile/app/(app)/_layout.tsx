import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../src/session/useSession';
import { notificationsApi } from '../../src/api/notifications';
import { http } from '../../src/api/client';
import { registerPush } from '../../src/notifications/register';
import { getDevicePushToken, currentOs } from '../../src/notifications/useNativeToken';
import { useOrdersRealtime } from '../../src/realtime/useOrdersRealtime';
import { useKeepAwake } from '../../src/kds/useKeepAwake';
import { useBoard } from '../../src/comanda/boardStore';

export default function AppLayout() {
  const { user, hydrated } = useSession((s) => s);
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const pushRegistered = useRef(false);

  // Guard: bounce to login once hydration says there is no session.
  useEffect(() => {
    if (hydrated && !user) router.replace('/(auth)/login');
  }, [hydrated, user, router]);

  // Reconnecting refills the board: sockets miss events while the radio was
  // down, so revalidate the fallback query as soon as connectivity returns.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void qc.invalidateQueries({ queryKey: ['orders', 'incoming'] });
    });
    return () => unsubscribe();
  }, [qc]);

  // Device token is registered exactly once per session.
  useEffect(() => {
    if (user && !pushRegistered.current) {
      pushRegistered.current = true;
      void registerPush(notificationsApi(http), getDevicePushToken, currentOs()).catch(() => {});
    }
  }, [user]);

  // KDS tablets must not sleep while the comandas tab is foregrounded.
  useKeepAwake(pathname.includes('comandas'));

  // Single socket for the app: feeds the board reducer and revalidates the
  // queries the screens read from.
  useOrdersRealtime({
    enabled: !!user,
    onEvent: (e) => {
      useBoard.getState().dispatch({ type: e.type, order: e.order });
      void qc.invalidateQueries({ queryKey: ['orders', 'incoming'] });
      if (e.order?.id) void qc.invalidateQueries({ queryKey: ['order', e.order.id] });
    },
  });

  return <Stack screenOptions={{ headerShown: false }} />;
}
