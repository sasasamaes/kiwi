import { useState } from 'react';
import { Pressable, TextInput, Text, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { useSession } from '../../src/session/useSession';

const inputCls =
  'rounded-xl bg-white border border-surface-200 px-3.5 py-3.5 text-surface-800 dark:bg-surface-800 dark:border-surface-700 dark:text-surface-100';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const signIn = useSession((s) => s.signIn);
  const router = useRouter();
  return (
    <Screen>
      <View className="mt-8 gap-4">
        <View>
          <Text className="text-2xl font-bold text-surface-800 dark:text-surface-100">
            {t.driverAuth.loginTitle}
          </Text>
          <Text className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            Kiwi Repartidor 🛵
          </Text>
        </View>
        <TextInput
          placeholder="tu@email.com"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="email"
          className={inputCls}
        />
        <TextInput
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="password"
          className={inputCls}
        />
        <Button
          label={t.auth.login}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await signIn(email.trim(), password);
              router.replace('/(app)');
            } catch {
              Alert.alert(t.driverAuth.loginFailed);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Pressable onPress={() => router.push('/(auth)/register')} className="mt-1">
          <Text className="text-center font-semibold text-kiwi-700 dark:text-kiwi-400">
            {t.driverRegister.noAccount}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
