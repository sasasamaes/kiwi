import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Screen, Button, StatusBadge, tokens } from '@kiwi/mobile-ui';
import * as ImagePicker from 'expo-image-picker';
import { ordersApi } from '../../../src/api/orders';
import { http } from '../../../src/api/client';
import { queue } from '../../../src/queue/useQueue';
import { nextStatus, canAdvance } from '../../../src/order/transitions';

const api = ordersApi(http);

export default function ActiveOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [current, setCurrent] = useState('assigned');
  const [busy, setBusy] = useState(false);
  const advance = async () => {
    const check = canAdvance(current, { pickupProofReady: true });
    if (!check.ok) {
      Alert.alert(
        check.reason === 'waiting_pickup_proof'
          ? 'Esperando la foto de retiro del comercio'
          : 'El pedido ya terminó',
      );
      return;
    }
    const n = nextStatus(current);
    if (!n) return;
    setBusy(true);
    try {
      if (n === 'delivered') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Necesitás permitir la cámara para la foto de entrega');
          return;
        }
        const shot = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (shot.canceled) return;
        const uri = shot.assets[0].uri;
        const form = new FormData();
        form.append('kind', 'delivery');
        form.append('photo', { uri, name: 'delivery.jpg', type: 'image/jpeg' } as any);
        await api.uploadProof(id, form);
      }
      try {
        await api.updateStatus(id, n as any);
      } catch (e: any) {
        if (e?.status && e.status >= 500) {
          await queue.enqueue('status', id, { status: n });
        } else if (!e?.status) {
          await queue.enqueue('status', id, { status: n });
        } else {
          throw e;
        }
      }
      setCurrent(n);
      if (n === 'delivered') router.replace('/(app)');
    } catch (e: any) {
      Alert.alert('No se pudo actualizar', e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <StatusBadge status={current} />
      <Text
        style={{
          color: tokens.color.ink,
          fontSize: 20,
          fontWeight: '700',
          marginVertical: tokens.space[4],
        }}
      >
        Pedido #{String(id).slice(0, 8)}
      </Text>
      <View style={{ marginTop: 'auto' }}>
        <Button
          label={current === 'in_transit_to_delivery' ? 'Marcar entregado (foto)' : 'Avanzar'}
          loading={busy}
          onPress={advance}
        />
      </View>
    </Screen>
  );
}
