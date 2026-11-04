import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, StatusBadge, Card, EmptyState } from '@kiwi/mobile-ui';
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
      <Text className="mb-3 text-lg font-bold text-surface-800 dark:text-surface-100">
        {t.driverActive.title}
      </Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/order/${item.id}`)}>
            <Card>
              <View className="mb-2">
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
              </View>
              <Text className="mt-1 font-semibold text-surface-800 dark:text-surface-100">
                {item.isTest ? '🧪 TEST · ' : ''}
                {item.merchantName ?? item.pickupAddress}
              </Text>
              <Text className="text-xs text-surface-500 dark:text-surface-400">
                {item.deliveryAddress}
              </Text>
            </Card>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          !refreshing ? (
            <EmptyState title={t.driverActive.empty} hint={t.driverActive.emptyHint} />
          ) : null
        }
      />
    </Screen>
  );
}
