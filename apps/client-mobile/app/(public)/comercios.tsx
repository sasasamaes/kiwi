import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { menuApi } from '../../src/api/menu';
import { http } from '../../src/api/http';
import { useSession } from '../../src/session/useSession';
import { Card, Field, Pill, ui } from '../../src/components/ui';

const api = menuApi(http);

export default function Comercios() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['discover', q, category],
    queryFn: () => api.discover({ q: q.trim() || undefined, category: category ?? undefined }),
  });

  const merchants: any[] = Array.isArray(data) ? data : [];
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const m of merchants) if (m?.category) set.add(String(m.category));
    return [t.customer.all, ...set];
  }, [merchants, t]);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.brand}>Kiwi</Text>
        <View style={ui.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.customer.scanQr}
            onPress={() => router.push('/(public)/scan')}
          >
            <Text style={{ fontSize: 20, marginRight: 16 }}>📷</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(user ? '/(account)/orders' : '/(auth)/login')}
          >
            <Text style={{ color: tokens.color.lime, fontWeight: '600' }}>
              {user ? t.customer.myOrders : t.customer.login}
            </Text>
          </Pressable>
        </View>
      </View>

      <Field
        label={t.customer.searchMerchants}
        value={q}
        onChangeText={setQ}
        placeholder={t.customer.searchHint}
      />

      <View style={styles.pillRow}>
        {categories.map((c) => (
          <Pill
            key={c}
            label={c}
            active={(category ?? t.customer.all) === c}
            onPress={() => setCategory(c === t.customer.all ? null : c)}
          />
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={tokens.color.kiwi} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={merchants}
          keyExtractor={(m) => m.id}
          refreshing={false}
          onRefresh={() => void refetch()}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={[ui.muted, { marginTop: 24 }]}>{t.customer.noMerchants}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/(public)/menu/[id]', params: { id: item.id } })
              }
            >
              <Card style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text
                    style={{ color: tokens.color.ink, fontSize: 16, fontWeight: '700', flex: 1 }}
                  >
                    {item.businessName}
                  </Text>
                  {item.isOpen === false && (
                    <Text style={ui.muted}>
                      {item.isHomeCook ? t.customer.presale : t.customer.closed}
                    </Text>
                  )}
                </View>
                {!!item.description && (
                  <Text style={[ui.muted, { marginTop: 4 }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                <View style={[ui.row, { marginTop: 8 }]}>
                  <Text style={[ui.muted, { marginRight: 12 }]}>
                    ⭐ {Number(item.rating ?? 0).toFixed(1)}
                  </Text>
                  {!!item.category && <Text style={ui.muted}>{item.category}</Text>}
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = {
  topBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  brand: { color: tokens.color.ink, fontSize: 22, fontWeight: '800' as const },
  pillRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginBottom: 12 },
};
