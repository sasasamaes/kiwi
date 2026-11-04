import { Text, View } from 'react-native';

/** Stat par PWA: valor grande + etiqueta (Viajes, Promedio, rating…). */
export function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: 'kiwi' | 'gold';
}) {
  const color =
    accent === 'gold'
      ? 'text-gold-600'
      : accent === 'kiwi'
        ? 'text-kiwi-700 dark:text-kiwi-400'
        : 'text-surface-800 dark:text-surface-100';
  return (
    <View className="rounded-xl border border-surface-200/60 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
      <Text className={`text-center text-2xl font-bold ${color}`}>{value}</Text>
      <Text className="mt-1 text-center text-xs text-surface-500 dark:text-surface-400">
        {label}
      </Text>
    </View>
  );
}
