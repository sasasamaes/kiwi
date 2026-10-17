import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { driversApi } from '../../src/api/drivers';
import { proposalsApi } from '../../src/api/proposals';
import { ordersApi } from '../../src/api/orders';
import { http } from '../../src/api/client';
import { BottomNav } from '../../src/ui/BottomNav';

const drivers = driversApi(http);
const proposals = proposalsApi(http);
const orders = ordersApi(http);

function DriverRow({
  driverId,
  name,
  vehicle,
  rating,
  status,
  onAssign,
  busy,
  assignLabel,
}: {
  driverId: string;
  name: string;
  vehicle?: string;
  rating?: number;
  status?: string;
  onAssign?: (driverId: string) => void;
  busy?: boolean;
  assignLabel: string;
}) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.surface,
        borderRadius: tokens.radius.lg,
        padding: tokens.space[4],
        marginBottom: tokens.space[3],
      }}
    >
      <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>{name}</Text>
      <Text style={{ color: tokens.color.muted, fontSize: 12, marginTop: 2 }}>
        {[vehicle, rating != null ? `${rating}★` : null, status].filter(Boolean).join(' · ')}
      </Text>
      {onAssign && (
        <View style={{ marginTop: tokens.space[3] }}>
          <Button label={assignLabel} loading={busy} onPress={() => onAssign(driverId)} />
        </View>
      )}
    </View>
  );
}

export default function Drivers() {
  const { t, translate } = useTranslation();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const qc = useQueryClient();

  const available = useQuery({
    queryKey: ['drivers', 'available'],
    queryFn: () => drivers.available(),
  });
  const favorites = useQuery({
    queryKey: ['drivers', 'favorites'],
    queryFn: () => drivers.favorites(),
  });

  // Backend limitation: there is no merchant-reachable proposals list route.
  // We read from the order detail; if it returns nothing we render gracefully.
  const orderProposals = useQuery({
    queryKey: ['order', orderId, 'proposals'],
    queryFn: () => proposals.list(orderId as string),
    enabled: !!orderId,
  });

  const assign = useMutation({
    mutationFn: (driverId: string) => orders.assign(orderId as string, driverId),
    onSuccess: () => {
      Alert.alert(t.merchantDrivers.assigned);
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
    onError: (e: any) => Alert.alert(t.merchantDrivers.assignFailed, e?.message ?? ''),
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ driverId, isFav }: { driverId: string; isFav: boolean }) =>
      isFav ? drivers.removeFavorite(driverId) : drivers.addFavorite(driverId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['drivers', 'favorites'] }),
    onError: (e: any) => Alert.alert(t.merchantDrivers.favoriteFailed, e?.message ?? ''),
  });

  const favoriteIds = new Set((favorites.data ?? []).map((f: any) => f.driverId ?? f.driver?.id));

  const assignTo = (driverId: string) => {
    if (!orderId) {
      Alert.alert(t.merchantDrivers.chooseOrder, t.merchantDrivers.chooseOrderHint);
      return;
    }
    assign.mutate(driverId);
  };

  return (
    <Screen>
      <Text
        style={{
          color: tokens.color.ink,
          fontSize: 20,
          fontWeight: '700',
          marginBottom: tokens.space[3],
        }}
      >
        {t.merchantDrivers.title}
      </Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: tokens.space[6] }}>
        {!orderId && (
          <Text style={{ color: tokens.color.amber, fontSize: 12, marginBottom: tokens.space[3] }}>
            {t.merchantDrivers.assignHint}
          </Text>
        )}

        <Text style={{ color: tokens.color.muted, fontWeight: '700', marginBottom: 8 }}>
          {translate('merchantDrivers.available', { count: (available.data ?? []).length })}
        </Text>
        {(available.data ?? []).map((d: any) => (
          <Pressable
            key={d.id}
            onLongPress={() =>
              toggleFavorite.mutate({ driverId: d.id, isFav: favoriteIds.has(d.id) })
            }
          >
            <DriverRow
              driverId={d.id}
              name={`${favoriteIds.has(d.id) ? '★ ' : ''}${d.fullName ?? d.user?.phone ?? t.merchantDrivers.fallbackName}`}
              vehicle={d.vehicleType}
              rating={d.rating}
              status={d.status}
              onAssign={orderId ? assignTo : undefined}
              busy={assign.isPending}
              assignLabel={t.merchantDrivers.assign}
            />
          </Pressable>
        ))}
        {available.isSuccess && (available.data ?? []).length === 0 && (
          <Text style={{ color: tokens.color.muted, fontSize: 12, marginBottom: tokens.space[4] }}>
            {t.merchantDrivers.noneConnected}
          </Text>
        )}

        <Text
          style={{
            color: tokens.color.muted,
            fontWeight: '700',
            marginTop: tokens.space[4],
            marginBottom: 8,
          }}
        >
          {translate('merchantDrivers.favorites', { count: (favorites.data ?? []).length })}
        </Text>
        {(favorites.data ?? []).map((f: any) => {
          const d = f.driver ?? f;
          return (
            <Pressable
              key={f.id ?? d.id}
              onLongPress={() => toggleFavorite.mutate({ driverId: d.id, isFav: true })}
            >
              <DriverRow
                driverId={d.id}
                name={d.fullName ?? t.merchantDrivers.fallbackName}
                vehicle={d.vehicleType}
                rating={d.rating}
                status={d.status}
                onAssign={orderId ? assignTo : undefined}
                busy={assign.isPending}
                assignLabel={t.merchantDrivers.assign}
              />
            </Pressable>
          );
        })}
        {favorites.isSuccess && (favorites.data ?? []).length === 0 && (
          <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
            {t.merchantDrivers.noneFavYet}
          </Text>
        )}

        {orderId && (
          <>
            <Text
              style={{
                color: tokens.color.muted,
                fontWeight: '700',
                marginTop: tokens.space[4],
                marginBottom: 8,
              }}
            >
              {translate('merchantDrivers.proposals', {
                count: (orderProposals.data ?? []).length,
              })}
            </Text>
            {(orderProposals.data ?? []).length === 0 ? (
              <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
                {t.merchantDrivers.noProposals}
              </Text>
            ) : (
              (orderProposals.data ?? []).map((p: any) => (
                <DriverRow
                  key={p.id}
                  driverId={p.driver?.id ?? p.driverId}
                  name={p.driver?.fullName ?? t.merchantDrivers.proposalFallback}
                  vehicle={p.driver?.vehicleType}
                  rating={p.driver?.rating}
                  onAssign={(driverId) => assignTo(driverId)}
                  busy={assign.isPending}
                  assignLabel={t.merchantDrivers.assign}
                />
              ))
            )}
          </>
        )}

        <Text style={{ color: tokens.color.muted, fontSize: 11, marginTop: tokens.space[4] }}>
          {t.merchantDrivers.longPressHint}
        </Text>
      </ScrollView>
      <BottomNav active="drivers" />
    </Screen>
  );
}
