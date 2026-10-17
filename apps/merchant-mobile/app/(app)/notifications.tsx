import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { notificationsApi } from '../../src/api/notifications';
import { http } from '../../src/api/client';
import { BottomNav } from '../../src/ui/BottomNav';

const api = notificationsApi(http);

function when(iso: string | undefined, locale: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(locale === 'es' ? 'es-CR' : 'en-US');
}

export default function Notifications() {
  const { t, locale } = useTranslation();
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
        <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
          {t.merchantNotifications.title}
        </Text>
        <Button
          label={t.merchantNotifications.markRead}
          variant="secondary"
          onPress={() => markAll.mutate()}
        />
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
              {when(n.createdAt, locale)}
            </Text>
          </Pressable>
        ))}
        {items.length === 0 && (
          <Text style={{ color: tokens.color.muted }}>{t.merchantNotifications.empty}</Text>
        )}
      </ScrollView>
      <BottomNav active="notifications" />
    </Screen>
  );
}
