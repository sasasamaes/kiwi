import { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Estado vacío par PWA (icono + texto). */
export function EmptyState({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <View className="items-center py-8">
      <Text className="text-center text-sm font-medium text-surface-600 dark:text-surface-300">
        {title}
      </Text>
      {hint != null && (
        <Text className="mt-1 text-center text-sm text-surface-500 dark:text-surface-400">
          {hint}
        </Text>
      )}
    </View>
  );
}
