import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { announceApi } from '../../src/api/announce';
import { http } from '../../src/api/client';
import { BottomNav } from '../../src/ui/BottomNav';

const api = announceApi(http);

export default function Announce() {
  const { t, translate } = useTranslation();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const followers = useQuery({
    queryKey: ['announce', 'followers'],
    queryFn: () => api.followers(),
  });
  const quota = useQuery({ queryKey: ['announce', 'quota'], queryFn: () => api.quota() });

  const q: any = quota.data ?? {};
  const left = Math.max((q.freeTotal ?? 4) - (q.freeUsed ?? 0), 0);
  const canSend = left > 0 || (q.extraCredits ?? 0) > 0;

  const send = useMutation({
    mutationFn: () => api.send(title.trim(), body.trim()),
    onSuccess: (res) => {
      const reached = Number(res?.reached ?? 0);
      Alert.alert(
        reached === 1 ? t.announce.sentOne : translate('announce.sentMany', { count: reached }),
      );
      setTitle('');
      setBody('');
      void qc.invalidateQueries({ queryKey: ['announce', 'quota'] });
    },
    onError: () => Alert.alert(t.announce.failed),
  });

  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {t.announce.title}
      </Text>
      <Text style={{ color: tokens.color.muted, marginTop: 4 }}>
        {translate('announce.followers', {
          count: Number((followers.data as any)?.count ?? 0),
        })}
        {' · '}
        {translate('announce.quota', { left, total: q.freeTotal ?? 4 })}
        {(q.extraCredits ?? 0) > 0
          ? ` (${translate('announce.extra', { count: q.extraCredits })})`
          : ''}
      </Text>

      <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {!canSend && (
          <Text style={{ color: tokens.color.muted, marginBottom: 8 }}>{t.announce.empty}</Text>
        )}
        <TextInput
          placeholder={t.announce.subject}
          placeholderTextColor={tokens.color.muted}
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          style={{
            backgroundColor: tokens.color.surface,
            color: tokens.color.ink,
            borderRadius: tokens.radius.md,
            padding: 12,
            marginBottom: 8,
          }}
        />
        <TextInput
          placeholder={t.announce.body}
          placeholderTextColor={tokens.color.muted}
          value={body}
          onChangeText={setBody}
          maxLength={200}
          multiline
          style={{
            backgroundColor: tokens.color.surface,
            color: tokens.color.ink,
            borderRadius: tokens.radius.md,
            padding: 12,
            minHeight: 90,
            textAlignVertical: 'top',
            marginBottom: 8,
          }}
        />
        <Button
          label={send.isPending ? t.announce.sending : t.announce.send}
          loading={send.isPending}
          onPress={() => send.mutate()}
        />
        <View style={{ height: 8 }} />
      </ScrollView>
      <BottomNav active="profile" />
    </Screen>
  );
}
