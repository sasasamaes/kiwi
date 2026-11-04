import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  CalendarDays,
  Coins,
  History,
  Home as HomeIcon,
  Package,
  Trophy,
  User,
} from 'lucide-react-native';
import { BottomTabs } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { useSession } from '../../src/session/useSession';
import { queue } from '../../src/queue/useQueue';
import { notificationsApi } from '../../src/api/notifications';
import { http } from '../../src/api/client';
import { registerPush } from '../../src/notifications/register';
import { getDevicePushToken, currentOs } from '../../src/notifications/useNativeToken';

export default function AppLayout() {
  const { t } = useTranslation();
  const { user, hydrated } = useSession((s) => s);
  const router = useRouter();
  const segments = useSegments();
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

  const nav = t.wdrvwork.common;
  const items = [
    { route: '/(app)', label: nav.navHome, icon: HomeIcon },
    { route: '/(app)/active', label: nav.navActive, icon: Package },
    { route: '/(app)/ranking', label: nav.navRanking, icon: Trophy },
    { route: '/(app)/history', label: nav.navHistory, icon: History },
    { route: '/(app)/earnings', label: nav.navEarnings, icon: Coins },
    { route: '/(app)/schedule', label: nav.navSchedule, icon: CalendarDays },
    { route: '/(app)/profile', label: nav.navProfile, icon: User },
  ];
  const seg = (segments as string[])[1];
  const active =
    seg == null || seg === 'index' ? '/(app)' : seg === 'order' ? '/(app)/active' : `/(app)/${seg}`;

  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false }} />
      <BottomTabs items={items} active={active} onGo={(r) => router.replace(r as any)} />
    </View>
  );
}
