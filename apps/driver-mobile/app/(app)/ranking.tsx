import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, SegmentedTabs, Card, EmptyState } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { driversApi } from '../../src/api/drivers';
import { http } from '../../src/api/client';

const api = driversApi(http);
const PERIODS = ['week', 'month', 'all'] as const;

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m} min ${s}s` : `${s}s`;
}

export default function Ranking() {
  const { t, translate } = useTranslation();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('week');
  const [rows, setRows] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.ranking(period);
      setRows(Array.isArray(r?.ranking) ? r.ranking : []);
    } catch {
      // Sin red: se queda la última lista.
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      setRefreshing(true);
      void load().finally(() => setRefreshing(false));
    }, [load]),
  );

  return (
    <Screen>
      <Text className="mb-3 text-lg font-bold text-surface-800 dark:text-surface-100">
        {t.driverRanking.title}
      </Text>
      <SegmentedTabs
        value={period}
        onChange={setPeriod}
        options={[
          { id: 'week', label: t.driverRanking.week },
          { id: 'month', label: t.driverRanking.month },
          { id: 'all', label: t.driverRanking.all },
        ]}
      />
      <FlatList
        data={rows}
        keyExtractor={(o, i) => o.driverId ?? String(i)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item, index }) => (
          <Card>
            <View className="flex-row items-center gap-3">
              <Text className="w-7 text-lg font-bold text-surface-800 dark:text-surface-100">
                {index + 1}
              </Text>
              <View className="flex-1">
                <Text className="font-semibold text-surface-800 dark:text-surface-100">
                  {item.name}
                </Text>
                <Text className="text-xs text-surface-500 dark:text-surface-400">
                  {translate('driverRanking.trips', { n: item.trips })}
                </Text>
              </View>
              <Text className="font-bold text-kiwi-700 dark:text-kiwi-400">
                {fmtTime(Number(item.avgSeconds ?? 0))}
              </Text>
            </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={!refreshing ? <EmptyState title={t.driverRanking.empty} /> : null}
      />
    </Screen>
  );
}
