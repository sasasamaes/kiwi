import { Pressable, Text, View } from 'react-native';

export function QtyStepper({
  value,
  min = 0,
  max = 99,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="disminuir"
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Text className="text-[22px] text-surface-800 dark:text-surface-100">−</Text>
      </Pressable>
      <Text className="min-w-5 text-center text-surface-800 dark:text-surface-100">{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="aumentar"
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <Text className="text-[22px] text-surface-800 dark:text-surface-100">+</Text>
      </Pressable>
    </View>
  );
}
