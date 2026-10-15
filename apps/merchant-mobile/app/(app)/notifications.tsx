import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { notificationsApi } from '../../src/api/notifications';
import { http } from '../../src/api/client';
import { BottomNav } from '../../src/ui/BottomNav';

const api = notificationsApi(http);

function when(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-CR');
}

export default function Notifications() {
  const qc = useQueryClient();
  const { data, isRefetching, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.list(),
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: () => api.markAllRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = data ?? [];

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.space[3],
        }}
      >
        <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>Avisos</Text>
        <Button label="Marcar leídas" variant="secondary" onPress={() => markAll.mutate()} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tokens.space[6] }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
      >
        {items.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => !n.read && markRead.mutate(n.id)}
            style={{
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.lg,
              padding: tokens.space[4],
              marginBottom: tokens.space[3],
              opacity: n.read ? 0.6 : 1,
            }}
          >
            <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>{n.title}</Text>
            <Text style={{ color: tokens.color.ink, marginTop: 4 }}>{n.body}</Text>
            <Text style={{ color: tokens.color.muted, fontSize: 11, marginTop: 6 }}>
              {when(n.createdAt)}
            </Text>
          </Pressable>
        ))}
        {items.length === 0 && (
          <Text style={{ color: tokens.color.muted }}>Sin avisos por ahora.</Text>
        )}
      </ScrollView>
      <BottomNav active="notifications" />
    </Screen>
  );
}
