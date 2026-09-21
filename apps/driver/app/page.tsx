'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BottomNav } from './components/BottomNav';
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
  useAuth,
  useSocket,
  useNotifications,
  usePushNotifications,
  playNotificationSound,
  api,
  Order,
  staggerContainer,
  KiwiLoader,
  KiwiLogo,
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
} from 'lucide-react';

/** Mensaje exacto según el paso que falló (permiso vs token vs servidor). */
function pushErrorMessage(reason?: string): string {
  switch (reason) {
    case 'denied':
      return 'No se pudieron activar las alertas. Revisá el permiso en tu navegador.';
    case 'no-push-manager':
    case 'unsupported':
      return 'Este navegador no soporta alertas. Probá con Chrome o instalando la app.';
    case 'missing-vapid':
    case 'missing-config':
      return 'Falta configuración del servidor para alertas. Avisanos por WhatsApp.';
    case 'sync-failed':
      return 'Se activó en el celu pero no llegó al servidor. Revisá tu conexión y reintentá.';
    default:
      return 'No se pudo completar la activación. Reintentá con buena conexión.';
  }
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ trips: 0, earnings: 0, rating: 5.0 });
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
  } = usePushNotifications({ enabled: false });
  const [pushBusy, setPushBusy] = useState(false);

  const tabs = [
    { id: 'all' as const, label: 'Todos', icon: ClipboardList },
    { id: 'delivery' as const, label: 'Delivery', icon: Package },
    { id: 'trip' as const, label: 'Viajes', icon: Bike },
    { id: 'freight' as const, label: 'Fletes', icon: Truck },
  ];

  // El socket no sabe si estás offline: el backend solo targetea a
  // disponibles, pero este guard evita que un evento viejo te pinte
  // pedidos cuando pausaste.
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  // Saca un pedido de Disponibles + popup cuando deja de estar vigente.
  const removeFromAvailable = useCallback((data: any) => {
    const goneId = data?.id ?? data?.orderId;
    const st = data?.status;
    if (!goneId) return;
    // Sin estado o con estado no-pending: ya no se puede aceptar.
    if (st !== undefined && (st === 'pending' || st === 'driver_proposals')) return;
    setAvailableOrders((prev) => prev.filter((o) => o.id !== goneId));
    setNewOrderAlert((prev) => {
      const prevId = prev?.id ?? prev?.orderId;
      return prevId === goneId ? null : prev;
    });
  }, []);

  // Real-time socket connection
  const {
    isConnected,
    onNewOrder,
    onOrderStatusChanged,
    updateDriverStatus: socketUpdateStatus,
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

  const fetchActiveOrders = useCallback(async () => {
    try {
      const data = await api.getMyOrders('assigned');
      setActiveOrders(data);
    } catch (error) {
      console.error('Failed to fetch active orders:', error);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    // App del repartidor: otras cuentas (comercio/admin) no entran.
    if ((user as any).role && (user as any).role !== 'driver') {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchDriverData = async () => {
      try {
        const profile = await api.getDriverProfile();
        let earnings = 0;
        try {
          const e = await api.getDriverEarnings('all');
          earnings = Number(e?.totalEarnings || 0);
        } catch {
          // Ganancias opcionales: el resto del dashboard igual carga
        }
        setStats({
          trips: profile.totalTrips || 0,
          earnings,
          rating: Number(profile.rating) || 5.0,
        });
        setIsOnline(profile.status === 'available');
        // Offline = fuera de la lista: no se piden ni se muestran disponibles.
        // El backend además solo targetea a disponibles por socket/push.
        if (profile.status === 'available') {
          await fetchAvailableOrders();
        } else {
          setAvailableOrders([]);
          setNewOrderAlert(null);
        }
        await fetchActiveOrders();
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
      setPageError('No se pudo cambiar tu estado. Revisa tu conexión.');
    }
  };

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

  const handleAcceptOrder = async (orderId: string) => {
    if (!orderId) {
      setPageError('Ese pedido llegó incompleto. Cerrá y volvé a abrir la app.');
      return;
    }
    setAcceptingOrder(orderId);
    setPageError(null);
    try {
      const accepted: any = await api.acceptOrder(orderId);
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
      const msg =
        error?.message || 'No se pudo aceptar el pedido. Quizás otro repartidor lo tomó primero.';
      setPageError(msg);
      // Refrescar: si ya es tuyo (doble tap), aparece en Activos;
      // si ya no existe, sale de Disponibles.
      await fetchActiveOrders();
      await fetchAvailableOrders();
      // El banner queda arriba (fuera de vista): toast para que sí se vea
      addNotification({ type: 'order_status', title: 'No se pudo aceptar', body: msg });
    } finally {
      setAcceptingOrder(null);
    }
  };

  const handleRejectOrder = (orderId: string) => {
    setAvailableOrders((prev) => prev.filter((o) => o.id !== orderId));
    setNewOrderAlert(null);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      assigned: 'Asignado',
      in_transit_to_pickup: 'En camino a recoger',
      picked_up: 'Recogido',
      in_transit_to_delivery: 'Entregando',
      delivered: 'Entregado',
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
    bronce: 'Bronce',
    plata: 'Plata',
    oro: 'Oro',
    diamante: 'Diamante',
    vip: 'VIP',
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
          <div className="flex items-center justify-between">
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <KiwiLogo size={30} />
              <h1 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                Driver
              </h1>
              <VehicleBadge
                type={(user?.driverProfile?.vehicleType as any) || 'motorcycle'}
                size="sm"
              />
            </motion.div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <motion.div
                  className={`h-2 w-2 rounded-full ${isConnected ? 'bg-kiwi-400' : 'bg-red-400'}`}
                  animate={isOnline && isConnected ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <ThemeToggle />
              <motion.div
                className="h-8 w-8 rounded-full bg-kiwi-gradient text-white flex items-center justify-center text-sm font-semibold shadow-kiwi"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {user?.driverProfile?.fullName?.charAt(0) || 'D'}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        {pageError && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {pageError}
          </div>
        )}
        {/* iPhone sin instalar: el push es imposible en Safari → guía */}
        {pushNeedsInstall && (
          <div className="mb-4 rounded-2xl glass p-4">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
              Recibí pedidos con el celu bloqueado
            </p>
            <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
              En iPhone las alertas solo funcionan con la app instalada: en Safari tocá{' '}
              <span className="font-semibold">Compartir → Agregar a inicio</span>, abrí Kiwi desde
              el ícono nuevo y activá las alertas ahí.
            </p>
          </div>
        )}
        {/* iPhone instalado pero viejo: push requiere iOS 16.4+ */}
        {!pushNeedsInstall && pushUnsupported === 'ios-old' && (
          <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            Tu iPhone necesita iOS 16.4 o más nuevo para las alertas. Actualizalo en Ajustes →
            General → Actualización.
          </div>
        )}
        {/* Alertas push: solo si el navegador las soporta y aún no se decidió */}
        {!pushNeedsInstall && !pushUnsupported && pushSupported && pushPermission === 'default' && (
          <div className="mb-4 rounded-2xl glass p-4">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
              Recibí pedidos con el celu bloqueado
            </p>
            <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
              Activá las alertas para que te avisemos aunque la app esté cerrada.
            </p>
            <TapButton
              variant="gradient"
              haptic
              className="mt-3 h-11 w-full rounded-xl text-sm"
              disabled={pushBusy}
              onClick={async () => {
                setPushBusy(true);
                try {
                  const res = await requestPushPermission();
                  if (!res.ok) {
                    setPageError(pushErrorMessage(res.reason));
                  }
                } finally {
                  setPushBusy(false);
                }
              }}
            >
              {pushBusy ? 'Activando…' : 'Activar alertas'}
            </TapButton>
          </div>
        )}
        {!pushNeedsInstall && pushSupported && pushPermission === 'denied' && isOnline && (
          <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            Las alertas están bloqueadas en tu navegador: activalas en los ajustes del sitio para
            recibir pedidos con la app cerrada.
          </div>
        )}
        {/* Status Toggle */}
        <motion.div
          className={`mb-6 rounded-3xl p-6 text-white overflow-hidden relative transition-colors ${
            isOnline ? 'bg-kiwi-gradient glow-kiwi-lg' : 'bg-surface-800 dark:bg-surface-800'
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
                    {isOnline ? 'En línea' : 'En pausa'}
                  </h2>
                  <p className="text-white/80 text-sm">
                    {isOnline
                      ? 'Estás en la lista · te llegan pedidos'
                      : 'Fuera de la lista · no te llegan pedidos'}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <motion.button
              className={`relative h-14 w-24 rounded-full p-1 transition-colors ${
                isOnline ? 'bg-white' : 'bg-white/20'
              }`}
              onClick={toggleOnlineStatus}
              whileTap={{ scale: 0.95 }}
              aria-label={isOnline ? 'Ponerme en pausa' : 'Ponerme en línea'}
            >
              <motion.div
                className={`flex h-12 w-12 items-center justify-center rounded-full shadow-md ${
                  isOnline ? 'bg-kiwi-500 text-white' : 'bg-surface-300 text-surface-500'
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
                    Recibiendo pedidos
                    {isConnected ? '' : ' (reconectando…)'}
                  </span>
                </div>

                <div className="flex gap-2">
                  {tabs.map((tab) => (
                    <motion.button
                      key={tab.id}
                      className={`flex-1 rounded-xl py-2 px-3 text-xs font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-white text-kiwi-600'
                          : 'bg-white/20 text-white/80 hover:bg-white/30'
                      }`}
                      onClick={() => setActiveTab(tab.id)}
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
                  onClick={toggleOnlineStatus}
                >
                  Ponerme en línea y recibir pedidos
                </TapButton>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Today's Stats */}
        <StaggerContainer className="mb-6 grid grid-cols-2 gap-3">
          <StaggerItem>
            <motion.div className="rounded-xl glass p-4 text-center tactile" whileHover={{ y: -2 }}>
              <AnimatedCounter value={stats.trips} className="text-2xl font-bold text-kiwi-600" />
              <p className="text-xs text-surface-500 dark:text-surface-400">Viajes</p>
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div className="rounded-xl glass p-4 text-center tactile" whileHover={{ y: -2 }}>
              <div className="flex items-center justify-center gap-1">
                <Star className="h-5 w-5 fill-gold-400 text-gold-400" />
                <AnimatedCounter
                  value={stats.rating}
                  decimals={1}
                  className="text-2xl font-bold text-gold-600"
                />
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400">Rating</p>
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div className="rounded-xl glass p-4 text-center tactile" whileHover={{ y: -2 }}>
              <span className="text-2xl font-bold text-kiwi-600">
                ₡{Math.round(stats.earnings).toLocaleString()}
              </span>
              <p className="text-xs text-surface-500 dark:text-surface-400">Ganado</p>
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div className="rounded-xl glass p-4 text-center tactile" whileHover={{ y: -2 }}>
              <span className="text-2xl font-bold text-gold-600">{availableOrders.length}</span>
              <p className="text-xs text-surface-500 dark:text-surface-400">Disponibles</p>
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
                Mis Pedidos Activos
              </h3>
              <span className="text-xs text-surface-400">{activeOrders.length} en curso</span>
            </div>

            <StaggerContainer className="space-y-3">
              {activeOrders.map((order) => {
                const nextStatus = getNextStatus(order.status);
                const nextStatusLabel = nextStatus ? getStatusLabel(nextStatus) : null;

                return (
                  <StaggerItem key={order.id}>
                    <motion.div className="rounded-2xl glass p-4 glow-kiwi" whileHover={{ y: -2 }}>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <motion.span
                            className="rounded-full bg-kiwi-500 px-3 py-1 text-xs font-medium text-white flex items-center gap-1"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Target className="h-3 w-3" /> {getStatusLabel(order.status)}
                          </motion.span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-surface-700">
                            ₡{Number(order.driverPayout ?? order.totalAmount ?? 0).toLocaleString()}
                          </p>
                          <p className="text-[11px] text-surface-400">tu ganancia</p>
                        </div>
                      </div>

                      <div className="mb-4 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-600">
                            <MapPin className="h-3 w-3" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-surface-800">
                              {order.pickupAddress}
                            </p>
                            <p className="text-xs text-surface-400">Recoger aquí</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                            <HomeIcon className="h-3 w-3" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-surface-800">
                              {order.deliveryAddress}
                            </p>
                            <p className="text-xs text-surface-400">Entregar aquí</p>
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
              <Package className="h-4 w-4" /> Pedidos Disponibles
            </h3>
            <span className="text-xs text-surface-400">{filteredOrders.length} cerca de ti</span>
          </div>

          {filteredOrders.length === 0 ? (
            <motion.div
              className="rounded-2xl glass p-8 text-center"
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
                {isOnline ? 'No hay pedidos disponibles ahora' : 'Estás en pausa'}
              </p>
              <p className="text-xs text-surface-400 mt-1">
                {isOnline
                  ? 'Cuando haya pedidos, aparecerán aquí'
                  : 'Ponte en línea para entrar en la lista y recibir pedidos'}
              </p>
              {!isOnline && (
                <TapButton
                  variant="gradient"
                  haptic
                  className="mt-4 rounded-xl h-11 px-6 text-sm"
                  onClick={toggleOnlineStatus}
                >
                  Ponerme en línea
                </TapButton>
              )}
            </motion.div>
          ) : (
            <StaggerContainer className="space-y-3">
              {filteredOrders.map((order, index) => (
                <StaggerItem key={order.id}>
                  <motion.div
                    className="rounded-2xl glass p-4 tactile"
                    whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(34, 197, 94, 0.25)' }}
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
                          <Package className="h-3 w-3 inline" /> Delivery
                        </motion.span>
                        <span className="text-xs text-surface-400">•</span>
                        <span className="text-xs text-surface-400">Nuevo</span>
                      </div>
                      <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                        ₡{Number(order.totalAmount || order.basePrice || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="mb-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-600">
                          <MapPin className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                            {order.pickupAddress}
                          </p>
                          <p className="text-xs text-surface-400">Origen</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                          <HomeIcon className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                            {order.deliveryAddress}
                          </p>
                          <p className="text-xs text-surface-400">
                            {(order as any).deliveryZone
                              ? String((order as any).deliveryZone)
                              : order.distanceKm
                                ? `${order.distanceKm} km`
                                : 'Destino'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <VehicleBadge
                          type={(user?.driverProfile?.vehicleType as any) || 'motorcycle'}
                          size="sm"
                        />
                        <span className="text-xs text-surface-400">•</span>
                        <span className="text-xs text-surface-400">
                          Ganancia:{' '}
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
                        Rechazar
                      </AnimatedButton>
                      <TapButton
                        variant="gradient"
                        haptic
                        className="flex-1 rounded-xl h-11 text-sm"
                        onClick={() => handleAcceptOrder(order.id)}
                        disabled={acceptingOrder === order.id}
                      >
                        {acceptingOrder === order.id ? 'Aceptando...' : 'Aceptar'}
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
          className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ y: -2 }}
        >
          <h3 className="mb-3 text-sm font-semibold text-surface-600 dark:text-surface-300">
            Tu Nivel
          </h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-surface-600 dark:text-surface-400">
                  Nivel {driverLevel ? (levelLabel[driverLevel] ?? driverLevel) : 'Bronce'}
                </span>
                <span className="text-kiwi-600 font-medium">{stats.trips} viajes en total</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-500 dark:text-surface-400">Estado</span>
              <motion.span
                className="font-medium text-surface-700 dark:text-surface-300"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isOnline ? 'Recibiendo pedidos' : 'En pausa'}
              </motion.span>
            </div>
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
                      Nuevo Pedido
                    </h3>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-surface-500 dark:text-surface-400">Desde</span>
                      <span className="font-medium text-surface-800 dark:text-surface-200">
                        {newOrderAlert.pickupAddress}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-surface-500 dark:text-surface-400">Hasta</span>
                      <span className="font-medium text-surface-800 dark:text-surface-200">
                        {newOrderAlert.deliveryAddress}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-surface-500 dark:text-surface-400">Distancia</span>
                      <span className="font-medium text-surface-800 dark:text-surface-200">
                        {newOrderAlert.distanceKm || '?'} km
                      </span>
                    </div>
                    <div className="border-t border-surface-200 dark:border-surface-700 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-surface-500 dark:text-surface-400">
                          {hasPayout ? 'Ganancia' : 'Total del pedido'}
                        </span>
                        <span className="text-2xl font-bold text-kiwi-600 dark:text-kiwi-400 font-mono">
                          {hasPayout
                            ? `₡${Number(newOrderAlert.driverPayout).toLocaleString()}`
                            : `₡${Number(newOrderAlert.totalAmount || 0).toLocaleString()}`}
                        </span>
                      </div>
                      {!hasPayout && (
                        <p className="mt-1 text-right text-[11px] text-surface-400">
                          Tu ganancia se confirma al aceptar
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
                      Rechazar
                    </AnimatedButton>
                    <AnimatedButton
                      variant="gradient"
                      className="flex-1"
                      onClick={() => handleAcceptOrder(alertId)}
                      disabled={busy}
                    >
                      {busy ? 'Aceptando...' : 'Aceptar'}
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
