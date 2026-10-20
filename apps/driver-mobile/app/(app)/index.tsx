import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Screen, Button, StatusBadge, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { ordersApi } from '../../src/api/orders';
import { http } from '../../src/api/client';
import { secureStorage } from '../../src/api/storage';
import { useSession } from '../../src/session/useSession';
import { createRealtime } from '@kiwi/mobile-core';
import { io } from 'socket.io-client';

const api = ordersApi(http);
const WS = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4100/api').replace('/api', '');

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const { online, setOnline } = useSession((s) => s);
  const [orders, setOrders] = useState<any[]>([]);
  const { data } = useQuery({
    queryKey: ['available', online],
    queryFn: () => api.available(),
    enabled: online,
  });
  useEffect(() => {
    if (Array.isArray(data)) setOrders(data);
  }, [data]);
  useEffect(() => {
    const rt = createRealtime(io as any, WS, () => secureStorage.getAccess(), {
      onNewOrder: (o) =>
        setOrders((prev) => (prev.some((x) => x.id === (o.id ?? o.orderId)) ? prev : [o, ...prev])),
      onOrderTaken: ({ id, orderId }) =>
        setOrders((prev) => prev.filter((o) => o.id !== (id ?? orderId))),
      onStatusChanged: () => {},
    });
    if (online) rt.connect();
    return () => rt.disconnect();
  }, [online]);
  const accept = useCallback(
    async (id: string) => {
      await api.accept(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      router.push(`/(app)/order/${id}`);
    },
    [router],
  );
  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.space[4],
        }}
      >
        <Text style={{ color: tokens.color.ink, fontWeight: '700', fontSize: 18 }}>
          {online ? t.driverHome.online : t.driverHome.offline}
        </Text>
        <Switch value={online} onValueChange={setOnline} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: tokens.space[3] }}>
        <Pressable
          onPress={() => router.push('/(app)/earnings')}
          style={{
            flex: 1,
            backgroundColor: tokens.color.surface,
            borderRadius: tokens.radius.md,
            paddingVertical: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: tokens.color.ink, fontWeight: '600' }}>{t.earnings.title}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          style={{
            flex: 1,
            backgroundColor: tokens.color.surface,
            borderRadius: tokens.radius.md,
            paddingVertical: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: tokens.color.ink, fontWeight: '600' }}>{t.profile.title}</Text>
        </Pressable>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.lg,
              padding: tokens.space[4],
              marginBottom: tokens.space[3],
            }}
          >
            <StatusBadge
              status={item.status ?? 'pending'}
              labels={{
                pending: t.order.pending,
                assigned: t.order.assigned,
                picked_up: t.order.pickedUp,
                delivered: t.order.delivered,
                cancelled: t.order.cancelled,
                no_driver: t.order.noDriver,
              }}
            />
            <Text style={{ color: tokens.color.ink, marginTop: 8, fontWeight: '600' }}>
              {item.merchant?.businessName ?? item.pickupAddress}
            </Text>
            <Text style={{ color: tokens.color.muted, fontSize: 12 }}>{item.deliveryAddress}</Text>
            <View style={{ marginTop: tokens.space[3] }}>
              <Button label={t.driverHome.accept} onPress={() => accept(item.id)} />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: tokens.color.muted }}>
            {online ? t.driverHome.noOrders : t.driverHome.connectHint}
          </Text>
        }
      />
    </Screen>
  );
}
