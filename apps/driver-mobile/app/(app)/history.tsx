import { useCallback, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, Card, EmptyState } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { driversApi } from '../../src/api/drivers';
import { http } from '../../src/api/client';
import { Text, View } from 'react-native';

const api = driversApi(http);

export default function History() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.myOrders('delivered', 50);
      const list = Array.isArray(r) ? r : (r?.items ?? []);
      setOrders(list);
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
        {t.driverHistory.title}
      </Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Card>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="font-semibold text-surface-800 dark:text-surface-100">
                  {item.isTest ? '🧪 TEST · ' : ''}
                  {item.merchantName ?? item.pickupAddress}
                </Text>
                <Text className="text-xs text-surface-500 dark:text-surface-400">
                  {item.deliveredAt ? new Date(item.deliveredAt).toLocaleDateString() : ''}
                </Text>
              </View>
              <View className="items-end">
                <Text className="font-bold text-kiwi-700 dark:text-kiwi-400">
                  ₡{item.isTest ? 0 : Math.round(Number(item.driverPayout ?? 0)).toLocaleString()}
                </Text>
                <Text className="text-xs text-surface-500 dark:text-surface-400">
                  {t.driverHistory.payout}
                </Text>
              </View>
            </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={!refreshing ? <EmptyState title={t.driverHistory.empty} /> : null}
      />
    </Screen>
  );
}
