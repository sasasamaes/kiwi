import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { Card, Field, Header, ui } from '../../src/components/ui';
import { useSession } from '../../src/session/useSession';

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useSession((s) => s);
  const [address, setAddress] = useState('');

  return (
    <Screen>
      <Header title="Mi perfil" />
      <Card style={{ marginBottom: 14 }}>
        <Text style={ui.muted}>Cuenta</Text>
        <Text style={{ color: tokens.color.ink, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
          {user?.fullName || user?.email || 'Invitado'}
        </Text>
        {!!user?.email && <Text style={ui.muted}>{user.email}</Text>}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Field label="Dirección de entrega" value={address} onChangeText={setAddress} />
        <Text style={ui.muted}>Guardá tu dirección para pedir más rápido.</Text>
      </Card>

      <Pressable onPress={() => router.push('/(account)/orders')} style={{ marginBottom: 16 }}>
        <Text style={{ color: tokens.color.lime, fontWeight: '600' }}>Ver mis pedidos →</Text>
      </Pressable>

      <Button
        label="Cerrar sesión"
        variant="danger"
        onPress={async () => {
          await signOut();
          router.replace('/(public)/comercios');
        }}
      />
    </Screen>
  );
}
