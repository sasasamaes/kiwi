import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { ratingsApi } from '../../../src/api/ratings';
import { http } from '../../../src/api/http';
import { Card, Field, Header, Pill, ui } from '../../../src/components/ui';

const api = ratingsApi(http);

export default function Rate() {
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
      setError(e?.body?.message ?? 'No pudimos guardar tu calificación.');
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
            ¡Gracias por calificar!
          </Text>
          <View style={{ width: '100%', marginTop: 24 }}>
            <Button
              label="Volver al inicio"
              onPress={() => router.replace('/(public)/comercios')}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Calificá tu pedido" />
      <Card>
        <Text style={ui.sectionTitle}>¿Cómo estuvo el repartidor?</Text>
        <View style={ui.row}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n} estrellas`}
              onPress={() => setRating(n)}
            >
              <Text style={{ fontSize: 34, marginRight: 6 }}>{n <= rating ? '⭐' : '☆'}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[ui.sectionTitle, { marginTop: 16 }]}>¿Llegó a tiempo?</Text>
        <View style={styles.pillRow}>
          <Pill label="Sí" active={onTime === true} onPress={() => setOnTime(true)} />
          <Pill label="No" active={onTime === false} onPress={() => setOnTime(false)} />
        </View>

        <Text style={[ui.sectionTitle, { marginTop: 16 }]}>¿Cuidó tu pedido?</Text>
        <View style={styles.pillRow}>
          <Pill label="Sí" active={careful === true} onPress={() => setCareful(true)} />
          <Pill label="No" active={careful === false} onPress={() => setCareful(false)} />
        </View>

        <View style={{ marginTop: 16 }}>
          <Field
            label="Comentario (opcional)"
            value={comment}
            onChangeText={setComment}
            multiline
          />
        </View>

        {!!error && <Text style={{ color: tokens.color.danger, marginBottom: 8 }}>{error}</Text>}
        <Button label="Enviar" loading={busy} onPress={() => void submit()} />
      </Card>
    </Screen>
  );
}

const styles = {
  pillRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginBottom: 4 },
};
