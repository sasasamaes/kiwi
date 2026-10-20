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
const MAX_ESTIMATE = 15000;
const rid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function Mandados() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [store, setStore] = useState('');
  const [address, setAddress] = useState('');
  const [list, setList] = useState('');
  const [estimate, setEstimate] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [delivery, setDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [placedId, setPlacedId] = useState<string | null>(null);

  const estimateNum = Math.round(Number(estimate) || 0);
  const estimateOk = estimateNum >= 1 && estimateNum <= MAX_ESTIMATE;
  const valid =
    store.trim() &&
    address.trim() &&
    list.trim() &&
    estimateOk &&
    senderName.trim() &&
    senderPhone.trim() &&
    delivery.trim();

  const submit = async () => {
    if (!valid || busy) return;
    if (!estimateOk) {
      Alert.alert(t.mandados.estimateError);
      return;
    }
    setBusy(true);
    try {
      const order = await api.createMandado(
        {
          customerName: senderName.trim(),
          customerPhone: senderPhone.trim(),
          pickupAddress: address.trim(),
          deliveryAddress: delivery.trim(),
          packageDescription: list.trim(),
          purchaseStore: store.trim(),
          purchaseEstimate: estimateNum,
          specialInstructions: notes.trim() || undefined,
        },
        rid(),
      );
      setPlacedId(order?.id ?? '');
    } catch (e: any) {
      Alert.alert(t.mandados.failed, e?.body?.message ?? e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Screen>
        <Header title={t.mandados.title} />
        <Text style={ui.muted}>{t.mandados.loginRequired}</Text>
        <View style={{ marginTop: 12 }}>
          <Button label={t.customer.login} onPress={() => router.push('/(auth)/login')} />
        </View>
      </Screen>
    );
  }

  if (placedId) {
    return (
      <Screen>
        <Header title={t.mandados.title} />
        <Text style={{ color: tokens.color.ink, fontSize: 16 }}>{t.mandados.success}</Text>
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
      <Header title={t.mandados.title} />
      <Text style={[ui.muted, { marginBottom: 12 }]}>{t.mandados.subtitle}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Field
          label={t.mandados.store}
          value={store}
          onChangeText={setStore}
          placeholder={t.mandados.storePh}
        />
        <Field label={t.mandados.address} value={address} onChangeText={setAddress} />
        <Field
          label={t.mandados.list}
          value={list}
          onChangeText={setList}
          placeholder={t.mandados.listPh}
          multiline
        />
        <Field
          label={t.mandados.estimate}
          value={estimate}
          onChangeText={(v) => setEstimate(v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
        />
        <Text style={[ui.muted, { marginBottom: 12 }]}>{t.mandados.estimateHint}</Text>
        <Field label={t.mandados.senderName} value={senderName} onChangeText={setSenderName} />
        <Field
          label={t.mandados.senderPhone}
          value={senderPhone}
          onChangeText={setSenderPhone}
          keyboardType="phone-pad"
        />
        <Field label={t.mandados.delivery} value={delivery} onChangeText={setDelivery} />
        <Field label={t.mandados.notes} value={notes} onChangeText={setNotes} multiline />
        <Text style={[ui.muted, { marginBottom: 12 }]}>{t.mandados.feeNote}</Text>
        <Card style={{ marginTop: 4 }}>
          <Button
            label={busy ? t.mandados.sending : t.mandados.submit}
            loading={busy}
            onPress={() => void submit()}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
