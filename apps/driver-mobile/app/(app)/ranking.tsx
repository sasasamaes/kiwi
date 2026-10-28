import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, tokens } from '@kiwi/mobile-ui';
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
      <Text style={{ color: tokens.color.ink, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
        {t.driverRanking.title}
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
            <Text style={{ color: period === p ? '#fff' : tokens.color.ink, fontWeight: '600' }}>
              {p === 'week'
                ? t.driverRanking.week
                : p === 'month'
                  ? t.driverRanking.month
                  : t.driverRanking.all}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(o, i) => o.driverId ?? String(i)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item, index }) => (
          <View
            style={{
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.lg,
              padding: tokens.space[4],
              marginBottom: tokens.space[3],
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text style={{ color: tokens.color.ink, fontWeight: '700', fontSize: 18, width: 28 }}>
              {index + 1}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.color.ink, fontWeight: '600' }}>{item.name}</Text>
              <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
                {translate('driverRanking.trips', { n: item.trips })}
              </Text>
            </View>
            <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>
              {fmtTime(Number(item.avgSeconds ?? 0))}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          !refreshing ? (
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <Text style={{ color: tokens.color.muted }}>{t.driverRanking.empty}</Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
