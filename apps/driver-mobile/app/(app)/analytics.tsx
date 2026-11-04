import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, SegmentedTabs, Stat } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { driversApi } from '../../src/api/drivers';
import { http } from '../../src/api/client';

const api = driversApi(http);
const PERIODS = ['today', 'week', 'month', 'all'] as const;

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

  return (
    <Screen>
      <Text className="mb-3 text-lg font-bold text-surface-800 dark:text-surface-100">
        {t.driverStats.title}
      </Text>
      <SegmentedTabs
        value={period}
        onChange={setPeriod}
        options={[
          { id: 'today', label: t.driverStats.today },
          { id: 'week', label: t.driverStats.week },
          { id: 'month', label: t.driverStats.month },
          { id: 'all', label: t.driverStats.all },
        ]}
      />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Stat value={String(o.totalDeliveries ?? 0)} label={t.driverStats.deliveries} />
          </View>
          <View className="flex-1">
            <Stat
              value={`₡${Math.round(Number(o.totalEarnings ?? 0)).toLocaleString()}`}
              label={t.driverStats.earnings}
              accent="kiwi"
            />
          </View>
        </View>
        <View className="mt-3 flex-row gap-3">
          <View className="flex-1">
            <Stat
              value={`₡${Math.round(Number(o.averageEarningPerDelivery ?? 0)).toLocaleString()}`}
              label={t.driverStats.avgPerDelivery}
            />
          </View>
          <View className="flex-1">
            <Stat
              value={String(o.averageRating ?? '—')}
              label={t.driverStats.rating}
              accent="gold"
            />
          </View>
        </View>
        <View className="mt-3 flex-row gap-3">
          <View className="flex-1">
            <Stat
              value={`${Math.round(Number(o.completionRate ?? 0))}%`}
              label={t.driverStats.completion}
            />
          </View>
          <View className="flex-1">
            <Stat value={String(o.activeHours ?? 0)} label={t.driverStats.hours} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
