import { ReactNode } from 'react';
import { View } from 'react-native';

/** Card PWA: rounded-2xl bg-white dark:bg-surface-800 con borde sutil. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <View className="rounded-2xl border border-surface-200/60 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
      {children}
    </View>
  );
}
