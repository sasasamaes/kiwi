import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { analyticsApi } from '../../src/api/analytics';
import { http } from '../../src/api/client';
import { BottomNav } from '../../src/ui/BottomNav';

const api = analyticsApi(http);
const PERIODS = ['week', 'month'] as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.surface,
        borderRadius: tokens.radius.lg,
        padding: tokens.space[4],
      }}
    >
      <Text style={{ color: tokens.color.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700', marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

export default function Analytics() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('week');
  const { data, isRefetching, refetch } = useQuery({
    queryKey: ['analytics', 'merchant', period],
    queryFn: () => api.merchant(period),
  });

  const a: any = data ?? {};
  const orders = a?.orders ?? {};
  const revenue = a?.revenue ?? {};
  const top = Array.isArray(a?.topItems) ? a.topItems : [];

  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {t.analytics.merchantTitle}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              flex: 1,
              borderRadius: tokens.radius.md,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: period === p ? tokens.color.kiwi : tokens.color.surface,
            }}
          >
            <Text
              style={{
                color: period === p ? '#fff' : tokens.color.ink,
                fontWeight: '600',
              }}
            >
              {p === 'week' ? t.analytics.week : t.analytics.month}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: 12 }}
        contentContainerStyle={{ paddingBottom: tokens.space[6] }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat
            label={t.analytics.totalOrders}
            value={String(orders.completed ?? orders.total ?? 0)}
          />
          <Stat
            label={t.analytics.totalRevenue}
            value={`₡${Number(revenue.total ?? a?.totalRevenue ?? 0).toLocaleString()}`}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Stat
            label={t.analytics.averageOrder}
            value={`₡${Number(a?.averageOrder ?? 0).toLocaleString()}`}
          />
          <Stat label={t.analytics.completionRate} value={`${Number(a?.completionRate ?? 0)}%`} />
        </View>

        <Text
          style={{ color: tokens.color.ink, fontWeight: '700', marginTop: 16, marginBottom: 8 }}
        >
          {t.analytics.topProducts}
        </Text>
        {top.length === 0 ? (
          <Text style={{ color: tokens.color.muted }}>—</Text>
        ) : (
          top.slice(0, 5).map((it: any, i: number) => (
            <View
              key={it.id ?? i}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                backgroundColor: tokens.color.surface,
                borderRadius: tokens.radius.md,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: tokens.color.ink, flex: 1 }}>{it.name}</Text>
              <Text style={{ color: tokens.color.muted }}>
                {it.orders ?? 0} · ₡{Number(it.revenue ?? 0).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
      <BottomNav active="profile" />
    </Screen>
  );
}
