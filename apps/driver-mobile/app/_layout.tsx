import '../global.css';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@kiwi/i18n';
import { useColorScheme } from 'nativewind';
import { queryClient } from '../src/query/queryClient';
import { localeStorage } from '../src/i18n/storage';

const THEME_KEY = 'kiwi_theme';

export async function saveThemeMode(mode: 'light' | 'dark') {
  try {
    await SecureStore.setItemAsync(THEME_KEY, mode);
  } catch {
    // Sin almacenamiento: queda solo en memoria.
  }
}

export default function RootLayout() {
  const { setColorScheme } = useColorScheme();
  useEffect(() => {
    let sub: { remove(): void } | undefined;
    void (async () => {
      let saved: string | null = null;
      try {
        saved = await SecureStore.getItemAsync(THEME_KEY);
      } catch {
        saved = null;
      }
      if (saved === 'light' || saved === 'dark') {
        setColorScheme(saved);
        return;
      }
      const apply = (s: string | null | undefined) =>
        setColorScheme(s === 'dark' ? 'dark' : 'light');
      apply(Appearance.getColorScheme());
      sub = Appearance.addChangeListener(({ colorScheme }) => apply(colorScheme));
    })();
    return () => sub?.remove();
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
