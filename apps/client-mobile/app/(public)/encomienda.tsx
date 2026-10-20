import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { encomiendaApi } from '../../src/api/encomienda';
import { http } from '../../src/api/http';
import { useSession } from '../../src/session/useSession';
import { Card, Field, Header, ui } from '../../src/components/ui';

const api = encomiendaApi(http);
const rid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function Encomienda() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [description, setDescription] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [placedId, setPlacedId] = useState<string | null>(null);

  const valid =
    pickup.trim() &&
    delivery.trim() &&
    description.trim() &&
    senderName.trim() &&
    senderPhone.trim();

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const order = await api.create(
        {
          customerName: senderName.trim(),
          customerPhone: senderPhone.trim(),
          pickupAddress: pickup.trim(),
          deliveryAddress: delivery.trim(),
          packageDescription: description.trim(),
          recipientName: recipientName.trim() || undefined,
          recipientPhone: recipientPhone.trim() || undefined,
          specialInstructions: notes.trim() || undefined,
        },
        rid(),
      );
      setPlacedId(order?.id ?? '');
    } catch (e: any) {
      Alert.alert(t.encomienda.failed, e?.body?.message ?? e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Screen>
        <Header title={t.encomienda.title} />
        <Text style={ui.muted}>{t.encomienda.loginRequired}</Text>
        <View style={{ marginTop: 12 }}>
          <Button label={t.customer.login} onPress={() => router.push('/(auth)/login')} />
        </View>
      </Screen>
    );
  }

  if (placedId) {
    return (
      <Screen>
        <Header title={t.encomienda.title} />
        <Text style={{ color: tokens.color.ink, fontSize: 16 }}>{t.encomienda.success}</Text>
        <View style={{ marginTop: 12 }}>
          <Button
            label={t.customer.track}
            onPress={() =>
              router.replace({ pathname: '/(public)/tracking/[id]', params: { id: placedId } })
            }
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t.encomienda.title} />
      <Text style={[ui.muted, { marginBottom: 12 }]}>{t.encomienda.subtitle}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Field label={t.encomienda.pickup} value={pickup} onChangeText={setPickup} />
        <Field label={t.encomienda.delivery} value={delivery} onChangeText={setDelivery} />
        <Field
          label={t.encomienda.description}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Field label={t.encomienda.senderName} value={senderName} onChangeText={setSenderName} />
        <Field
          label={t.encomienda.senderPhone}
          value={senderPhone}
          onChangeText={setSenderPhone}
          keyboardType="phone-pad"
        />
        <Field
          label={t.encomienda.recipientName}
          value={recipientName}
          onChangeText={setRecipientName}
        />
        <Field
          label={t.encomienda.recipientPhone}
          value={recipientPhone}
          onChangeText={setRecipientPhone}
          keyboardType="phone-pad"
        />
        <Field label={t.encomienda.notes} value={notes} onChangeText={setNotes} multiline />
        <Card style={{ marginTop: 4 }}>
          <Button
            label={busy ? t.encomienda.sending : t.encomienda.submit}
            loading={busy}
            onPress={() => void submit()}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
