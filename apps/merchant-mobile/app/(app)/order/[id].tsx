import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, StatusBadge, Price, tokens } from '@kiwi/mobile-ui';
import * as ImagePicker from 'expo-image-picker';
import { ordersApi } from '../../../src/api/orders';
import { http } from '../../../src/api/client';
import { BottomNav } from '../../../src/ui/BottomNav';

const api = ordersApi(http);

// The backend only lets the merchant move its own states (validateStatusActor):
// retry a driverless order into the contest, or cancel before it is on the road.
// Everything downstream belongs to the assigned driver.
function merchantActions(
  status: string,
): { label: string; status: string; variant: 'danger' | 'secondary' }[] {
  if (status === 'no_driver') {
    return [
      { label: 'Reintentar búsqueda', status: 'pending', variant: 'secondary' },
      { label: 'Cancelar pedido', status: 'cancelled', variant: 'danger' },
    ];
  }
  if (['pending', 'assigned', 'driver_proposals'].includes(status)) {
    return [{ label: 'Cancelar pedido', status: 'cancelled', variant: 'danger' }];
  }
  return [];
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: order } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(id),
    enabled: !!id,
  });

  const status: string = order?.status ?? 'pending';
  const refetch = () => void qc.invalidateQueries({ queryKey: ['order', id] });

  const updateStatus = useMutation({
    mutationFn: (next: string) => api.updateStatus(id, next),
    onSuccess: refetch,
    onError: (e: any) => Alert.alert('No se pudo actualizar', e?.message ?? ''),
  });

  const uploadPickup = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Necesitás permitir la cámara para la foto de retiro');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (shot.canceled) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('photo', {
        uri: shot.assets[0].uri,
        name: 'pickup.jpg',
        type: 'image/jpeg',
      } as any);
      await api.uploadPickupProof(id, form);
      refetch();
      Alert.alert('Foto de retiro subida');
    } catch (e: any) {
      Alert.alert('No se pudo subir la foto', e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };

  const proposals: any[] = order?.proposals ?? [];
  const canUploadPickup =
    !order?.pickupProofPhotoUrl && !['delivered', 'cancelled'].includes(status);

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: tokens.space[6] }}>
        <StatusBadge status={status} />
        <Text
          style={{
            color: tokens.color.ink,
            fontSize: 20,
            fontWeight: '700',
            marginVertical: tokens.space[3],
          }}
        >
          Pedido #{String(id).slice(0, 8).toUpperCase()}
        </Text>

        {(order?.items ?? []).map((it: any, i: number) => (
          <View key={i} style={{ marginBottom: 6 }}>
            <Text style={{ color: tokens.color.ink }}>
              {it.quantity}× {it.name}
              {it.notes ? ` — ${it.notes}` : ''}
            </Text>
            {Array.isArray(it.selectedVariants) && it.selectedVariants.length > 0 && (
              <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
                {it.selectedVariants.join(', ')}
              </Text>
            )}
          </View>
        ))}

        {order?.totalAmount != null && (
          <View style={{ marginTop: tokens.space[3] }}>
            <Price amount={Number(order.totalAmount)} />
          </View>
        )}

        <Text style={{ color: tokens.color.muted, marginTop: tokens.space[4], fontSize: 12 }}>
          Retiro: {order?.pickupAddress ?? '—'}
        </Text>
        <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
          Entrega: {order?.deliveryAddress ?? '—'}
        </Text>

        <View style={{ marginTop: tokens.space[4] }}>
          <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>
            Repartidor: {order?.driver?.fullName ?? 'Sin asignar'}
          </Text>
          {order?.pickupProofPhotoUrl ? (
            <Text style={{ color: tokens.color.emerald, fontSize: 12, marginTop: 4 }}>
              Foto de retiro registrada
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: tokens.space[4] }}>
          <Text style={{ color: tokens.color.ink, fontWeight: '700', marginBottom: 4 }}>
            Propuestas ({proposals.length})
          </Text>
          {proposals.length === 0 ? (
            <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
              Sin propuestas. El backend aún no expone la lista de propuestas en el detalle.
            </Text>
          ) : (
            proposals.map((p: any) => (
              <Text key={p.id} style={{ color: tokens.color.ink, fontSize: 13 }}>
                {p.driver?.fullName ?? p.driverId} · {p.rating ?? '—'}★
              </Text>
            ))
          )}
        </View>

        <View style={{ gap: tokens.space[2], marginTop: tokens.space[5] }}>
          {canUploadPickup && (
            <Button label="Subir foto de retiro" loading={busy} onPress={uploadPickup} />
          )}
          <Button
            label="Solicitar / elegir repartidor"
            variant="secondary"
            onPress={() => router.push({ pathname: '/(app)/drivers', params: { orderId: id } })}
          />
          {merchantActions(status).map((a) => (
            <Button
              key={a.status}
              label={a.label}
              variant={a.variant}
              loading={updateStatus.isPending}
              onPress={() => updateStatus.mutate(a.status)}
            />
          ))}
        </View>
      </ScrollView>
      <BottomNav active="comandas" />
    </Screen>
  );
}
