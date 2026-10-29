import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { driversApi } from '../../src/api/drivers';
import { http } from '../../src/api/client';

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
      <Text style={{ color: tokens.color.ink, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
        {t.driverHistory.title}
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
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.color.ink, fontWeight: '600' }}>
                {item.isTest ? '🧪 TEST · ' : ''}
                {item.merchantName ?? item.pickupAddress}
              </Text>
              <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
                {item.deliveredAt ? new Date(item.deliveredAt).toLocaleDateString() : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>
                ₡{item.isTest ? 0 : Math.round(Number(item.driverPayout ?? 0)).toLocaleString()}
              </Text>
              <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
                {t.driverHistory.payout}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !refreshing ? (
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <Text style={{ color: tokens.color.muted }}>{t.driverHistory.empty}</Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
