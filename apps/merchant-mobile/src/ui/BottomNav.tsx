import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { tokens } from '@kiwi/mobile-ui';

const ITEMS: { key: string; label: string; href: Href }[] = [
  { key: 'comandas', label: 'Comandas', href: '/(app)/comandas' },
  { key: 'drivers', label: 'Repartidores', href: '/(app)/drivers' },
  { key: 'notifications', label: 'Avisos', href: '/(app)/notifications' },
  { key: 'profile', label: 'Perfil', href: '/(app)/profile' },
];

export function BottomNav({ active }: { active: string }) {
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: tokens.color.border,
        paddingTop: tokens.space[2],
        marginTop: tokens.space[2],
      }}
    >
      {ITEMS.map((it) => (
        <Pressable
          key={it.key}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          onPress={() => router.push(it.href)}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}
        >
          <Text
            style={{
              color: active === it.key ? tokens.color.kiwi : tokens.color.muted,
              fontWeight: '600',
              fontSize: 12,
            }}
          >
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
