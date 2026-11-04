import '../global.css';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@kiwi/i18n';
import { useColorScheme } from 'nativewind';
import { queryClient } from '../src/query/queryClient';
import { localeStorage } from '../src/i18n/storage';

export default function RootLayout() {
  const { setColorScheme } = useColorScheme();
  useEffect(() => {
    const apply = (s: string | null | undefined) => setColorScheme(s === 'dark' ? 'dark' : 'light');
    apply(Appearance.getColorScheme());
    const sub = Appearance.addChangeListener(({ colorScheme }) => apply(colorScheme));
    return () => sub.remove();
  }, [setColorScheme]);
  return (
    <LanguageProvider storage={localeStorage}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}
