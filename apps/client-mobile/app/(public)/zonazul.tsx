import { FlatList, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { menuApi } from '../../src/api/menu';
import { http } from '../../src/api/http';
import { Card, Header, ui } from '../../src/components/ui';

const api = menuApi(http);
const MERCHANT_ID = process.env.EXPO_PUBLIC_ZONA_AZUL_MERCHANT_ID ?? '';

export default function ZonaAzul() {
  const { t } = useTranslation();
  const router = useRouter();

  const profile = useQuery({
    queryKey: ['zonazul', 'profile'],
    queryFn: () => api.publicProfile(MERCHANT_ID),
    enabled: MERCHANT_ID.length > 0,
  });
  const feed = useQuery({
    queryKey: ['zonazul', 'items'],
    queryFn: () => api.items(MERCHANT_ID),
    enabled: MERCHANT_ID.length > 0,
  });

  if (!MERCHANT_ID) {
    return (
      <Screen>
        <Header title={t.zonazul.title} />
        <Text style={ui.muted}>{t.zonazul.empty}</Text>
      </Screen>
    );
  }

  const items: any[] = Array.isArray((feed.data as any)?.items)
    ? (feed.data as any).items
    : Array.isArray(feed.data)
      ? (feed.data as any[])
      : [];

  return (
    <Screen>
      <Header title={(profile.data as any)?.businessName ?? t.zonazul.title} />
      <Text style={[ui.muted, { marginBottom: 12 }]}>{t.zonazul.subtitle}</Text>
      {!!(profile.data as any)?.description && (
        <Text style={[ui.muted, { marginBottom: 12 }]}>{(profile.data as any).description}</Text>
      )}
      <View style={{ marginBottom: 12 }}>
        <Button
          label={t.zonazul.order}
          onPress={() =>
            router.push({ pathname: '/(public)/menu/[id]', params: { id: MERCHANT_ID } })
          }
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(it, i) => it?.id ?? String(i)}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={ui.muted}>{t.zonazul.empty}</Text>}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: tokens.color.ink, fontWeight: '700', flex: 1 }}>
                {item.name}
              </Text>
              <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>
                ₡{Number(item.price ?? 0).toLocaleString()}
              </Text>
            </View>
            {!!item.description && (
              <Text style={[ui.muted, { marginTop: 4 }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </Card>
        )}
      />
    </Screen>
  );
}
