import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { driversApi } from '../../src/api/drivers';
import { http } from '../../src/api/client';

const api = driversApi(http);
const PERIODS = ['today', 'week', 'month', 'all'] as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: tokens.color.muted }}>{label}</Text>
      <Text style={{ color: tokens.color.ink, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

export default function Analytics() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('week');
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.analytics(period));
    } catch {
      // Sin red: se queda lo último.
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      setRefreshing(true);
      void load().finally(() => setRefreshing(false));
    }, [load]),
  );

  const o = data?.overview ?? {};
  const label: Record<string, string> = {
    today: t.driverStats.today,
    week: t.driverStats.week,
    month: t.driverStats.month,
    all: t.driverStats.all,
  };

  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
        {t.driverStats.title}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              flex: 1,
              backgroundColor: period === p ? tokens.color.kiwi : tokens.color.surface,
              borderRadius: tokens.radius.md,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: period === p ? '#fff' : tokens.color.ink,
                fontWeight: '600',
                fontSize: 12,
              }}
            >
              {label[p]}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        style={{
          backgroundColor: tokens.color.surface,
          borderRadius: tokens.radius.lg,
          padding: tokens.space[4],
        }}
      >
        <Row label={t.driverStats.deliveries} value={String(o.totalDeliveries ?? 0)} />
        <Row
          label={t.driverStats.earnings}
          value={`₡${Math.round(Number(o.totalEarnings ?? 0)).toLocaleString()}`}
        />
        <Row
          label={t.driverStats.avgPerDelivery}
          value={`₡${Math.round(Number(o.averageEarningPerDelivery ?? 0)).toLocaleString()}`}
        />
        <Row label={t.driverStats.rating} value={String(o.averageRating ?? '—')} />
        <Row
          label={t.driverStats.completion}
          value={`${Math.round(Number(o.completionRate ?? 0))}%`}
        />
        <Row label={t.driverStats.hours} value={String(o.activeHours ?? 0)} />
      </ScrollView>
    </Screen>
  );
}
