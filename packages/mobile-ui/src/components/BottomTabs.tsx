import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import type { LucideIcon } from 'lucide-react-native';

/** Bottom tabs par PWA (BottomNav): mismos 7 destinos, estado por ruta. */
export function BottomTabs({
  items,
  active,
  onGo,
}: {
  items: Array<{ route: string; label: string; icon: LucideIcon }>;
  active: string;
  onGo: (route: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const activeColor = dark ? '#4aa3c6' : '#195a77';
  return (
    <View
      className="border-t border-surface-200/50 bg-white/90 dark:border-surface-700/50 dark:bg-surface-900/90"
      style={{ paddingBottom: Math.max(insets.bottom, 4) }}
    >
      <View className="flex-row items-stretch justify-around px-1 py-1.5">
        {items.map((item) => {
          const isActive =
            active === item.route ||
            (item.route !== '/(app)' && active.startsWith(`${item.route}/`));
          const Icon = item.icon;
          return (
            <Pressable
              key={item.route}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={item.label}
              onPress={() => onGo(item.route)}
              className="min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1.5"
            >
              <Icon
                size={20}
                color={isActive ? activeColor : '#71717a'}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text
                numberOfLines={1}
                className={`w-full text-center text-[11px] font-medium leading-tight ${
                  isActive
                    ? 'text-kiwi-700 dark:text-kiwi-400'
                    : 'text-surface-500 dark:text-surface-400'
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
