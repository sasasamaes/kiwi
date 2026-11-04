import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, MessageCircle } from 'lucide-react-native';
import { Screen, Button, Card } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { useSession } from '../../src/session/useSession';
import { LanguageButton } from '../../src/i18n/LanguageButton';

// Soporte Kiwi (única fuente de verdad: packages/ui/src/business.ts).
const SUPPORT_WA = 'https://wa.me/50688264007';

export default function Profile() {
  const { t, translate } = useTranslation();
  const { user, signOut } = useSession((s) => s);
  const router = useRouter();

  const ROWS: Array<{ label: string; href: '/(app)/earnings' | '/(app)/kyc' }> = [
    { label: t.earnings.title, href: '/(app)/earnings' },
    { label: t.kyc.title, href: '/(app)/kyc' },
  ];

  return (
    <Screen>
      <View className="mb-4 items-center">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-kiwi-700">
          <Text className="text-2xl font-bold text-white">
            {(user?.driverProfile?.fullName ?? user?.email ?? 'D').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text className="mt-2 text-xl font-bold text-surface-800 dark:text-surface-100">
          {user?.driverProfile?.fullName ?? user?.email}
        </Text>
        <Text className="mt-0.5 text-sm text-surface-500 dark:text-surface-400">{user?.email}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        <Card>
          {ROWS.map((r, i) => (
            <Pressable
              key={r.href}
              accessibilityRole="button"
              onPress={() => router.push(r.href)}
              className={`flex-row items-center justify-between py-3.5 ${i > 0 ? 'border-t border-surface-200/60 dark:border-surface-700' : ''}`}
            >
              <Text className="font-semibold text-surface-800 dark:text-surface-100">
                {r.label}
              </Text>
              <ChevronRight size={20} color="#71717a" />
            </Pressable>
          ))}
        </Card>
        <View className="mt-3">
          <LanguageButton />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const name = user?.driverProfile?.fullName ?? user?.email ?? '';
            const msg = translate('profile.supportMsg', { name });
            void Linking.openURL(`${SUPPORT_WA}?text=${encodeURIComponent(msg)}`);
          }}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5"
        >
          <MessageCircle size={18} color="#fff" />
          <Text className="font-bold text-white">💬 {t.profile.support}</Text>
        </Pressable>
      </ScrollView>

      <View className="mb-2">
        <Button
          label={t.auth.logout}
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
