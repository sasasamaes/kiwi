import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { ratingsApi } from '../../../src/api/ratings';
import { http } from '../../../src/api/http';
import { Card, Field, Header, Pill, ui } from '../../../src/components/ui';

const api = ratingsApi(http);

export default function Rate() {
  const { t, translate } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [onTime, setOnTime] = useState<boolean | null>(null);
  const [careful, setCareful] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createPublic(id, {
        rating,
        comment: comment.trim() || undefined,
        ...(onTime != null ? { onTime } : {}),
        ...(careful != null ? { carefulWithOrder: careful } : {}),
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.body?.message ?? t.rating.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 56 }}>⭐</Text>
          <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700', marginTop: 12 }}>
            {t.rating.thanks}
          </Text>
          <View style={{ width: '100%', marginTop: 24 }}>
            <Button
              label={t.rating.backHome}
              onPress={() => router.replace('/(public)/comercios')}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t.rating.title} />
      <Card>
        <Text style={ui.sectionTitle}>{t.rating.driverHow}</Text>
        <View style={ui.row}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={translate('customer.stars', { count: n })}
              onPress={() => setRating(n)}
            >
              <Text style={{ fontSize: 34, marginRight: 6 }}>{n <= rating ? '⭐' : '☆'}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[ui.sectionTitle, { marginTop: 16 }]}>{t.rating.onTime}</Text>
        <View style={styles.pillRow}>
          <Pill label={t.app.yes} active={onTime === true} onPress={() => setOnTime(true)} />
          <Pill label={t.app.no} active={onTime === false} onPress={() => setOnTime(false)} />
        </View>

        <Text style={[ui.sectionTitle, { marginTop: 16 }]}>{t.rating.cared}</Text>
        <View style={styles.pillRow}>
          <Pill label={t.app.yes} active={careful === true} onPress={() => setCareful(true)} />
          <Pill label={t.app.no} active={careful === false} onPress={() => setCareful(false)} />
        </View>

        <View style={{ marginTop: 16 }}>
          <Field label={t.rating.comment} value={comment} onChangeText={setComment} multiline />
        </View>

        {!!error && <Text style={{ color: tokens.color.danger, marginBottom: 8 }}>{error}</Text>}
        <Button label={t.rating.send} loading={busy} onPress={() => void submit()} />
      </Card>
    </Screen>
  );
}

const styles = {
  pillRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginBottom: 4 },
};
