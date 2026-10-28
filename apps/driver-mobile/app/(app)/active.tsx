import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, StatusBadge, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { driversApi } from '../../src/api/drivers';
import { http } from '../../src/api/client';

const api = driversApi(http);
const ACTIVE = [
  'pending_acceptance',
  'assigned',
  'in_transit_to_pickup',
  'picked_up',
  'in_transit_to_delivery',
];

export default function Active() {
  const { t } = useTranslation();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.myOrders(undefined, 50);
      const list = Array.isArray(r) ? r : (r?.items ?? []);
      setOrders(list.filter((o: any) => ACTIVE.includes(o?.status)));
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

  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
        {t.driverActive.title}
      </Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(app)/order/${item.id}`)}
            style={{
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.lg,
              padding: tokens.space[4],
              marginBottom: tokens.space[3],
            }}
          >
            <StatusBadge
              status={item.status ?? 'assigned'}
              labels={{
                pending: t.order.pending,
                assigned: t.order.assigned,
                pickedUp: t.order.pickedUp,
                delivered: t.order.delivered,
                cancelled: t.order.cancelled,
                noDriver: t.order.noDriver,
              }}
            />
            <Text style={{ color: tokens.color.ink, marginTop: 8, fontWeight: '600' }}>
              {item.merchantName ?? item.pickupAddress}
            </Text>
            <Text style={{ color: tokens.color.muted, fontSize: 12 }}>{item.deliveryAddress}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !refreshing ? (
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <Text style={{ color: tokens.color.muted }}>{t.driverActive.empty}</Text>
              <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
                {t.driverActive.emptyHint}
              </Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
