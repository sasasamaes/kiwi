import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { Field, Header, ui } from '../../src/components/ui';
import { useSession } from '../../src/session/useSession';

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/(account)/orders');
    } catch {
      setError(t.auth.loginFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={t.auth.login} />
      <View style={{ marginTop: tokens.space[6] }}>
        <Field
          label={t.auth.email}
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label={t.auth.password}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />
        {!!error && <Text style={{ color: tokens.color.danger }}>{error}</Text>}
        <View style={{ marginTop: 12 }}>
          <Button label={t.auth.login} loading={busy} onPress={() => void submit()} />
        </View>
        <Pressable onPress={() => router.push('/(auth)/register')} style={{ marginTop: 16 }}>
          <Text style={[ui.muted, { textAlign: 'center' }]}>
            {t.auth.noAccount}{' '}
            <Text style={{ color: tokens.color.lime }}>{t.auth.registerHere}</Text>
          </Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(public)/comercios')} style={{ marginTop: 12 }}>
          <Text style={[ui.muted, { textAlign: 'center' }]}>{t.auth.continueAsGuest}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
