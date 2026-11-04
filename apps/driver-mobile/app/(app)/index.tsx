import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Bike, CircleOff } from 'lucide-react-native';
import {
  Screen,
  Button,
  StatusBadge,
  Card,
  GradientHeader,
  Stat,
  EmptyState,
} from '@kiwi/mobile-ui';
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
  const { t } = useTranslation();
  const router = useRouter();
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
        <View className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/30">
          <Text className="text-sm font-semibold text-red-700 dark:text-red-300">
            🪪 {t.driverHome.kycBlockedTitle}
          </Text>
          <Text className="mt-1 text-xs text-red-600 dark:text-red-400">
            {kycStatus === 'rejected'
              ? t.driverHome.kycBlockedRejected
              : kycStatus === 'under_review' || kycStatus === 'submitted'
                ? t.driverHome.kycBlockedReview
                : t.driverHome.kycBlockedPending}
          </Text>
          {kycStatus !== 'under_review' && kycStatus !== 'submitted' && (
            <Pressable
              onPress={() => router.push('/(app)/kyc')}
              className="mt-3 items-center rounded-xl bg-red-600 py-2.5"
            >
              <Text className="text-sm font-bold text-white">{t.driverHome.kycBlockedCta}</Text>
            </Pressable>
          )}
        </View>
      )}
      {autoMsg && (
        <View className="mb-4 rounded-xl border border-kiwi-200 bg-kiwi-50 px-4 py-3 dark:border-kiwi-800 dark:bg-kiwi-900/30">
          <Text className="text-sm text-kiwi-700 dark:text-kiwi-300">{autoMsg}</Text>
        </View>
      )}

      {/* Status card par PWA */}
      <GradientHeader>
        <View className="flex-row items-center justify-between">
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-bold text-white">
              {online ? t.driverHome.online : t.driverHome.paused}
            </Text>
            <Text className="text-sm text-white/80">
              {online ? t.driverHome.onlineHint : t.driverHome.offlineHint}
            </Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: online }}
            accessibilityLabel={online ? t.driverHome.pauseAria : t.driverHome.resumeAria}
            onPress={() => void toggleOnline(!online)}
            disabled={switching || (kycBlocked && !online)}
            className={`h-14 w-24 rounded-full p-1 ${online ? 'bg-white' : 'bg-white/20'} ${
              switching ? 'opacity-50' : ''
            }`}
          >
            <View
              className={`h-12 w-12 items-center justify-center rounded-full shadow-md ${
                online ? 'bg-kiwi-700' : 'bg-surface-300'
              } ${online ? 'self-end' : 'self-start'}`}
            >
              {online ? <Bike size={24} color="#fff" /> : <CircleOff size={24} color="#71717a" />}
            </View>
          </Pressable>
        </View>
        {online && (
          <View className="mt-4">
            <Text className="text-sm text-white/80">● {t.driverHome.receiving}</Text>
          </View>
        )}
      </GradientHeader>

      {/* Stats par PWA */}
      <View className="mb-4 mt-4 flex-row gap-3">
        <View className="flex-1">
          <Stat
            value={`₡${weekEarnings != null ? Math.round(weekEarnings).toLocaleString() : '—'}`}
            label={t.driverHome.statWeekLabel}
            accent="kiwi"
          />
        </View>
        <View className="flex-1">
          <Stat value={String(orders.length)} label={t.driverHome.statAvailable} accent="gold" />
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <Card>
            <View className="mb-3">
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
            </View>
            <Text className="font-semibold text-surface-800 dark:text-surface-100">
              {item.isTest ? '🧪 TEST · ' : ''}
              {item.merchant?.businessName ?? item.pickupAddress}
            </Text>
            <Text className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
              {item.deliveryAddress}
            </Text>
            {item.driverPayout != null && (
              <Text className="mt-1 text-sm font-bold text-kiwi-700 dark:text-kiwi-400">
                ₡{Number(item.driverPayout).toLocaleString()}
              </Text>
            )}
            <View className="mt-3">
              <Button label={t.driverHome.accept} onPress={() => accept(item.id)} />
            </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          <EmptyState title={online ? t.driverHome.noOrders : t.driverHome.connectHint} />
        }
      />
    </Screen>
  );
}
