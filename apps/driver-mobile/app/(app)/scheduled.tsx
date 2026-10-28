import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
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
      <Text style={{ color: tokens.color.ink, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
        {t.driverScheduled.title}
      </Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.lg,
              padding: tokens.space[4],
              marginBottom: tokens.space[3],
            }}
          >
            <Text style={{ color: tokens.color.ink, fontWeight: '600' }}>
              {item.merchant?.businessName ?? item.pickupAddress}
            </Text>
            <Text style={{ color: tokens.color.muted, fontSize: 12 }}>{item.deliveryAddress}</Text>
            <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
              {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString() : ''}{' '}
              {item.scheduledTime ?? ''}
            </Text>
            {proposingId === String(item.id) ? (
              <View style={{ marginTop: 8 }}>
                <TextInput
                  value={arrival}
                  onChangeText={setArrival}
                  placeholder={t.driverScheduled.arrivalPh}
                  placeholderTextColor={tokens.color.muted}
                  style={{
                    backgroundColor: tokens.color.surface,
                    color: tokens.color.ink,
                    borderRadius: tokens.radius.md,
                    padding: 10,
                    marginBottom: 8,
                  }}
                />
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t.driverScheduled.messagePh}
                  placeholderTextColor={tokens.color.muted}
                  style={{
                    backgroundColor: tokens.color.surface,
                    color: tokens.color.ink,
                    borderRadius: tokens.radius.md,
                    padding: 10,
                    marginBottom: 8,
                  }}
                />
                <Button
                  label={sending ? '…' : t.driverScheduled.propose}
                  onPress={() => void send(String(item.id))}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setProposingId(String(item.id));
                  setArrival('');
                  setMessage('');
                }}
                style={{
                  marginTop: 8,
                  backgroundColor: tokens.color.kiwi,
                  borderRadius: tokens.radius.md,
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {t.driverScheduled.propose}
                </Text>
              </Pressable>
            )}
          </View>
        )}
        ListEmptyComponent={
          !refreshing ? (
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <Text style={{ color: tokens.color.muted }}>{t.driverScheduled.empty}</Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
