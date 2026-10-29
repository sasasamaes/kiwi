import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Pressable, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Screen, Button, StatusBadge, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { ordersApi } from '../../src/api/orders';
import { driversApi } from '../../src/api/drivers';
import { earningsApi } from '../../src/api/earnings';
import { startLocationTask, stopLocationTask } from '../../src/location/task';
import { http } from '../../src/api/client';
import { secureStorage } from '../../src/api/storage';
import { useSession } from '../../src/session/useSession';
import { createRealtime } from '@kiwi/mobile-core';
import { io } from 'socket.io-client';

const api = ordersApi(http);
const drvApi = driversApi(http);
const earnApi = earningsApi(http);
const WS = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4100/api').replace('/api', '');

// Minutos CR (UTC-6 fijo) de un ISO. Null si inválido.
function crMinutes(v: unknown): number | null {
  const d = new Date(String(v ?? ''));
  if (Number.isNaN(+d)) return null;
  const c = new Date(d.getTime() - 6 * 3600 * 1000);
  return c.getUTCHours() * 60 + c.getUTCMinutes();
}
function crNow(): { dow: number; mins: number } {
  const c = new Date(Date.now() - 6 * 3600 * 1000);
  return { dow: c.getUTCDay(), mins: c.getUTCHours() * 60 + c.getUTCMinutes() };
}

export default function Home() {
  const { t, translate } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const { online, setOnline } = useSession((s) => s);
  const [orders, setOrders] = useState<any[]>([]);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [kycRequired, setKycRequired] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const manualPauseAt = useRef<number | null>(null);
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const kycBlocked = kycRequired && kycStatus !== 'approved';
  const { data } = useQuery({
    queryKey: ['available', online],
    queryFn: () => api.available(),
    enabled: online,
  });
  // Ganado en la semana de corte en curso (sale del balance).
  const bal = useQuery({ queryKey: ['withdraw', 'balance'], queryFn: () => earnApi.balance() });
  const weekEarnings =
    (bal.data as any)?.weekEarnings != null ? Number((bal.data as any).weekEarnings) : null;
  useEffect(() => {
    if (Array.isArray(data)) setOrders(data);
  }, [data]);
  useEffect(() => {
    const rt = createRealtime(io as any, WS, () => secureStorage.getAccess(), {
      onNewOrder: (o) =>
        setOrders((prev) => (prev.some((x) => x.id === (o.id ?? o.orderId)) ? prev : [o, ...prev])),
      onOrderTaken: ({ id, orderId }) =>
        setOrders((prev) => prev.filter((o) => o.id !== (id ?? orderId))),
      onStatusChanged: () => {},
    });
    if (online) rt.connect();
    return () => rt.disconnect();
  }, [online]);

  // Estado real del servidor + KYC: el toggle local solo es espejo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await drvApi.profile();
        if (cancelled) return;
        const st = typeof p?.kycStatus === 'string' ? p.kycStatus : 'pending';
        setKycStatus(st);
        setKycRequired(p?.kycRequired === true);
        if (p?.status === 'available' && !(p?.kycRequired === true && st !== 'approved')) {
          setOnline(true);
        } else if (p?.status !== 'available') {
          setOnline(false);
        }
      } catch {
        // Sin red: se queda el estado local.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setOnline]);

  const toggleOnline = useCallback(
    async (next: boolean) => {
      if (switching) return;
      if (next && kycBlocked) {
        Alert.alert(t.driverHome.kycBlockedTitle, t.driverHome.kycBlockedPending);
        return;
      }
      if (!next) manualPauseAt.current = Date.now();
      setSwitching(true);
      try {
        await drvApi.updateStatus(next ? 'available' : 'offline');
        setOnline(next);
        if (next) {
          // GPS en primer plano + tarea en segundo plano atados al estado.
          const fg = await Location.requestForegroundPermissionsAsync().catch(() => null);
          if (fg?.status === 'granted') {
            const okBg = await startLocationTask().catch(() => false);
            if (!okBg) {
              Alert.alert(t.driverHome.noBgLocation);
            }
          }
        } else {
          setOrders([]);
          await stopLocationTask().catch(() => {});
        }
      } catch {
        Alert.alert(t.driverHome.offline, t.driverHome.kycBlockedOnline);
        // Relee el estado real ante cualquier fallo.
        try {
          const p = await drvApi.profile();
          setOnline(p?.status === 'available');
        } catch {
          // noop
        }
      } finally {
        setSwitching(false);
      }
    },
    [kycBlocked, setOnline, switching, t],
  );

  // Ping de ubicación en primer plano cada 30s mientras está en línea
  // (el fondo lo cubre la tarea nativa). Ahorra batería en background.
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    const ping = async () => {
      if (cancelled || AppState.currentState !== 'active') return;
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        await drvApi.updateLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
      } catch {
        // Sin GPS o sin red: el próximo ping reintenta.
      }
    };
    void ping();
    const id = setInterval(() => void ping(), 30 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [online]);
  // Horario propuesto: si estoy en horario, sin KYC pendiente y en pausa
  // (no manual reciente), me conecto solo. La desconexión la hace el servidor.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (cancelled || onlineRef.current || kycBlocked) return;
      if (manualPauseAt.current && Date.now() - manualPauseAt.current < 30 * 60 * 1000) return;
      let rows: any[] = [];
      try {
        const s = await drvApi.schedule();
        rows = Array.isArray(s) ? s : [];
      } catch {
        return;
      }
      const { dow, mins } = crNow();
      const inside = rows.some((r) => {
        if (Number(r?.dayOfWeek) !== dow || r?.isAvailable === false) return false;
        const a = crMinutes(r?.startTime);
        const b = crMinutes(r?.endTime);
        return a != null && b != null && a <= mins && mins < b;
      });
      if (!inside || cancelled) return;
      try {
        await drvApi.updateStatus('available');
        if (cancelled) return;
        setOnline(true);
        setAutoMsg(t.driverHome.autoConnected);
        await startLocationTask().catch(() => {});
      } catch {
        // Reintenta en el próximo tick.
      }
    };
    void check();
    const id = setInterval(() => void check(), 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [kycBlocked, setOnline, t]);
  const accept = useCallback(
    async (id: string) => {
      await api.accept(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      router.push(`/(app)/order/${id}`);
    },
    [router],
  );
  return (
    <Screen>
      {kycBlocked && (
        <View
          style={{
            backgroundColor: '#fef2f2',
            borderRadius: tokens.radius.md,
            padding: tokens.space[3],
            marginBottom: tokens.space[3],
          }}
        >
          <Text style={{ fontWeight: '700', color: '#b91c1c' }}>
            🪪 {t.driverHome.kycBlockedTitle}
          </Text>
          <Text style={{ color: '#b91c1c', fontSize: 12, marginTop: 4 }}>
            {kycStatus === 'rejected'
              ? t.driverHome.kycBlockedRejected
              : kycStatus === 'under_review' || kycStatus === 'submitted'
                ? t.driverHome.kycBlockedReview
                : t.driverHome.kycBlockedPending}
          </Text>
          {kycStatus !== 'under_review' && kycStatus !== 'submitted' && (
            <Pressable
              onPress={() => router.push('/(app)/kyc')}
              style={{
                marginTop: tokens.space[2],
                backgroundColor: '#b91c1c',
                borderRadius: tokens.radius.md,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t.driverHome.kycBlockedCta}</Text>
            </Pressable>
          )}
        </View>
      )}
      {autoMsg && (
        <View
          style={{
            backgroundColor: '#f0fdf4',
            borderRadius: tokens.radius.md,
            padding: tokens.space[3],
            marginBottom: tokens.space[3],
          }}
        >
          <Text style={{ color: '#15803d', fontSize: 12, fontWeight: '600' }}>{autoMsg}</Text>
        </View>
      )}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.space[4],
        }}
      >
        <Text style={{ color: tokens.color.ink, fontWeight: '700', fontSize: 18 }}>
          {online ? t.driverHome.online : t.driverHome.offline}
        </Text>
        <Switch value={online} onValueChange={(v) => void toggleOnline(v)} disabled={switching} />
      </View>
      {weekEarnings != null && (
        <View
          style={{
            backgroundColor: '#f0fdf4',
            borderRadius: tokens.radius.md,
            padding: tokens.space[3],
            marginBottom: tokens.space[3],
          }}
        >
          <Text style={{ color: '#15803d', fontSize: 13, fontWeight: '700' }}>
            {translate('driverHome.weekCut', {
              amount: Math.round(weekEarnings).toLocaleString(),
            })}
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: tokens.space[3] }}>
        <Pressable
          onPress={() => router.push('/(app)/earnings')}
          style={{
            flex: 1,
            backgroundColor: tokens.color.surface,
            borderRadius: tokens.radius.md,
            paddingVertical: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: tokens.color.ink, fontWeight: '600' }}>{t.earnings.title}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          style={{
            flex: 1,
            backgroundColor: tokens.color.surface,
            borderRadius: tokens.radius.md,
            paddingVertical: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: tokens.color.ink, fontWeight: '600' }}>{t.profile.title}</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: tokens.space[3] }}>
        {(
          [
            { route: '/(app)/active', label: t.driverActive.title },
            { route: '/(app)/history', label: t.driverHistory.title },
            { route: '/(app)/schedule', label: t.driverHours.title },
            { route: '/(app)/scheduled', label: t.driverScheduled.title },
          ] as const
        ).map((b) => (
          <Pressable
            key={b.route}
            onPress={() => router.push(b.route)}
            style={{
              flex: 1,
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.md,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: tokens.color.ink, fontWeight: '600', fontSize: 12 }}>
              {b.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: tokens.space[3] }}>
        {(
          [
            { route: '/(app)/ranking', label: t.driverRanking.title },
            { route: '/(app)/analytics', label: t.driverStats.title },
          ] as const
        ).map((b) => (
          <Pressable
            key={b.route}
            onPress={() => router.push(b.route)}
            style={{
              flex: 1,
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.md,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: tokens.color.ink, fontWeight: '600', fontSize: 12 }}>
              {b.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.lg,
              padding: tokens.space[4],
              marginBottom: tokens.space[3],
            }}
          >
            <StatusBadge
              status={item.status ?? 'pending'}
              labels={{
                pending: t.order.pending,
                assigned: t.order.assigned,
                picked_up: t.order.pickedUp,
                delivered: t.order.delivered,
                cancelled: t.order.cancelled,
                no_driver: t.order.noDriver,
              }}
            />
            <Text style={{ color: tokens.color.ink, marginTop: 8, fontWeight: '600' }}>
              {item.isTest ? '🧪 TEST · ' : ''}
              {item.merchant?.businessName ?? item.pickupAddress}
            </Text>
            <Text style={{ color: tokens.color.muted, fontSize: 12 }}>{item.deliveryAddress}</Text>
            <View style={{ marginTop: tokens.space[3] }}>
              <Button label={t.driverHome.accept} onPress={() => accept(item.id)} />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: tokens.color.muted }}>
            {online ? t.driverHome.noOrders : t.driverHome.connectHint}
          </Text>
        }
      />
    </Screen>
  );
}
