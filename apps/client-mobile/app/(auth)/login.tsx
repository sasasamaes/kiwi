import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { Field, Header, ui } from '../../src/components/ui';
import { useSession } from '../../src/session/useSession';

export default function Login() {
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
      setError('No pudimos iniciar sesión. Revisá tus datos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Ingresar" />
      <View style={{ marginTop: tokens.space[6] }}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />
        {!!error && <Text style={{ color: tokens.color.danger }}>{error}</Text>}
        <View style={{ marginTop: 12 }}>
          <Button label="Iniciar sesión" loading={busy} onPress={() => void submit()} />
        </View>
        <Pressable onPress={() => router.push('/(auth)/register')} style={{ marginTop: 16 }}>
          <Text style={[ui.muted, { textAlign: 'center' }]}>
            ¿No tenés cuenta? <Text style={{ color: tokens.color.lime }}>Registrate</Text>
          </Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(public)/comercios')} style={{ marginTop: 12 }}>
          <Text style={[ui.muted, { textAlign: 'center' }]}>Seguir como invitado</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
