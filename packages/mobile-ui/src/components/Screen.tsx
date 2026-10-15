import { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.color.canvas }}>
      <View style={{ flex: 1, padding: tokens.space[4] }}>{children}</View>
    </SafeAreaView>
  );
}
