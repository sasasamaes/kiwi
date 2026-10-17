import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { Field, Header, ui } from '../../src/components/ui';
import { useSession } from '../../src/session/useSession';

export default function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const register = useSession((s) => s.register);
  const signIn = useSession((s) => s.signIn);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.replace(/\D/g, ''),
      });
      // If the API did not return tokens, sign in with the same credentials.
      await signIn(email.trim(), password).catch(() => undefined);
      router.replace('/(account)/orders');
    } catch {
      setError(t.auth.registerFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={t.auth.createAccount} />
      <View style={{ marginTop: tokens.space[6] }}>
        <Field
          label={t.auth.fullName}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t.auth.fullName}
        />
        <Field
          label={t.auth.email}
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label={t.auth.phone}
          value={phone}
          onChangeText={setPhone}
          placeholder="8888-1234"
          keyboardType="phone-pad"
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
          <Button label={t.auth.createAccount} loading={busy} onPress={() => void submit()} />
        </View>
        <Pressable onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 16 }}>
          <Text style={[ui.muted, { textAlign: 'center' }]}>
            {t.auth.hasAccount} <Text style={{ color: tokens.color.lime }}>{t.auth.loginHere}</Text>
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
