import { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-[#fbf8f2] dark:bg-[#0b1326]">
      <View className="flex-1 px-4 pb-28 pt-6">{children}</View>
    </SafeAreaView>
  );
}
