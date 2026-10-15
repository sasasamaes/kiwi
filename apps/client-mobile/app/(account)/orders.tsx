import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Screen, StatusBadge, tokens } from '@kiwi/mobile-ui';
import { ordersApi } from '../../src/api/orders';
import { http } from '../../src/api/http';
import { Card, Header, ui } from '../../src/components/ui';

const api = ordersApi(http);

export default function Orders() {
  const router = useRouter();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.mine(),
  });
  const orders: any[] = Array.isArray(data) ? data : [];

  return (
    <Screen>
      <Header
        title="Mis pedidos"
        right={
          <Pressable onPress={() => router.push('/(account)/profile')}>
            <Text style={{ color: tokens.color.lime, fontWeight: '600' }}>Perfil</Text>
          </Pressable>
        }
      />
      {isLoading ? (
        <ActivityIndicator color={tokens.color.kiwi} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          onRefresh={() => void refetch()}
          refreshing={false}
          ListEmptyComponent={
            <Text style={[ui.muted, { marginTop: 24 }]}>Todavía no tenés pedidos.</Text>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <StatusBadge status={item.status ?? 'pending'} />
                <Text style={ui.muted}>#{String(item.id).slice(0, 8).toUpperCase()}</Text>
              </View>
              <Text style={{ color: tokens.color.ink, fontWeight: '600', marginTop: 8 }}>
                {item.merchant?.businessName ?? item.deliveryAddress}
              </Text>
              <View style={[ui.row, { marginTop: 10, gap: 16 }]}>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/(public)/tracking/[id]', params: { id: item.id } })
                  }
                >
                  <Text style={{ color: tokens.color.lime, fontWeight: '600' }}>Seguir</Text>
                </Pressable>
                {item.status === 'delivered' && (
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/(public)/rate/[id]', params: { id: item.id } })
                    }
                  >
                    <Text style={{ color: tokens.color.amber, fontWeight: '600' }}>Calificar</Text>
                  </Pressable>
                )}
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
