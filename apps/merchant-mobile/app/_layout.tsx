import '../global.css';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@kiwi/i18n';
import { queryClient } from '../src/query/queryClient';
import { localeStorage } from '../src/i18n/storage';

export default function RootLayout() {
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
