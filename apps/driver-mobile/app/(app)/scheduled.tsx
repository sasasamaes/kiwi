import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, Button, Card, EmptyState } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { ordersApi } from '../../src/api/orders';
import { http } from '../../src/api/client';

const api = ordersApi(http);

export default function Scheduled() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [arrival, setArrival] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.availableScheduled();
      setOrders(Array.isArray(r) ? r : []);
    } catch {
      // Sin red: se queda la última lista.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRefreshing(true);
      void load().finally(() => setRefreshing(false));
    }, [load]),
  );

  const send = async (id: string) => {
    if (!arrival.trim()) {
      Alert.alert(t.driverScheduled.needArrival);
      return;
    }
    setSending(true);
    try {
      await api.propose(id, {
        estimatedArrival: arrival.trim(),
        message: message.trim() || undefined,
      });
      Alert.alert(t.driverScheduled.sent);
      setProposingId(null);
      setArrival('');
      setMessage('');
      void load();
    } catch (e: any) {
      Alert.alert(t.driverScheduled.failed, e?.message ?? '');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <Text className="mb-3 text-lg font-bold text-surface-800 dark:text-surface-100">
        {t.driverScheduled.title}
      </Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Card>
            <Text className="font-semibold text-surface-800 dark:text-surface-100">
              {item.merchant?.businessName ?? item.pickupAddress}
            </Text>
            <Text className="text-xs text-surface-500 dark:text-surface-400">
              {item.deliveryAddress}
            </Text>
            <Text className="text-xs text-surface-500 dark:text-surface-400">
              {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString() : ''}{' '}
              {item.scheduledTime ?? ''}
            </Text>
            {proposingId === String(item.id) ? (
              <View className="mt-2">
                <TextInput
                  value={arrival}
                  onChangeText={setArrival}
                  placeholder={t.driverScheduled.arrivalPh}
                  placeholderTextColor="#94a3b8"
                  className="mb-2 rounded-lg bg-surface-100 px-3 py-2.5 text-sm text-surface-800 dark:bg-surface-700 dark:text-surface-100"
                />
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t.driverScheduled.messagePh}
                  placeholderTextColor="#94a3b8"
                  className="mb-2 rounded-lg bg-surface-100 px-3 py-2.5 text-sm text-surface-800 dark:bg-surface-700 dark:text-surface-100"
                />
                <Button
                  label={sending ? '…' : t.driverScheduled.propose}
                  onPress={() => void send(String(item.id))}
                />
              </View>
            ) : (
              <View className="mt-2">
                <Button
                  label={t.driverScheduled.propose}
                  onPress={() => {
                    setProposingId(String(item.id));
                    setArrival('');
                    setMessage('');
                  }}
                />
              </View>
            )}
          </Card>
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={!refreshing ? <EmptyState title={t.driverScheduled.empty} /> : null}
      />
    </Screen>
  );
}
