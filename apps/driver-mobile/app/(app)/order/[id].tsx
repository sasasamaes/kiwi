import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, StatusBadge, tokens } from '@kiwi/mobile-ui';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from '@kiwi/i18n';
import { ordersApi } from '../../../src/api/orders';
import { http } from '../../../src/api/client';
import { queue } from '../../../src/queue/useQueue';
import { nextStatus, canAdvance } from '../../../src/order/transitions';

const api = ordersApi(http);

export default function ActiveOrder() {
  const { t, translate } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(id),
  });
  const order: any = detail.data ?? {};
  const isMandado = order.isMandado === true;
  // Avance optimista local; el servidor manda cuando llega (remount por pedido).
  const [advanced, setAdvanced] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [savingReceipt, setSavingReceipt] = useState(false);
  const current = advanced ?? (typeof order.status === 'string' ? order.status : 'assigned');

  const saveReceipt = async () => {
    const amount = Math.round(Number(receipt));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(t.driverOrder.mandaReceiptError);
      return;
    }
    setSavingReceipt(true);
    try {
      await api.setReceipt(id, amount);
      setReceipt('');
      Alert.alert(t.driverOrder.mandaReceiptSaved);
      void qc.invalidateQueries({ queryKey: ['order', id] });
      void detail.refetch();
    } catch (e: any) {
      Alert.alert(t.driverOrder.mandaReceiptError, e?.message ?? '');
    } finally {
      setSavingReceipt(false);
    }
  };

  const advance = async () => {
    const check = canAdvance(current, { pickupProofReady: true });
    if (!check.ok) {
      Alert.alert(
        check.reason === 'waiting_pickup_proof'
          ? t.driverOrder.waitingPickup
          : t.driverOrder.finished,
      );
      return;
    }
    setBusy(true);
    try {
      const n = nextStatus(current);
      if (!n) return;
      if (n === 'delivered') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t.driverOrder.cameraForDelivery);
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
      setAdvanced(n);
      if (n === 'delivered') router.replace('/(app)');
    } catch (e: any) {
      Alert.alert(t.driverOrder.updateFailed, e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <StatusBadge
        status={current}
        labels={{
          assigned: t.order.assigned,
          picked_up: t.order.pickedUp,
          in_transit_to_delivery: t.tracking.stepToHome,
          delivered: t.order.delivered,
          cancelled: t.order.cancelled,
        }}
      />
      <Text
        style={{
          color: tokens.color.ink,
          fontSize: 20,
          fontWeight: '700',
          marginVertical: tokens.space[4],
        }}
      >
        {translate('driverOrder.title', { id: String(id).slice(0, 8) })}
      </Text>

      {isMandado && (
        <View
          style={{
            backgroundColor: tokens.color.surface,
            borderRadius: tokens.radius.lg,
            padding: tokens.space[4],
            marginBottom: tokens.space[3],
          }}
        >
          <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>
            {t.driverOrder.mandaTitle}
          </Text>
          {!!order.purchaseStore && (
            <Text style={{ color: tokens.color.ink, marginTop: 4 }}>
              {t.driverOrder.mandaStore}: {String(order.purchaseStore)}
            </Text>
          )}
          {!!order.packageDescription && (
            <Text style={{ color: tokens.color.muted, marginTop: 2 }} numberOfLines={4}>
              {t.driverOrder.mandaList}:{' '}
              {String(order.packageDescription).replace(/^Mandado en [^:]+:\s*/, '')}
            </Text>
          )}
          <Text style={{ color: tokens.color.muted, marginTop: 4 }}>
            {t.driverOrder.mandaEstimate}: ₡
            {Number(order.receiptAmount ?? order.purchaseEstimate ?? 0).toLocaleString()}
            {' · '}
            {t.driverOrder.mandaBonus}
          </Text>
          {current !== 'delivered' && current !== 'cancelled' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TextInput
                value={receipt}
                onChangeText={(v) => setReceipt(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder={t.driverOrder.mandaReceiptPh}
                placeholderTextColor={tokens.color.muted}
                style={{
                  flex: 1,
                  backgroundColor: tokens.color.surface,
                  color: tokens.color.ink,
                  borderRadius: tokens.radius.md,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: tokens.color.border,
                }}
              />
              <Button
                label={t.driverOrder.mandaReceiptSave}
                loading={savingReceipt}
                onPress={() => void saveReceipt()}
              />
            </View>
          )}
        </View>
      )}

      <View style={{ marginTop: 'auto' }}>
        <Button
          label={
            current === 'in_transit_to_delivery'
              ? t.driverOrder.markDelivered
              : t.driverOrder.advance
          }
          loading={busy}
          onPress={advance}
        />
      </View>
    </Screen>
  );
}
