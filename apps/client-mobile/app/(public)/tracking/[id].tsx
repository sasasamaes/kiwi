import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, StatusBadge, tokens } from '@kiwi/mobile-ui';
import { TrackingMap } from '../../../src/components/TrackingMap';
import { useTracking } from '../../../src/tracking/useTracking';
import { isPoint } from '../../../src/tracking/eta';
import { Header, Card, ui } from '../../../src/components/ui';

const STEPS: { status: string; label: string }[] = [
  { status: 'pending', label: 'Pedido recibido' },
  { status: 'assigned', label: 'Repartidor asignado' },
  { status: 'in_transit_to_pickup', label: 'En camino al comercio' },
  { status: 'picked_up', label: 'Pedido recogido' },
  { status: 'in_transit_to_delivery', label: 'En camino a tu casa' },
  { status: 'delivered', label: 'Entregado' },
];

function stepIndex(status?: string | null): number {
  const i = STEPS.findIndex((s) => s.status === status);
  return i < 0 ? 0 : i;
}

export default function Tracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, driver, eta, isLoading } = useTracking(id);

  const pickup = order ? { lat: Number(order.pickupLat), lng: Number(order.pickupLng) } : null;
  const delivery = order
    ? { lat: Number(order.deliveryLat), lng: Number(order.deliveryLng) }
    : null;

  const terminal = order?.status === 'delivered' || order?.status === 'cancelled';
  const current = stepIndex(order?.status);
  const progress =
    order?.status === 'delivered' ? 100 : Math.round(((current + 1) / STEPS.length) * 100);

  if (isLoading && !order) {
    return (
      <Screen>
        <ActivityIndicator color={tokens.color.kiwi} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <Header title="Seguimiento" />
        <Text style={ui.muted}>No pudimos cargar el pedido.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Seguimiento" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ marginBottom: 14 }}>
          <TrackingMap
            pickup={isPoint(pickup) ? pickup : null}
            delivery={isPoint(delivery) ? delivery : null}
            driver={driver}
          />
        </View>

        <Card style={{ marginBottom: 14 }}>
          <StatusBadge status={order.status} />
          <Text style={{ color: tokens.color.ink, fontSize: 18, fontWeight: '700', marginTop: 10 }}>
            {order.status === 'delivered'
              ? '¡Entregado!'
              : eta.source === 'none'
                ? 'Calculando tiempo…'
                : `Llega en ~${eta.minutes} min`}
          </Text>
          <Text style={[ui.muted, { marginTop: 4 }]}>
            {order.merchantName ? `${order.merchantName} · ` : ''}
            {order.deliveryAddress}
          </Text>
          {!!driver && <Text style={[ui.muted, { marginTop: 4 }]}>🛵 Repartidor en camino</Text>}
        </Card>

        <View style={styles.progressOuter}>
          <View style={[styles.progressInner, { width: `${progress}%` }]} />
        </View>

        <Card style={{ marginTop: 14 }}>
          {STEPS.map((s, i) => {
            const done = i <= current && !terminal;
            const isDone = i <= current;
            return (
              <View key={s.status} style={styles.step}>
                <Text style={{ color: isDone ? tokens.color.kiwi : tokens.color.muted }}>
                  {isDone ? '●' : '○'}
                </Text>
                <Text
                  style={{
                    color: isDone ? tokens.color.ink : tokens.color.muted,
                    marginLeft: 10,
                    fontWeight: done && i === current ? '700' : '400',
                  }}
                >
                  {s.label}
                </Text>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = {
  progressOuter: {
    height: 6,
    borderRadius: 999,
    backgroundColor: tokens.color.surface,
    overflow: 'hidden' as const,
  },
  progressInner: { height: 6, backgroundColor: tokens.color.kiwi },
  step: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 6 },
};
