import { Text, View } from 'react-native';

/** Mini gráfica de barras diarias (par PWA): View puros, sin dependencias. */
export function DailyBars({
  daily,
  formatDay,
}: {
  daily: Array<{ date: string; amount: number }>;
  formatDay: (date: string) => string;
}) {
  const max = Math.max(...daily.map((d) => Number(d.amount) || 0), 1);
  return (
    <View className="h-32 flex-row items-end gap-1">
      {daily.map((day) => {
        const value = Number(day.amount) || 0;
        return (
          <View key={day.date} className="flex-1 items-center">
            <View className="h-24 w-full items-center justify-end">
              <View
                className="w-full rounded-t-lg bg-kiwi-700"
                style={{ height: `${Math.max((value / max) * 100, value > 0 ? 6 : 0)}%` }}
              />
            </View>
            <Text className="mt-1 text-[10px] text-surface-500 dark:text-surface-400">
              {formatDay(day.date)}
            </Text>
            <Text className="text-[10px] font-medium text-surface-600 dark:text-surface-300">
              ₡{Math.round(value).toLocaleString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
