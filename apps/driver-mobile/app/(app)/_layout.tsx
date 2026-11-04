import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  CalendarDays,
  Coins,
  History,
  Home as HomeIcon,
  Moon,
  Package,
  Sun,
  Trophy,
  User,
} from 'lucide-react-native';
import { BottomTabs } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { useColorScheme } from 'nativewind';
import { useSession } from '../../src/session/useSession';
import { OfflineBanner } from '../../src/realtime/OfflineBanner';
import { saveThemeMode } from '../_layout';
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
  const { colorScheme, setColorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  // Foto del perfil: URL (Cloudinary), emoji o inicial — igual que la PWA.
  const isHttpUrl = (s: string) => /^https?:\/\//i.test(s || '');
  const isEmojiImage = (s: string) => /\p{Extended_Pictographic}/u.test(s || '');
  const photoUrl = (user as any)?.driverProfile?.photoUrl as string | undefined;
  const fullName = (user as any)?.driverProfile?.fullName as string | undefined;
  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    setColorScheme(next);
    void saveThemeMode(next);
  };
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
      <View className="flex-row items-center justify-between border-b border-surface-200/50 bg-white/90 px-4 py-3 dark:border-surface-700/50 dark:bg-surface-900/90">
        <Text className="text-base font-bold text-surface-800 dark:text-surface-100">🛵 Kiwi</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dark ? 'Modo claro' : 'Modo oscuro'}
            onPress={toggleTheme}
            className="h-9 w-9 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-700"
          >
            {dark ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color="#52525b" />}
          </Pressable>
          <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-kiwi-700">
            {isHttpUrl(photoUrl || '') ? (
              <Image source={{ uri: photoUrl }} className="h-9 w-9" resizeMode="cover" />
            ) : isEmojiImage(photoUrl || '') ? (
              <Text className="text-lg leading-none">{photoUrl}</Text>
            ) : (
              <Text className="text-sm font-semibold text-white">
                {(fullName ?? 'D').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
        </View>
      </View>
      <Stack screenOptions={{ headerShown: false }} />
      <OfflineBanner />
      <BottomTabs items={items} active={active} onGo={(r) => router.replace(r as any)} />
    </View>
  );
}
