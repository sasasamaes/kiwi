import { useEffect, useCallback } from 'react';
import {
  useWindowDimensions,
  Pressable,
  ScrollView,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Screen, StatusBadge, tokens } from '@kiwi/mobile-ui';
import { ordersApi } from '../../src/api/orders';
import { http } from '../../src/api/client';
import { useBoard } from '../../src/comanda/boardStore';
import { columnFor, sortByOldest, type Column } from '../../src/comanda/board';
import { playNewOrderAlert } from '../../src/kds/sound';
import { BottomNav } from '../../src/ui/BottomNav';

const api = ordersApi(http);

const COLUMNS: { key: Column; label: string }[] = [
  { key: 'new', label: 'Nuevas' },
  { key: 'preparing', label: 'En preparación' },
  { key: 'ready', label: 'Listas' },
];

function elapsed(createdAt: string | number | undefined) {
  if (createdAt == null) return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  return mins < 1 ? 'ahora' : `hace ${mins} min`;
}

export default function Comandas() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const orders = useBoard((s) => s.orders);
  const lastCreatedId = useBoard((s) => s.lastCreatedId);

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['orders', 'incoming'],
    queryFn: () => api.incoming(),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (Array.isArray(data)) useBoard.getState().setAll(data);
  }, [data]);

  useEffect(() => {
    if (lastCreatedId) playNewOrderAlert();
  }, [lastCreatedId]);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const width1 = width >= 768 ? (width - tokens.space[4] * 4) / 3 : width * 0.8;

  return (
    <Screen>
      <Text
        style={{
          color: tokens.color.ink,
          fontSize: 20,
          fontWeight: '700',
          marginBottom: tokens.space[3],
        }}
      >
        Comandas
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        contentContainerStyle={{ gap: tokens.space[3] }}
      >
        {COLUMNS.map((col) => {
          const items = sortByOldest(orders.filter((o) => columnFor(o.status) === col.key));
          return (
            <View key={col.key} style={{ width: width1 }}>
              <Text style={{ color: tokens.color.muted, fontWeight: '700', marginBottom: 8 }}>
                {col.label} · {items.length}
              </Text>
              {items.map((o) => (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/(app)/order/${o.id}`)}
                  style={{
                    backgroundColor: tokens.color.surface,
                    borderRadius: tokens.radius.lg,
                    padding: tokens.space[4],
                    marginBottom: tokens.space[3],
                    borderWidth: 1,
                    borderColor: tokens.color.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>
                      #{String(o.id).slice(0, 6).toUpperCase()}
                    </Text>
                    <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
                      {elapsed(o.createdAt)}
                    </Text>
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <StatusBadge status={o.status} />
                  </View>
                  <Text style={{ color: tokens.color.ink, marginTop: 8, fontWeight: '600' }}>
                    {o.orderType === 'scheduled' ? 'Programado' : 'Envío'}
                    {o.driver?.fullName ? ` · ${o.driver.fullName}` : ''}
                  </Text>
                  {(o.items ?? []).map((it: any, i: number) => (
                    <Text key={i} style={{ color: tokens.color.ink, marginTop: 4, fontSize: 13 }}>
                      {it.quantity}× {it.name}
                      {Array.isArray(it.selectedVariants) && it.selectedVariants.length
                        ? ` (${it.selectedVariants.join(', ')})`
                        : ''}
                      {it.notes ? ` — ${it.notes}` : ''}
                    </Text>
                  ))}
                  <Text style={{ color: tokens.color.muted, fontSize: 12, marginTop: 8 }}>
                    Retiro: {o.pickupAddress ?? '—'}
                  </Text>
                  <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
                    Entrega: {o.deliveryAddress ?? '—'}
                  </Text>
                </Pressable>
              ))}
              {items.length === 0 && (
                <Text style={{ color: tokens.color.muted, fontSize: 12 }}>Sin comandas</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
      <BottomNav active="comandas" />
    </Screen>
  );
}
