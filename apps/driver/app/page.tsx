// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BottomNav } from './components/BottomNav';
import DriverLanding from './landing/page';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AnimatedButton,
  AnimatedCounter,
  TapButton,
  StaggerContainer,
  StaggerItem,
  VehicleBadge,
  ThemeToggle,
  useTranslations,
  LanguageSwitcherCompact,
  useAuth,
  useSocket,
  useNotifications,
  usePushNotifications,
  playNotificationSound,
  api,
  events,
  Order,
  staggerContainer,
  KiwiLoader,
  KiwiLogo,
  isHttpUrl,
  isEmojiImage,
} from '@kiwi/ui';
import {
  ClipboardList,
  Package,
  Truck,
  MapPin,
  Home as HomeIcon,
  Star,
  DollarSign,
  Target,
  Bike,
  Circle,
  CheckCircle2,
  CircleOff,
  Clock,
} from 'lucide-react';

/** Etiqueta de recogida rápida: "Recoger 18:20" o "en 14 min". Null si no trae readyAt. */
function readyLabel(
  readyAt: unknown,
  t: (key: string, vars?: Record<string, string | number>) => string,
  locale: string,
): string | null {
  if (!readyAt) return null;
  const ts = new Date(String(readyAt)).getTime();
  if (!Number.isFinite(ts)) return null;
  const mins = Math.max(0, Math.round((ts - Date.now()) / 60000));
  const hh = new Date(ts).toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-CR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return mins <= 0
    ? t('wdrvauth.home.readyTime', { hh })
    : t('wdrvauth.home.readyIn', { hh, mins });
}

/** Mensaje exacto según el paso que falló (permiso vs token vs servidor). */
function pushErrorMessage(
  t: (key: string, vars?: Record<string, string | number>) => string,
  reason?: string,
): string {
  switch (reason) {
    case 'denied':
      return t('wdrvauth.home.pushErrDenied');
    case 'no-push-manager':
    case 'unsupported':
      return t('wdrvauth.home.pushErrUnsupported');
    case 'missing-vapid':
    case 'missing-config':
      return t('wdrvauth.home.pushErrConfig');
    case 'sync-failed':
      return t('wdrvauth.home.pushErrSync');
    case 'token-failed':
      return t('wdrvauth.home.pushErrToken');
    default:
      return t('wdrvauth.home.pushErrDefault');
  }
}

export default function Home() {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [kycRequired, setKycRequired] = useState(false);
  const [kycRejection, setKycRejection] = useState<string | null>(null);
  // Sin KYC aprobado no hay pedidos: el backend bloquea asignar/aceptar.
  const kycBlocked = kycRequired && kycStatus !== 'approved';
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  // Pausa manual: no reconectar solo por horario hasta 30 min después.
  const manualPauseAt = useRef<number | null>(null);
  const kycBlockedRef = useRef(false);
  const [stats, setStats] = useState({ trips: 0, earnings: 0, rating: 5.0 });
  const [sinceCut, setSinceCut] = useState<number | null>(null);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [newOrderAlert, setNewOrderAlert] = useState<any>(null);
  const [acceptingOrder, setAcceptingOrder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'delivery' | 'trip' | 'freight'>('all');
  const [pageError, setPageError] = useState<string | null>(null);
  const { addNotification } = useNotifications();
  // Push web: avisa pedidos nuevos con la app cerrada o en segundo plano.
  // El permiso lo pide el botón del banner (el navegador exige gesto).
  const {
    isSupported: pushSupported,
    needsInstall: pushNeedsInstall,
    unsupportedReason: pushUnsupported,
    permission: pushPermission,
    requestPermission: requestPushPermission,
    pushDebug,
  } = usePushNotifications({ enabled: false });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushDetail, setPushDetail] = useState<string | null>(null);

  const tabs = [
    { id: 'all' as const, label: t('wdrvauth.home.tabAll'), icon: ClipboardList },
    { id: 'delivery' as const, label: t('wdrvauth.home.tabDelivery'), icon: Package },
    { id: 'trip' as const, label: t('wdrvauth.home.tabTrips'), icon: Bike },
    { id: 'freight' as const, label: t('wdrvauth.home.tabFreight'), icon: Truck },
  ];

  // El socket no sabe si estás offline: el backend solo targetea a
  // disponibles, pero este guard evita que un evento viejo te pinte
  // pedidos cuando pausaste.
  const isOnlineRef = useRef(isOnline);
  // Espejos para leer visibilidad dentro de callbacks de socket sin
  // cierres viejos (availableOrders/newOrderAlert del primer render).
  const availableRef = useRef<Order[]>([]);
  const alertRef = useRef<any>(null);
  const activeOrdersRef = useRef<Order[]>([]);
  // Sincronizados en efecto (no durante el render): escribir refs en el
  // render rompe en StrictMode/concurrent al descartar renders.
  useEffect(() => {
    isOnlineRef.current = isOnline;
    availableRef.current = availableOrders;
    alertRef.current = newOrderAlert;
    activeOrdersRef.current = activeOrders;
    kycBlockedRef.current = kycBlocked;
  }, [isOnline, availableOrders, newOrderAlert, activeOrders, kycBlocked]);

  // Saca un pedido de Disponibles + popup cuando deja de estar vigente.
  const removeFromAvailable = useCallback((data: any) => {
    const goneId = data?.id ?? data?.orderId;
    const st = data?.status;
    if (!goneId) return false;
    // Sin estado o con estado no-pending: ya no se puede aceptar.
    if (st !== undefined && (st === 'pending' || st === 'driver_proposals')) return false;
    const wasVisible =
      availableRef.current.some((o) => o.id === goneId) ||
      (alertRef.current && (alertRef.current.id ?? alertRef.current.orderId) === goneId);
    setAvailableOrders((prev) => prev.filter((o) => o.id !== goneId));
    setNewOrderAlert((prev) => {
      const prevId = prev?.id ?? prev?.orderId;
      return prevId === goneId ? null : prev;
    });
    return wasVisible;
  }, []);

  // Real-time socket connection
  const {
    isConnected,
    onNewOrder,
    onOrderStatusChanged,
    on: onSocketEvent,
    updateDriverStatus: socketUpdateStatus,
    updateDriverLocation: emitDriverLocation,
  } = useSocket({
    onConnect: () => console.log('🟢 Driver connected to real-time'),
    onNewOrder: (data) => {
      if (!isOnlineRef.current) return;
      console.log('New order available:', data);
      // Normalizar: el evento trae orderId; la lista trabaja con id.
      // Sin esto Aceptar llamaba a /orders/undefined/accept.
      const id = data?.id ?? data?.orderId;
      if (!id) return;
      const normalized = { ...data, id };
      // La creación emite hasta 2 veces (REST + socket): no duplicar.
      setAvailableOrders((prev) => (prev.some((o) => o.id === id) ? prev : [normalized, ...prev]));
      setNewOrderAlert((prev) => {
        const prevId = prev?.id ?? prev?.orderId;
        return prevId ? prev : normalized;
      });
      playNotificationSound('new_order');
    },
    onOrderStatusChanged: (data) => {
      console.log('Order status changed:', data);
      playNotificationSound('order_update');
      // Refresh active orders
      fetchActiveOrders();
      // Fantasmas fuera: si otro driver tomó/canceló un disponible, sacarlo
      // de la lista en vez de esperar un refetch manual.
      removeFromAvailable(data);
    },
    onOrderAccepted: (data) => {
      // Otro driver aceptó: el pedido ya no está disponible para mí.
      removeFromAvailable(data);
    },
    onOrderTaken: (data) => {
      // El primero que lo acepta lo toma: sale de Disponibles en vivo y se
      // dice QUIÉN lo agarró (no un genérico "ya no disponible").
      // silent = asignación directa del comercio: solo desaparecer, sin
      // sonido ni banner para la flota (el aviso fue solo al elegido).
      // Reasignación del admin: también sale de mis Activos al momento (el
      // refetch de statusChanged llega después y puede perderse con 3G).
      const goneId = data?.id ?? data?.orderId;
      if (goneId) setActiveOrders((prev) => prev.filter((o) => o.id !== goneId));
      const wasVisible = removeFromAvailable({ ...data, status: data?.status ?? 'assigned' });
      if (wasVisible && !data?.silent) {
        const winner = data?.driverName;
        playNotificationSound('order_update');
        addNotification({
          type: 'order_status',
          title: t('wdrvauth.home.takenTitle'),
          body: winner
            ? t('wdrvauth.home.takenWithName', { name: winner })
            : t('wdrvauth.home.takenOther'),
        });
      }
    },
  });

  const fetchAvailableOrders = useCallback(async () => {
    try {
      const data = await api.getAvailableOrders();
      const list = Array.isArray(data) ? data : [];
      const seen = new Set<string>();
      setAvailableOrders(
        list.filter((o: any) => {
          if (!o?.id || seen.has(o.id)) return false;
          seen.add(o.id);
          return true;
        }),
      );
    } catch (error) {
      console.error('Failed to fetch available orders:', error);
    }
  }, []);

  // Estados con trabajo pendiente: la cola del repartidor. Se filtra en
  // cliente para no perder pedidos al aceptar otro (getMyOrders('assigned')
  // escondía los que ya van en camino).
  const ACTIVE_STATUSES = [
    'assigned',
    'pending_acceptance',
    'in_transit_to_pickup',
    'picked_up',
    'in_transit_to_delivery',
  ];

  const fetchActiveOrders = useCallback(async () => {
    try {
      const data = await api.getMyOrders();
      const list = Array.isArray(data) ? data : [];
      setActiveOrders(list.filter((o: any) => ACTIVE_STATUSES.includes(o.status)));
    } catch (error) {
      console.error('Failed to fetch active orders:', error);
    }
  }, []);

  // El socket puede perder la reasignación (3G, app en fondo): al reconectar
  // se reconcilia con el servidor para no dejar pedidos fantasma. Y si a mí
  // me reasignan un pedido, aparece sin recargar.
  useEffect(() => {
    if (isConnected && user && !authLoading) fetchActiveOrders();
  }, [isConnected, user, authLoading, fetchActiveOrders]);
  useEffect(() => {
    const off = onSocketEvent('order:assignmentOffered', () => fetchActiveOrders());
    return off;
  }, [onSocketEvent, fetchActiveOrders]);

  useEffect(() => {
    if (authLoading) return;
    // Sin sesión se muestra el landing (página pública de lanzamiento).
    // Otras cuentas (comercio/admin) no entran a la app del repartidor.
    if (!user) return;
    if ((user as any).role && (user as any).role !== 'driver') {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchDriverData = async () => {
      try {
        // Paralelo: perfil + ganancias no dependen entre sí (antes 2 RTT en serie).
        const [profile, earningsRes, kyc, balanceRes] = await Promise.all([
          api.getDriverProfile(),
          api.getDriverEarnings('all').catch(() => null),
          api.getKycStatus().catch(() => null),
          api.getBalance().catch(() => null),
        ]);
        if ((balanceRes as any)?.lastCutAt != null) {
          setSinceCut(Number((balanceRes as any)?.sinceLastCut ?? 0));
        } else {
          setSinceCut(null);
        }
        const kycSt = (kyc as any)?.status ?? (profile as any)?.kycStatus ?? 'pending';
        setKycStatus(typeof kycSt === 'string' ? kycSt : 'pending');
        setKycRequired((profile as any)?.kycRequired === true);
        setKycRejection((kyc as any)?.rejectionReason ?? null);
        const earnings = Number(earningsRes?.totalEarnings || 0);
        const earnedTrips = Number(earningsRes?.totalTrips || 0);
        setStats({
          trips: Math.max(
            Number(profile.totalTrips || 0),
            Number.isFinite(earnedTrips) ? earnedTrips : 0,
          ),
          earnings,
          rating: Number(profile.rating) || 5.0,
        });
        setIsOnline(
          profile.status === 'available' &&
            !((profile as any)?.kycRequired === true && kycSt !== 'approved'),
        );
        // Offline = fuera de la lista: no se piden ni se muestran disponibles.
        // El backend además solo targetea a disponibles por socket/push.
        // Disponibles + activos en paralelo (antes 2 RTT en serie).
        await Promise.all([
          profile.status === 'available'
            ? fetchAvailableOrders()
            : (setAvailableOrders([]), setNewOrderAlert(null)),
          fetchActiveOrders(),
        ]);
      } catch (error) {
        console.error('Failed to fetch driver data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDriverData();
    }
  }, [user, fetchAvailableOrders, fetchActiveOrders]);

  const toggleOnlineStatus = async () => {
    const goingOnline = !isOnline;
    // Sin KYC aprobado no hay pedidos: ni siquiera fingir "en línea".
    if (goingOnline && kycBlocked) {
      setPageError(t('wdrvauth.home.kycBlockedOnline'));
      return;
    }
    // Pausa manual: el horario no reconecta solo en los próximos 30 min.
    if (!goingOnline) manualPauseAt.current = Date.now();
    const newStatus = goingOnline ? 'available' : 'offline';
    setPageError(null);
    try {
      await api.updateDriverStatus(newStatus as any);
      socketUpdateStatus(newStatus as any);
      setIsOnline(goingOnline);
      if (goingOnline) {
        // Al volver: lista fresca para entrar en la rotación
        await fetchAvailableOrders();
      } else {
        // Al pausar: salir de la lista de inmediato
        setAvailableOrders([]);
        setNewOrderAlert(null);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      setPageError(t('wdrvauth.home.errStatus'));
    }
  };

  // Horario propuesto: al abrir la app (y cada minuto) dentro del horario,
  // conecta solo si está en pausa — salvo KYC pendiente o pausa manual
  // reciente (30 min). La desconexión la hace el servidor (cron cada 5 min).
  const checkScheduleAutoConnect = useCallback(async () => {
    if (!user || isOnlineRef.current || kycBlockedRef.current || document.hidden) return;
    if (manualPauseAt.current && Date.now() - manualPauseAt.current < 30 * 60 * 1000) return;
    let rows: any[] = [];
    try {
      const sched = await api.getDriverSchedule();
      rows = Array.isArray(sched) ? sched : [];
    } catch {
      return;
    }
    const now = new Date();
    const cr = new Date(now.getTime() - 6 * 3600 * 1000);
    const dow = cr.getUTCDay();
    const mins = cr.getUTCHours() * 60 + cr.getUTCMinutes();
    const toMin = (v: unknown) => {
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) return NaN;
      const c = new Date(d.getTime() - 6 * 3600 * 1000);
      return c.getUTCHours() * 60 + c.getUTCMinutes();
    };
    const inside = rows.some(
      (r) =>
        Number(r?.dayOfWeek) === dow &&
        r?.isAvailable !== false &&
        toMin(r?.startTime) <= mins &&
        mins < toMin(r?.endTime),
    );
    if (!inside) return;
    try {
      await api.updateDriverStatus('available' as any);
      socketUpdateStatus('available' as any);
      setIsOnline(true);
      setAutoNotice(t('wdrvauth.home.autoConnected'));
      window.setTimeout(() => setAutoNotice(null), 8000);
      await fetchAvailableOrders();
    } catch {
      // Reintenta en el próximo tick; no rompe nada.
    }
  }, [user, fetchAvailableOrders, socketUpdateStatus, t]);

  useEffect(() => {
    if (!user) return;
    void checkScheduleAutoConnect();
    const id = window.setInterval(() => void checkScheduleAutoConnect(), 60 * 1000);
    return () => window.clearInterval(id);
  }, [user, checkScheduleAutoConnect]);

  // Ping de ubicación mientras está disponible (cada 30s): alimenta el
  // targeting por proximidad — sin esto el repartidor no recibe alertas de
  // pedidos cercanos y el sistema decae a broadcast. Pausado si no está
  // online o la pestaña está oculta (ahorro de batería).
  useEffect(() => {
    if (!user || !isOnline) return;
    let cancelled = false;

    const ping = () => {
      if (cancelled || document.hidden) return;
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          api
            .updateDriverLocation(pos.coords.latitude, pos.coords.longitude)
            .catch(() => undefined); // best-effort: targeting, no tracking
          // En vivo por socket a cada activo (el tracking del cliente lo
          // recibe al instante en vez de esperar el polling REST).
          try {
            const ids = activeOrdersRef.current.slice(0, 5).map((o) => o.id);
            for (const id of ids) {
              emitDriverLocation?.(pos.coords.latitude, pos.coords.longitude, id);
            }
          } catch {
            // sin socket: el polling REST igual lo levanta
          }
        },
        () => undefined, // sin permiso/GPS: decae a broadcast, no spamea
        { enableHighAccuracy: false, maximumAge: 30_000, timeout: 10_000 },
      );
    };

    ping();
    const t = setInterval(ping, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user, isOnline]);

  // Anti doble-tap: el state llega tarde al segundo tap; el ref no.
  // (El backend igual es idempotente para el mismo driver.)
  const acceptingRef = useRef<string | null>(null);
  const handleAcceptOrder = async (orderId: string) => {
    if (!orderId) {
      setPageError(t('wdrvauth.home.errIncomplete'));
      return;
    }
    if (activeOrders.length >= 10) {
      const msg = t('wdrvauth.home.errMaxOrders');
      setPageError(msg);
      addNotification({
        type: 'order_status',
        title: t('wdrvauth.home.acceptFailTitle'),
        body: msg,
      });
      return;
    }
    if (acceptingRef.current === orderId) return;
    acceptingRef.current = orderId;
    setAcceptingOrder(orderId);
    setPageError(null);
    try {
      const accepted: any = await api.acceptOrder(orderId);
      events.drivers.acceptedOrder(orderId);
      // Remove from available orders
      setAvailableOrders((prev) => prev.filter((o) => o.id !== orderId));
      // Add to active orders
      const order = availableOrders.find((o) => o.id === orderId);
      if (order) {
        setActiveOrders((prev) => [{ ...order, status: 'assigned' }, ...prev]);
      } else if (accepted?.id) {
        // Venía de popup viejo: igual sumarlo para que no parezca perdido
        setActiveOrders((prev) =>
          prev.some((o) => o.id === accepted.id)
            ? prev
            : [{ ...accepted, status: 'assigned' }, ...prev],
        );
      }
      setNewOrderAlert(null);
      // Refresh data
      await fetchActiveOrders();
    } catch (error: any) {
      console.error('Failed to accept order:', error);
      // Mostrar el mensaje REAL del servidor (programado, ya asignado,
      // cancelado, etc.) en vez del genérico "otro repartidor".
      const msg = error?.message || t('wdrvauth.home.errAcceptFallback');
      setPageError(msg);
      // Refrescar: si ya es tuyo (doble tap), aparece en Activos;
      // si ya no existe, sale de Disponibles.
      await fetchActiveOrders();
      await fetchAvailableOrders();
      // El banner queda arriba (fuera de vista): toast para que sí se vea
      addNotification({
        type: 'order_status',
        title: t('wdrvauth.home.acceptFailTitle'),
        body: msg,
      });
    } finally {
      acceptingRef.current = null;
      setAcceptingOrder(null);
    }
  };

  const handleRejectOrder = (orderId: string) => {
    setAvailableOrders((prev) => prev.filter((o) => o.id !== orderId));
    setNewOrderAlert(null);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      assigned: t('wdrvauth.home.statusAssigned'),
      pending_acceptance: t('wdrvauth.home.statusPending'),
      in_transit_to_pickup: t('wdrvauth.home.statusToPickup'),
      picked_up: t('wdrvauth.home.statusPicked'),
      in_transit_to_delivery: t('wdrvauth.home.statusDelivering'),
      delivered: t('wdrvauth.home.statusDelivered'),
    };
    return labels[status] || status;
  };

  const getNextStatus = (currentStatus: string) => {
    const flow: Record<string, string> = {
      assigned: 'in_transit_to_pickup',
      in_transit_to_pickup: 'picked_up',
      picked_up: 'in_transit_to_delivery',
      in_transit_to_delivery: 'delivered',
    };
    return flow[currentStatus];
  };

  if (authLoading || loading) {
    // Invitados: landing público de lanzamiento (no spinner eterno: sin
    // sesión nunca se apaga `loading` porque no hay datos que traer).
    if (!authLoading && !user) return <DriverLanding />;
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <KiwiLoader size={56} />
      </div>
    );
  }

  const filteredOrders = availableOrders.filter((order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'freight') return (order as any).kind === 'freight';
    if (activeTab === 'trip') return order.orderType === 'scheduled';
    // Delivery: comida inmediata
    return (order as any).kind !== 'freight' && order.orderType !== 'scheduled';
  });

  const driverLevel = (user?.driverProfile as any)?.level as string | undefined;
  const levelLabel: Record<string, string> = {
    bronce: t('wdrvauth.home.lvlBronce'),
    plata: t('wdrvauth.home.lvlPlata'),
    oro: t('wdrvauth.home.lvlOro'),
    diamante: t('wdrvauth.home.lvlDiamante'),
    vip: t('wdrvauth.home.lvlVip'),
  };

  return (
    <main className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <motion.header
        className="pt-safe sticky top-0 z-50 glass-strong"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <motion.div
              className="flex min-w-0 flex-1 items-center gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <KiwiLogo size={30} />
              <h1 className="truncate text-base min-[400px]:text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                {t('wdrvauth.home.brand')}
              </h1>
              <VehicleBadge
                type={(user?.driverProfile?.vehicleType as any) || 'motorcycle'}
                size="sm"
                hideLabelOnMobile
              />
            </motion.div>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex items-center gap-1">
                <motion.div
                  className={`h-2 w-2 rounded-full ${isConnected ? 'bg-kiwi-400' : 'bg-red-400'}`}
                  animate={isOnline && isConnected ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <ThemeToggle />
              <LanguageSwitcherCompact hideLabelOnMobile />
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kiwi-gradient text-sm font-semibold text-white ring-2 ring-white dark:ring-surface-800 shadow-sm overflow-hidden">
                {isHttpUrl((user as any)?.driverProfile?.photoUrl) ? (
                  // NOTE: <img> intencional — foto dinámica de Cloudinary.
                  <img
                    src={(user as any).driverProfile.photoUrl}
                    alt={t('wdrvauth.home.photoAlt')}
                    className="h-8 w-8 object-cover"
                  />
                ) : isEmojiImage((user as any)?.driverProfile?.photoUrl) ? (
                  <span className="text-lg leading-none">
                    {(user as any).driverProfile.photoUrl}
                  </span>
                ) : (
                  user?.driverProfile?.fullName?.charAt(0) || 'D'
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 pt-6 pb-28">
        {pageError && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {pageError}
            {pushDetail && (
              <details className="mt-2 text-xs">
                <summary className="font-semibold">{t('wdrvauth.home.diag')}</summary>
                <pre className="mt-1 whitespace-pre-wrap break-all">{pushDetail}</pre>
              </details>
            )}
          </div>
        )}
        {autoNotice && (
          <div className="mb-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800 px-4 py-3 text-sm text-kiwi-700 dark:text-kiwi-300">
            {autoNotice}
          </div>
        )}
        {/* iPhone sin instalar: el push es imposible en Safari → guía */}
        {pushNeedsInstall && (
          <div className="mb-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
              {t('wdrvauth.home.pushTitle')}
            </p>
            <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
              {t('wdrvauth.home.pushIosLead')}{' '}
              <span className="font-semibold">{t('wdrvauth.home.pushIosBold')}</span>
              {t('wdrvauth.home.pushIosTail')}
            </p>
            {pushDebug && !pushDebug.hasNotification && !pushDebug.hasServiceWorker && (
              <p className="mt-2 font-semibold">{t('wdrvauth.home.pushHermetic')}</p>
            )}
            {pushDebug && (
              <details className="mt-2 text-xs text-surface-500 dark:text-surface-400">
                <summary className="font-semibold">{t('wdrvauth.home.diag')}</summary>
                <pre className="mt-1 whitespace-pre-wrap break-all">
                  {JSON.stringify(pushDebug, null, 1)}
                </pre>
              </details>
            )}
          </div>
        )}
        {/* iPhone instalado pero viejo de verdad: push requiere iOS 16.4+ */}
        {!pushNeedsInstall && pushUnsupported === 'ios-old' && (
          <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            {t('wdrvauth.home.pushOldIos')}
          </div>
        )}
        {/* iPhone nuevo pero sin APIs de push en el celu: típico Modo hermético (reinstalar no ayuda) */}
        {!pushNeedsInstall && pushUnsupported === 'ios-push-unavailable' && (
          <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            {t('wdrvauth.home.pushBlocked', { version: pushDebug?.iosVersion ?? '…' })}
            {pushDebug && (
              <details className="mt-2">
                <summary className="font-semibold">{t('wdrvauth.home.diag')}</summary>
                <pre className="mt-1 whitespace-pre-wrap break-all">
                  {JSON.stringify(pushDebug, null, 1)}
                </pre>
              </details>
            )}
          </div>
        )}
        {/* Alertas push: solo si el navegador las soporta y aún no se decidió */}
        {!pushNeedsInstall && !pushUnsupported && pushSupported && pushPermission === 'default' && (
          <div className="mb-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
              {t('wdrvauth.home.pushTitle')}
            </p>
            <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
              {t('wdrvauth.home.pushDefaultDesc')}
            </p>
            <TapButton
              variant="gradient"
              haptic
              className="mt-3 h-11 w-full rounded-xl text-sm"
              disabled={pushBusy}
              onClick={async () => {
                setPushBusy(true);
                setPushDetail(null);
                try {
                  const res = await requestPushPermission();
                  if (!res.ok) {
                    setPageError(pushErrorMessage(t, res.reason));
                    setPushDetail(res.detail ?? null);
                  }
                } finally {
                  setPushBusy(false);
                }
              }}
            >
              {pushBusy ? t('wdrvauth.home.pushBusy') : t('wdrvauth.home.pushCta')}
            </TapButton>
          </div>
        )}
        {!pushNeedsInstall && pushSupported && pushPermission === 'denied' && isOnline && (
          <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            {t('wdrvauth.home.pushDenied')}
          </div>
        )}
        {/* KYC: sin verificación aprobada no hay pedidos en el sistema */}
        {kycBlocked && (
          <div className="mb-4 rounded-2xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-4">
            <p className="font-semibold text-sm text-red-700 dark:text-red-300">
              🪪 {t('wdrvauth.home.kycBlockedTitle')}
            </p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {kycStatus === 'rejected'
                ? t('wdrvauth.home.kycBlockedRejected', {
                    reason: kycRejection
                      ? t('wdrvauth.home.kycBlockedReason', { reason: kycRejection })
                      : '',
                  })
                : ['under_review', 'submitted'].includes(kycStatus ?? '')
                  ? t('wdrvauth.home.kycBlockedReview')
                  : t('wdrvauth.home.kycBlockedPending')}
            </p>
            {!['under_review', 'submitted'].includes(kycStatus ?? '') && (
              <Link
                href="/kyc"
                className="mt-3 inline-block rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
              >
                {t('wdrvauth.home.kycBlockedCta')}
              </Link>
            )}
          </div>
        )}
        {/* Status Toggle */}
        <motion.div
          className={`mb-6 rounded-3xl p-6 text-white overflow-hidden relative transition-colors ${
            isOnline ? 'bg-kiwi-gradient shadow-card' : 'bg-surface-800 dark:bg-surface-800'
          }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute -left-5 -bottom-5 h-20 w-20 rounded-full bg-white/10"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          />

          <div className="relative flex items-center justify-between">
            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={isOnline ? 'on' : 'off'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <h2 className="text-xl font-display font-bold">
                    {isOnline ? t('wdrvauth.home.online') : t('wdrvauth.home.paused')}
                  </h2>
                  <p className="text-white/80 text-sm">
                    {isOnline ? t('wdrvauth.home.onlineHint') : t('wdrvauth.home.offlineHint')}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <motion.button
              className={`relative h-14 w-24 rounded-full p-1 transition-colors disabled:opacity-50 ${
                isOnline ? 'bg-white' : 'bg-white/20'
              }`}
              onClick={toggleOnlineStatus}
              disabled={kycBlocked && !isOnline}
              whileTap={{ scale: 0.95 }}
              aria-label={isOnline ? t('wdrvauth.home.pauseAria') : t('wdrvauth.home.resumeAria')}
            >
              <motion.div
                className={`flex h-12 w-12 items-center justify-center rounded-full shadow-md ${
                  isOnline ? 'bg-kiwi-700 text-white' : 'bg-surface-300 text-surface-500'
                }`}
                animate={{ x: isOnline ? 40 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                {isOnline ? <Bike className="h-6 w-6" /> : <CircleOff className="h-6 w-6" />}
              </motion.div>
            </motion.button>
          </div>

          <AnimatePresence>
            {isOnline ? (
              <motion.div
                key="online"
                className="relative mt-4 space-y-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ●
                  </motion.span>
                  <span>
                    {t('wdrvauth.home.receiving')}
                    {isConnected ? '' : t('wdrvauth.home.reconnecting')}
                  </span>
                </div>

                <div className="flex gap-2">
                  {tabs.map((tab) => (
                    <motion.button
                      key={tab.id}
                      aria-pressed={activeTab === tab.id}
                      className={`flex-1 rounded-xl py-2 px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                        activeTab === tab.id
                          ? 'bg-white text-kiwi-800'
                          : 'bg-white/20 text-white/85 [@media(hover:hover)]:hover:bg-white/30 [@media(hover:hover)]:hover:text-white'
                      }`}
                      onClick={() =>
                        tab.id === 'trip' ? router.push('/scheduled') : setActiveTab(tab.id)
                      }
                      whileTap={{ scale: 0.95 }}
                    >
                      <tab.icon className="h-4 w-4" /> {tab.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="offline"
                className="relative mt-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <TapButton
                  variant="secondary"
                  haptic
                  className="w-full rounded-xl h-12 text-sm font-bold"
                  onClick={() => (kycBlocked ? router.push('/kyc') : void toggleOnlineStatus())}
                >
                  {kycBlocked ? t('wdrvauth.home.kycBlockedCta') : t('wdrvauth.home.goOnlineCta')}
                </TapButton>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Today's Stats */}
        <StaggerContainer className="mb-6 grid grid-cols-2 gap-3">
          <StaggerItem>
            <motion.div className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-card dark:shadow-dark p-4 text-center">
              <AnimatedCounter value={stats.trips} className="text-2xl font-bold text-kiwi-700" />
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {t('wdrvauth.home.statTrips')}
              </p>
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-card dark:shadow-dark p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="h-5 w-5 fill-gold-400 text-gold-400" />
                <AnimatedCounter
                  value={stats.rating}
                  decimals={1}
                  className="text-2xl font-bold text-gold-600"
                />
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {t('wdrvauth.home.statRating')}
              </p>
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-card dark:shadow-dark p-4 text-center">
              <span className="text-2xl font-bold text-kiwi-700">
                ₡{Math.round(stats.earnings).toLocaleString()}
              </span>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {t('wdrvauth.home.statEarnings')}
              </p>
              {sinceCut != null && (
                <p className="mt-1 text-xs font-semibold text-kiwi-700 dark:text-kiwi-400">
                  {t('wdrvauth.home.statSinceCut', {
                    amount: Math.round(sinceCut).toLocaleString(),
                  })}
                </p>
              )}
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-card dark:shadow-dark p-4 text-center">
              <span className="text-2xl font-bold text-gold-600">{availableOrders.length}</span>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {t('wdrvauth.home.statAvailable')}
              </p>
            </motion.div>
          </StaggerItem>
        </StaggerContainer>

        {/* Active Orders Section */}
        {activeOrders.length > 0 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-300">
                {t('wdrvauth.home.activeTitle')}
              </h3>
              <span className="text-xs text-surface-500 dark:text-surface-400">
                {t('wdrvauth.home.activeCount', { count: activeOrders.length })}
              </span>
            </div>

            <StaggerContainer className="space-y-3">
              {activeOrders.map((order) => {
                const nextStatus = getNextStatus(order.status);
                const nextStatusLabel = nextStatus ? getStatusLabel(nextStatus) : null;

                return (
                  <StaggerItem key={order.id}>
                    <motion.div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-card dark:shadow-dark p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <motion.span
                            className="rounded-full bg-kiwi-700 px-3 py-1 text-xs font-medium text-white flex items-center gap-1"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Target className="h-3 w-3" /> {getStatusLabel(order.status)}
                          </motion.span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                            ₡{Number(order.driverPayout ?? order.totalAmount ?? 0).toLocaleString()}
                          </p>
                          <p className="text-[11px] text-surface-500 dark:text-surface-400">
                            {t('wdrvauth.home.yourEarning')}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-700">
                            <MapPin className="h-3 w-3" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
                              {(order as any).merchant?.businessName || order.pickupAddress}
                            </p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">
                              {(order as any).merchant?.businessName
                                ? t('wdrvauth.home.pickupDetail', { address: order.pickupAddress })
                                : t('wdrvauth.home.pickupHere')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                            <HomeIcon className="h-3 w-3" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
                              {order.deliveryAddress}
                            </p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">
                              {t('wdrvauth.home.deliverHere')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {nextStatus && (
                        <Link href="/active">
                          <TapButton
                            variant="gradient"
                            haptic
                            className="w-full rounded-xl h-11 text-sm"
                          >
                            {nextStatusLabel} →
                          </TapButton>
                        </Link>
                      )}
                    </motion.div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </motion.div>
        )}

        {/* Available Orders */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-2">
              <Package className="h-4 w-4" /> {t('wdrvauth.home.availTitle')}
            </h3>
            <span className="text-xs text-surface-500 dark:text-surface-400">
              {t('wdrvauth.home.nearbyCount', { count: filteredOrders.length })}
            </span>
          </div>

          {filteredOrders.length === 0 ? (
            <motion.div
              className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {' '}
              <motion.div
                animate={isOnline ? { y: [0, -10, 0] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isOnline ? (
                  <Package className="h-12 w-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
                ) : (
                  <CircleOff className="h-12 w-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
                )}
              </motion.div>
              <p className="text-surface-500 dark:text-surface-400">
                {isOnline ? t('wdrvauth.home.emptyOnline') : t('wdrvauth.home.emptyPaused')}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                {isOnline ? t('wdrvauth.home.emptyOnlineHint') : t('wdrvauth.home.emptyPausedHint')}
              </p>
              {!isOnline && (
                <TapButton
                  variant="gradient"
                  haptic
                  className="mt-4 rounded-xl h-11 px-6 text-sm"
                  onClick={toggleOnlineStatus}
                >
                  {t('wdrvauth.home.goOnlineShort')}
                </TapButton>
              )}
            </motion.div>
          ) : (
            <StaggerContainer className="space-y-3">
              {filteredOrders.map((order, index) => (
                <StaggerItem key={order.id}>
                  <motion.div
                    className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-card dark:shadow-dark p-4 transition-[transform,box-shadow,border-color] duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[0_10px_28px_-12px_rgba(13,51,69,0.22)] active:scale-[0.99]"
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <motion.span
                          className="rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 px-3 py-1 text-xs font-medium text-kiwi-700 dark:text-kiwi-400"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, delay: 0.5 }}
                        >
                          <Package className="h-3 w-3 inline" /> {t('wdrvauth.home.badgeDelivery')}
                        </motion.span>
                        <span className="text-xs text-surface-500 dark:text-surface-400">•</span>
                        <span className="text-xs text-surface-500 dark:text-surface-400">
                          {t('wdrvauth.home.badgeNew')}
                        </span>
                        {(() => {
                          const label = readyLabel((order as any).readyAt, t, locale);
                          return label ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 dark:bg-gold-900/50 px-3 py-1 text-xs font-semibold text-gold-700 dark:text-gold-300">
                              <Clock className="h-3 w-3" /> {label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                        ₡{Number(order.totalAmount || order.basePrice || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="mb-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-700">
                          <MapPin className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium text-surface-800 dark:text-surface-200">
                            {(order as any).merchant?.businessName || order.pickupAddress}
                          </p>
                          <p className="break-words text-xs text-surface-500 dark:text-surface-400">
                            {(order as any).merchant?.businessName
                              ? t('wdrvauth.home.originDetail', { address: order.pickupAddress })
                              : t('wdrvauth.home.originFallback')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                          <HomeIcon className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium text-surface-800 dark:text-surface-200">
                            {order.deliveryAddress}
                          </p>
                          <p className="text-xs text-surface-500 dark:text-surface-400">
                            {(order as any).deliveryZone
                              ? String((order as any).deliveryZone)
                              : order.distanceKm
                                ? t('wdrvauth.home.distKm', { dist: order.distanceKm })
                                : t('wdrvauth.home.destFallback')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <VehicleBadge
                          type={(user?.driverProfile?.vehicleType as any) || 'motorcycle'}
                          size="sm"
                        />
                        <span className="text-xs text-surface-500 dark:text-surface-400">•</span>
                        <span className="text-xs text-surface-500 dark:text-surface-400">
                          {t('wdrvauth.home.earningLabel')}{' '}
                          <span className="font-mono">
                            {order.driverPayout != null
                              ? `₡${Number(order.driverPayout).toLocaleString()}`
                              : '—'}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <AnimatedButton
                        variant="secondary"
                        className="flex-1"
                        onClick={() => handleRejectOrder(order.id)}
                        disabled={acceptingOrder === order.id}
                      >
                        {t('wdrvauth.home.reject')}
                      </AnimatedButton>
                      <TapButton
                        variant="gradient"
                        haptic
                        className="flex-1 rounded-xl h-11 text-sm"
                        onClick={() => handleAcceptOrder(order.id)}
                        disabled={acceptingOrder === order.id}
                      >
                        {acceptingOrder === order.id
                          ? t('wdrvauth.home.accepting')
                          : t('wdrvauth.home.accept')}
                      </TapButton>
                    </div>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </motion.div>

        {/* Progress Card */}
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-card dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="mb-3 text-sm font-semibold text-surface-600 dark:text-surface-300">
            {t('wdrvauth.home.levelTitle')}
          </h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-surface-600 dark:text-surface-400">
                  {t('wdrvauth.home.levelName', {
                    level: driverLevel
                      ? (levelLabel[driverLevel] ?? driverLevel)
                      : t('wdrvauth.home.lvlBronce'),
                  })}
                </span>
                <span className="text-kiwi-700 font-medium">
                  {t('wdrvauth.home.tripsTotal', { count: stats.trips })}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-500 dark:text-surface-400">
                {t('wdrvauth.home.stateLabel')}
              </span>
              <motion.span
                className="font-medium text-surface-700 dark:text-surface-300"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isOnline ? t('wdrvauth.home.receiving') : t('wdrvauth.home.paused')}
              </motion.span>
            </div>
            <Link
              href="/ranking"
              className="flex items-center justify-between rounded-xl bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 px-3 py-2.5 text-sm font-semibold text-gold-700 dark:text-gold-300"
            >
              <span>🏆 {t('wdrvwork.active.rankTitle')}</span>
              <span className="text-xs">→</span>
            </Link>
          </div>
        </motion.div>
      </main>

      {/* New Order Alert Popup */}
      <AnimatePresence>
        {newOrderAlert &&
          (() => {
            // ID normalizado UNA vez: el socket manda orderId o id según el
            // evento; si onClick y disabled usan campos distintos, el guard
            // anti doble-tap nunca se activa.
            const alertId = newOrderAlert.orderId || newOrderAlert.id;
            const hasPayout = newOrderAlert.driverPayout != null;
            const busy = acceptingOrder === alertId;
            return (
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="mx-4 w-full max-w-md rounded-3xl glass-elevated p-6"
                  initial={{ scale: 0.8, y: 50 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.8, y: 50 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <div className="text-center mb-4">
                    <motion.div
                      className="text-6xl mb-2"
                      animate={{ rotate: [0, -10, 10, 0] }}
                      transition={{ duration: 0.5 }}
                    >
                      <Package className="h-12 w-12 text-kiwi-500" />
                    </motion.div>
                    <h3 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                      {t('wdrvauth.home.alertTitle')}
                    </h3>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-surface-500 dark:text-surface-400">
                        {t('wdrvauth.home.from')}
                      </span>
                      <span className="font-medium text-surface-800 dark:text-surface-200">
                        {newOrderAlert.pickupAddress}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-surface-500 dark:text-surface-400">
                        {t('wdrvauth.home.to')}
                      </span>
                      <span className="font-medium text-surface-800 dark:text-surface-200">
                        {newOrderAlert.deliveryAddress}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-surface-500 dark:text-surface-400">
                        {t('wdrvauth.home.distance')}
                      </span>
                      <span className="font-medium text-surface-800 dark:text-surface-200">
                        {t('wdrvauth.home.distKm', { dist: newOrderAlert.distanceKm || '?' })}
                      </span>
                    </div>
                    <div className="border-t border-surface-200 dark:border-surface-700 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-surface-500 dark:text-surface-400">
                          {hasPayout
                            ? t('wdrvauth.home.payoutLabel')
                            : t('wdrvauth.home.orderTotalLabel')}
                        </span>
                        <span className="text-2xl font-bold text-kiwi-700 dark:text-kiwi-400 font-mono">
                          {hasPayout
                            ? `₡${Number(newOrderAlert.driverPayout).toLocaleString()}`
                            : `₡${Number(newOrderAlert.totalAmount || 0).toLocaleString()}`}
                        </span>
                      </div>
                      {!hasPayout && (
                        <p className="mt-1 text-right text-[11px] text-surface-500 dark:text-surface-400">
                          {t('wdrvauth.home.payoutHint')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <AnimatedButton
                      variant="secondary"
                      className="flex-1"
                      onClick={() => handleRejectOrder(alertId)}
                      disabled={busy}
                    >
                      {t('wdrvauth.home.reject')}
                    </AnimatedButton>
                    <AnimatedButton
                      variant="gradient"
                      className="flex-1"
                      onClick={() => handleAcceptOrder(alertId)}
                      disabled={busy}
                    >
                      {busy ? t('wdrvauth.home.accepting') : t('wdrvauth.home.accept')}
                    </AnimatedButton>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <BottomNav />
    </main>
  );
}
