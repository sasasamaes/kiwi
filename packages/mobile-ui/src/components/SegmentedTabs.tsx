import { Pressable, Text, View } from 'react-native';

/** Tabs de período estilo PWA (Hoy/Ayer/Semana…/rango). */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View className="mb-4 flex-row gap-2 rounded-xl bg-surface-100 p-1 dark:bg-surface-800">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.id)}
            className={`flex-1 rounded-lg py-2.5 ${active ? 'bg-white dark:bg-surface-700' : ''}`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                active
                  ? 'text-surface-800 dark:text-surface-100'
                  : 'text-surface-500 dark:text-surface-400'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
