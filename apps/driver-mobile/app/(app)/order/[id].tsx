import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, StatusBadge, Card } from '@kiwi/mobile-ui';
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
  const isClientOrder = order.origin === 'client_app';
  const collectable = Math.round(
    isClientOrder ? Number(order.totalAmount ?? 0) : Number(order.basePrice ?? 0),
  );
  const tendered = order.cashTendered != null ? Number(order.cashTendered) : null;
  const showCash = (order as any)?.payment?.method === 'cash' || tendered != null;
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
      <Text className="mb-4 mt-4 text-xl font-bold text-surface-800 dark:text-surface-100">
        {order.isTest === true ? '🧪 TEST · ' : ''}
        {translate('driverOrder.title', { id: String(id).slice(0, 8) })}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const msg = translate('profile.orderSupportMsg', {
            id: String(id).slice(0, 8).toUpperCase(),
          });
          // Soporte Kiwi (fuente: packages/ui/src/business.ts).
          void Linking.openURL(`https://wa.me/50688264007?text=${encodeURIComponent(msg)}`);
        }}
        className="mb-3 items-center rounded-xl bg-[#25D366] py-3"
      >
        <Text className="font-bold text-white">💬 {t.profile.support}</Text>
      </Pressable>

      {isMandado && (
        <View className="mb-3">
          <Card>
            <Text className="font-bold text-surface-800 dark:text-surface-100">
              {t.driverOrder.mandaTitle}
            </Text>
            {!!order.purchaseStore && (
              <Text className="mt-1 text-surface-800 dark:text-surface-100">
                {t.driverOrder.mandaStore}: {String(order.purchaseStore)}
              </Text>
            )}
            {!!order.packageDescription && (
              <Text className="mt-0.5 text-surface-500 dark:text-surface-400" numberOfLines={4}>
                {t.driverOrder.mandaList}:{' '}
                {String(order.packageDescription).replace(/^Mandado en [^:]+:\s*/, '')}
              </Text>
            )}
            <Text className="mt-1 text-surface-500 dark:text-surface-400">
              {t.driverOrder.mandaEstimate}: ₡
              {Number(order.receiptAmount ?? order.purchaseEstimate ?? 0).toLocaleString()}
              {' · '}
              {t.driverOrder.mandaBonus}
            </Text>
            {current !== 'delivered' && current !== 'cancelled' && (
              <View className="mt-2 flex-row gap-2">
                <TextInput
                  value={receipt}
                  onChangeText={(v) => setReceipt(v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder={t.driverOrder.mandaReceiptPh}
                  placeholderTextColor="#94a3b8"
                  className="flex-1 rounded-lg border border-surface-200 bg-surface-100 px-3 py-3 text-surface-800 dark:border-surface-700 dark:bg-surface-700 dark:text-surface-100"
                />
                <Button
                  label={t.driverOrder.mandaReceiptSave}
                  loading={savingReceipt}
                  onPress={() => void saveReceipt()}
                />
              </View>
            )}
          </Card>
        </View>
      )}

      {showCash && (
        <View className="mb-3">
          <Card>
            <Text className="font-bold text-surface-800 dark:text-surface-100">
              {translate('driverOrder.cashTitle', { amount: collectable.toLocaleString() })}
            </Text>
            {!isClientOrder && (
              <Text className="mt-0.5 text-surface-500 dark:text-surface-400">
                {t.driverOrder.cashTripNote}
              </Text>
            )}
            {tendered != null ? (
              <Text className="mt-1 text-surface-800 dark:text-surface-100">
                {translate('driverOrder.cashChange', {
                  tendered: tendered.toLocaleString(),
                  change: Math.max(0, tendered - collectable).toLocaleString(),
                })}
              </Text>
            ) : (
              <Text className="mt-1 text-surface-500 dark:text-surface-400">
                {t.driverOrder.cashNoTender}
              </Text>
            )}
          </Card>
        </View>
      )}

      <View className="mt-auto">
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
