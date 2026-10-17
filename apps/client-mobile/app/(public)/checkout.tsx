import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Button, Price, Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { ordersApi } from '../../src/api/orders';
import { paymentsApi } from '../../src/api/payments';
import { geocodingApi } from '../../src/api/geocoding';
import { http } from '../../src/api/http';
import { orderQueue } from '../../src/order/useQueue';
import { createIdempotencyManager } from '../../src/order/idempotency';
import { startHostedCheckout } from '../../src/payments/checkout';
import {
  EMPTY_SCHEDULE,
  isValidSchedule,
  scheduleFields,
  todayCR,
  type ScheduleValue,
} from '../../src/order/schedule';
import { cartStore, useCart } from '../../src/cart/useCart';
import { useSession } from '../../src/session/useSession';
import { Card, Field, Header, Pill, ui } from '../../src/components/ui';

const orders = ordersApi(http);
const payments = paymentsApi(http);
const geocoding = geocodingApi(http);
const SCHEME = 'kiwicliente';

type PaymentMethod = 'cash' | 'sinpe' | 'card' | 'crypto';

const genKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function Checkout() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    merchantId: string;
    merchantName?: string;
    pickupAddress?: string;
    isHomeCook?: string;
  }>();
  const merchantId = params.merchantId;
  const isHomeCook = params.isHomeCook === '1';

  const lines = useCart((s) => s.lines);
  const user = useSession((s) => s.user);

  const [mode, setMode] = useState<'delivery' | 'pickup'>('delivery');
  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [zone, setZone] = useState('');
  const [addrQuery, setAddrQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [schedule, setSchedule] = useState<ScheduleValue>(EMPTY_SCHEDULE);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Idempotency: one key per checkout, reused across retries, reset after a
  // successful order (see C6).
  const [checkoutId] = useState(() => genKey());
  const [idem] = useState(() => createIdempotencyManager(genKey));

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [lines],
  );

  const searchQuery = useQuery({
    queryKey: ['geo', addrQuery],
    enabled: addrQuery.trim().length >= 3,
    queryFn: () => geocoding.search(addrQuery.trim(), 5),
  });
  const results: any[] = Array.isArray(searchQuery.data) ? searchQuery.data : [];

  const phoneDigits = phone.replace(/\D/g, '');
  const canPlace =
    lines.length > 0 &&
    name.trim().length > 0 &&
    phoneDigits.length >= 8 &&
    (mode === 'pickup' || address.trim().length > 0) &&
    isValidSchedule(schedule) &&
    (method !== 'cash' || cashTendered === '' || Number(cashTendered) >= subtotal);

  const useMyLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setError(t.checkout.locationPermission);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCoords({ lat, lng });
      const [rev, near] = await Promise.all([
        geocoding.reverse(lat, lng).catch(() => null),
        geocoding.nearestZone(lat, lng).catch(() => null),
      ]);
      if (rev?.displayName) setAddress(rev.displayName);
      if (near?.zone?.id) setZone(String(near.zone.id));
    } catch {
      setError(t.checkout.locationFailed);
    } finally {
      setLocating(false);
    }
  };

  const pickResult = (r: any) => {
    setAddress(String(r.displayName ?? r.shortName ?? ''));
    setCoords({ lat: Number(r.lat), lng: Number(r.lng) });
    setAddrQuery('');
  };

  const authed = !!user && user.role === 'customer';

  const place = async () => {
    if (!canPlace || busy) return;
    setBusy(true);
    setError(null);
    try {
      const deliveryAddress =
        mode === 'pickup' ? params.pickupAddress || t.checkout.pickupFallback : address;
      const body = {
        merchantId,
        pickupAddress: params.pickupAddress || t.checkout.defaultPickup,
        deliveryAddress,
        deliveryZone: zone || undefined,
        ...scheduleFields(schedule),
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          name: l.name,
          price: l.unitPrice,
          quantity: l.quantity,
          variants: l.selectedOptions.map((s) => ({ optionId: s.optionId })),
        })),
        specialInstructions: notes || undefined,
        distanceKm: 2.5,
        customerPhone: phoneDigits,
        customerName: name.trim(),
        paymentMethod: method,
        ...(coords ? { deliveryLat: coords.lat, deliveryLng: coords.lng } : {}),
      };

      const key = idem.keyFor(checkoutId);
      let orderId: string;
      try {
        const result = await orderQueue.submit(checkoutId, body, authed, key);
        if (result.queued) {
          idem.reset(checkoutId);
          cartStore.getState().clear();
          router.replace('/(account)/orders');
          return;
        }
        orderId = result.order?.id;
      } catch (e: any) {
        setError(e?.body?.message ?? e?.message ?? t.checkout.createFailed);
        return;
      }

      if (!orderId) {
        setError(t.checkout.noOrderId);
        return;
      }

      // Payment setup (server prices from the order total; amount omitted).
      if (method !== 'cash') {
        const payBody: any = { orderId, method: methodPayload(method) };
        if (method === 'sinpe') payBody.customerPhone = phoneDigits;
        if (method === 'crypto') payBody.cryptoCoin = 'USDC';
        try {
          const payment: any = authed
            ? await payments.createAuthed(payBody)
            : await payments.createGuest(payBody);
          if ((method === 'sinpe' || method === 'card') && payment?.checkoutUrl) {
            await startHostedCheckout({
              checkoutUrl: payment.checkoutUrl,
              scheme: SCHEME,
              api: payments,
              orderId,
              guest: !authed,
            });
          }
        } catch {
          // Order exists; surface that payment could not be started.
        }
      }

      idem.reset(checkoutId);
      cartStore.getState().clear();
      router.replace({ pathname: '/(public)/tracking/[id]', params: { id: orderId } });
    } finally {
      setBusy(false);
    }
  };

  if (lines.length === 0) {
    return (
      <Screen>
        <Header title={t.checkout.title} />
        <Text style={ui.muted}>{t.checkout.cartEmpty}</Text>
      </Screen>
    );
  }

  const paymentOptions: [PaymentMethod, string][] = [
    ['cash', t.checkout.cash],
    ['sinpe', t.checkout.sinpe],
    ['card', t.checkout.card],
    ['crypto', t.checkout.crypto],
  ];

  return (
    <Screen>
      <Header title={t.checkout.title} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Card style={{ marginBottom: 14 }}>
          <Text style={ui.sectionTitle}>{params.merchantName || t.checkout.yourOrder}</Text>
          {lines.map((l) => (
            <View key={l.lineId} style={styles.line}>
              <Text style={{ color: tokens.color.ink, flex: 1 }}>
                {l.quantity}× {l.name}
              </Text>
              <Price amount={l.unitPrice * l.quantity} />
            </View>
          ))}
          <View style={[styles.line, { marginTop: 8 }]}>
            <Text style={[ui.muted, { flex: 1 }]}>{t.checkout.subtotalProducts}</Text>
            <Price amount={subtotal} />
          </View>
          <Text style={[ui.muted, { marginTop: 4 }]}>{t.checkout.serviceNote}</Text>
        </Card>

        <Text style={ui.sectionTitle}>{t.checkout.deliveryTitle}</Text>
        <View style={styles.pillRow}>
          <Pill
            label={t.checkout.homeDelivery}
            active={mode === 'delivery'}
            onPress={() => setMode('delivery')}
          />
          <Pill
            label={t.checkout.storePickup}
            active={mode === 'pickup'}
            onPress={() => setMode('pickup')}
          />
        </View>

        <Field
          label={t.checkout.yourName}
          value={name}
          onChangeText={setName}
          placeholder={t.auth.fullName}
        />
        <Field
          label={t.checkout.phone}
          value={phone}
          onChangeText={setPhone}
          placeholder="8888-1234"
          keyboardType="phone-pad"
        />

        {mode === 'delivery' && (
          <>
            <Field label={t.checkout.deliveryAddress} value={address} onChangeText={setAddress} />
            <Button
              label={locating ? t.checkout.locating : t.checkout.useMyLocation}
              variant="secondary"
              loading={locating}
              onPress={() => void useMyLocation()}
            />
            <View style={{ height: 10 }} />
            <Field
              label={t.checkout.searchAddress}
              value={addrQuery}
              onChangeText={setAddrQuery}
              placeholder={t.checkout.addressHint}
            />
            {searchQuery.isFetching && <ActivityIndicator color={tokens.color.kiwi} />}
            {results.map((r) => (
              <Pressable key={String(r.placeId ?? r.displayName)} onPress={() => pickResult(r)}>
                <Card style={{ marginBottom: 8 }}>
                  <Text style={{ color: tokens.color.ink }}>{r.displayName}</Text>
                </Card>
              </Pressable>
            ))}
            <Field label={t.checkout.zoneOptional} value={zone} onChangeText={setZone} />
          </>
        )}

        <Field label={t.checkout.notesOptional} value={notes} onChangeText={setNotes} multiline />

        <Text style={[ui.sectionTitle, { marginTop: 8 }]}>{t.checkout.whenTitle}</Text>
        <View style={styles.pillRow}>
          <Pill
            label={t.checkout.now}
            active={schedule.mode === 'now'}
            onPress={() => setSchedule({ ...schedule, mode: 'now' })}
          />
          <Pill
            label={t.checkout.scheduled}
            active={schedule.mode === 'scheduled'}
            onPress={() => setSchedule({ ...schedule, mode: 'scheduled' })}
          />
        </View>
        {schedule.mode === 'scheduled' && (
          <View style={ui.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field
                label={t.checkout.dayLabel}
                value={schedule.date}
                onChangeText={(v) => setSchedule({ ...schedule, date: v })}
                placeholder={todayCR()}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={t.checkout.timeLabel}
                value={schedule.time}
                onChangeText={(v) => setSchedule({ ...schedule, time: v })}
                placeholder="12:30"
              />
            </View>
          </View>
        )}
        {isHomeCook && <Text style={ui.muted}>{t.checkout.homeCookNote}</Text>}

        <Text style={[ui.sectionTitle, { marginTop: 8 }]}>{t.checkout.paymentTitle}</Text>
        <View style={styles.pillRow}>
          {paymentOptions.map(([id, label]) => (
            <Pill key={id} label={label} active={method === id} onPress={() => setMethod(id)} />
          ))}
        </View>
        {method === 'cash' && (
          <Field
            label={t.checkout.cashQuestion}
            value={cashTendered}
            onChangeText={setCashTendered}
            placeholder={String(subtotal)}
            keyboardType="numeric"
          />
        )}

        {!!error && <Text style={{ color: tokens.color.danger, marginTop: 8 }}>{error}</Text>}
      </ScrollView>

      <View style={styles.bar}>
        <View>
          <Text style={ui.muted}>{t.checkout.subtotal}</Text>
          <Price amount={subtotal} />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Button
            label={busy ? t.checkout.processing : t.checkout.pay}
            loading={busy}
            disabled={!canPlace}
            onPress={() => void place()}
          />
        </View>
      </View>
    </Screen>
  );
}

function methodPayload(
  method: PaymentMethod,
): 'onvopay_sinpe' | 'onvopay_card' | 'crypto' | 'cash' {
  if (method === 'sinpe') return 'onvopay_sinpe';
  if (method === 'card') return 'onvopay_card';
  if (method === 'crypto') return 'crypto';
  return 'cash';
}

const styles = {
  line: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 4,
  },
  pillRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginBottom: 12 },
  bar: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    backgroundColor: tokens.color.canvas,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
};
