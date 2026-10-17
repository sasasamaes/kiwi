import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, StatusBadge, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { TrackingMap } from '../../../src/components/TrackingMap';
import { useTracking } from '../../../src/tracking/useTracking';
import { isPoint } from '../../../src/tracking/eta';
import { Header, Card, ui } from '../../../src/components/ui';

export default function Tracking() {
  const { t, translate } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, driver, eta, isLoading } = useTracking(id);

  const STEPS: { status: string; label: string }[] = [
    { status: 'pending', label: t.tracking.stepReceived },
    { status: 'assigned', label: t.tracking.stepAssigned },
    { status: 'in_transit_to_pickup', label: t.tracking.stepToPickup },
    { status: 'picked_up', label: t.tracking.stepPickedUp },
    { status: 'in_transit_to_delivery', label: t.tracking.stepToHome },
    { status: 'delivered', label: t.tracking.stepDelivered },
  ];

  const pickup = order ? { lat: Number(order.pickupLat), lng: Number(order.pickupLng) } : null;
  const delivery = order
    ? { lat: Number(order.deliveryLat), lng: Number(order.deliveryLng) }
    : null;

  const terminal = order?.status === 'delivered' || order?.status === 'cancelled';
  const stepIndex = (() => {
    const i = STEPS.findIndex((s) => s.status === order?.status);
    return i < 0 ? 0 : i;
  })();
  const progress =
    order?.status === 'delivered' ? 100 : Math.round(((stepIndex + 1) / STEPS.length) * 100);

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
        <Header title={t.tracking.title} />
        <Text style={ui.muted}>{t.tracking.loadFailed}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t.tracking.title} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ marginBottom: 14 }}>
          <TrackingMap
            pickup={isPoint(pickup) ? pickup : null}
            delivery={isPoint(delivery) ? delivery : null}
            driver={driver}
          />
        </View>

        <Card style={{ marginBottom: 14 }}>
          <StatusBadge
            status={order.status}
            labels={{
              pending: t.order.pending,
              assigned: t.order.assigned,
              in_transit_to_pickup: t.tracking.stepToPickup,
              picked_up: t.order.pickedUp,
              in_transit_to_delivery: t.tracking.stepToHome,
              delivered: t.order.delivered,
              cancelled: t.order.cancelled,
              no_driver: t.order.noDriver,
            }}
          />
          <Text style={{ color: tokens.color.ink, fontSize: 18, fontWeight: '700', marginTop: 10 }}>
            {order.status === 'delivered'
              ? t.tracking.delivered
              : eta.source === 'none'
                ? t.tracking.calculating
                : translate('tracking.arrivesIn', { minutes: eta.minutes ?? 0 })}
          </Text>
          <Text style={[ui.muted, { marginTop: 4 }]}>
            {order.merchantName ? `${order.merchantName} · ` : ''}
            {order.deliveryAddress}
          </Text>
          {!!driver && <Text style={[ui.muted, { marginTop: 4 }]}>{t.tracking.driverComing}</Text>}
        </Card>

        <View style={styles.progressOuter}>
          <View style={[styles.progressInner, { width: `${progress}%` }]} />
        </View>

        <Card style={{ marginTop: 14 }}>
          {STEPS.map((s, i) => {
            const done = i <= stepIndex && !terminal;
            const isDone = i <= stepIndex;
            return (
              <View key={s.status} style={styles.step}>
                <Text style={{ color: isDone ? tokens.color.kiwi : tokens.color.muted }}>
                  {isDone ? '●' : '○'}
                </Text>
                <Text
                  style={{
                    color: isDone ? tokens.color.ink : tokens.color.muted,
                    marginLeft: 10,
                    fontWeight: done && i === stepIndex ? '700' : '400',
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
