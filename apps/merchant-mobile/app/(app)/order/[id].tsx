import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, StatusBadge, Price, tokens } from '@kiwi/mobile-ui';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from '@kiwi/i18n';
import { ordersApi } from '../../../src/api/orders';
import { http } from '../../../src/api/client';
import { BottomNav } from '../../../src/ui/BottomNav';

const api = ordersApi(http);

// The backend only lets the merchant move its own states (validateStatusActor):
// retry a driverless order into the contest, or cancel before it is on the road.
// Everything downstream belongs to the assigned driver.
function merchantActions(
  status: string,
  retryLabel: string,
  cancelLabel: string,
): { label: string; status: string; variant: 'danger' | 'secondary' }[] {
  if (status === 'no_driver') {
    return [
      { label: retryLabel, status: 'pending', variant: 'secondary' },
      { label: cancelLabel, status: 'cancelled', variant: 'danger' },
    ];
  }
  if (['pending', 'assigned', 'driver_proposals'].includes(status)) {
    return [{ label: cancelLabel, status: 'cancelled', variant: 'danger' }];
  }
  return [];
}

export default function OrderDetail() {
  const { t, translate } = useTranslation();
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
    onError: (e: any) => Alert.alert(t.merchantOrder.updateFailed, e?.message ?? ''),
  });

  const uploadPickup = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t.merchantOrder.cameraForPickup);
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
      Alert.alert(t.merchantOrder.pickupUploaded);
    } catch (e: any) {
      Alert.alert(t.merchantOrder.photoFailed, e?.message ?? '');
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
        <StatusBadge
          status={status}
          labels={{
            pending: t.order.pending,
            confirmed: t.order.confirmed,
            preparing: t.order.preparing,
            ready: t.order.ready,
            picked_up: t.order.pickedUp,
            delivered: t.order.delivered,
            cancelled: t.order.cancelled,
            no_driver: t.order.noDriver,
          }}
        />
        <Text
          style={{
            color: tokens.color.ink,
            fontSize: 20,
            fontWeight: '700',
            marginVertical: tokens.space[3],
          }}
        >
          {translate('merchantOrder.title', { id: String(id).slice(0, 8).toUpperCase() })}
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
          {translate('merchantOrder.pickup', { address: order?.pickupAddress ?? '—' })}
        </Text>
        <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
          {translate('merchantOrder.delivery', { address: order?.deliveryAddress ?? '—' })}
        </Text>

        <View style={{ marginTop: tokens.space[4] }}>
          <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>
            {translate('merchantOrder.driverLabel', {
              name: order?.driver?.fullName ?? t.merchantOrder.unassigned,
            })}
          </Text>
          {order?.pickupProofPhotoUrl ? (
            <Text style={{ color: tokens.color.emerald, fontSize: 12, marginTop: 4 }}>
              {t.merchantOrder.pickupRegistered}
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: tokens.space[4] }}>
          <Text style={{ color: tokens.color.ink, fontWeight: '700', marginBottom: 4 }}>
            {translate('merchantOrder.proposals', { count: proposals.length })}
          </Text>
          {proposals.length === 0 ? (
            <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
              {t.merchantOrder.noProposalsDetail}
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
            <Button label={t.merchantOrder.uploadPickup} loading={busy} onPress={uploadPickup} />
          )}
          <Button
            label={t.merchantOrder.requestDriver}
            variant="secondary"
            onPress={() => router.push({ pathname: '/(app)/drivers', params: { orderId: id } })}
          />
          {merchantActions(status, t.merchantOrder.retrySearch, t.merchantOrder.cancelOrder).map(
            (a) => (
              <Button
                key={a.status}
                label={a.label}
                variant={a.variant}
                loading={updateStatus.isPending}
                onPress={() => updateStatus.mutate(a.status)}
              />
            ),
          )}
        </View>
      </ScrollView>
      <BottomNav active="comandas" />
    </Screen>
  );
}
