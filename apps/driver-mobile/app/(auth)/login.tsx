import { useState } from 'react';
import { TextInput, Text, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useSession } from '../../src/session/useSession';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const signIn = useSession((s) => s.signIn);
  const router = useRouter();
  return (
    <Screen>
      <View style={{ gap: tokens.space[4], marginTop: tokens.space[8] }}>
        <Text style={{ color: tokens.color.ink, fontSize: 24, fontWeight: '700' }}>
          Kiwi Repartidores
        </Text>
        <TextInput
          placeholder="tu@email.com"
          placeholderTextColor={tokens.color.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="email"
          style={{
            backgroundColor: tokens.color.surface,
            color: tokens.color.ink,
            borderRadius: tokens.radius.md,
            padding: 14,
          }}
        />
        <TextInput
          placeholder="••••••••"
          placeholderTextColor={tokens.color.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="password"
          style={{
            backgroundColor: tokens.color.surface,
            color: tokens.color.ink,
            borderRadius: tokens.radius.md,
            padding: 14,
          }}
        />
        <Button
          label="Iniciar Sesión"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await signIn(email.trim(), password);
              router.replace('/(app)');
            } catch {
              Alert.alert('No se pudo iniciar sesión');
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </Screen>
  );
}
