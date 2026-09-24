'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '../components/BottomNav';
import { DriverMap } from '../components/DriverMap';
import {
  MapPin,
  Home,
  Store,
  Navigation,
  Phone,
  MessageCircle,
  Package,
  Loader2,
  RefreshCw,
  Weight,
  CloudOff,
  CloudUpload,
  Check,
  Timer,
  Copy,
  ChevronDown,
  PartyPopper,
  Inbox,
  AlertTriangle,
  Flag,
} from 'lucide-react';
import {
  useAuth,
  useSocket,
  api,
  Order,
  offlineCache,
  backgroundSync,
  type SyncAction,
  KiwiLoader,
  TapButton,
  AnimatedCounter,
} from '@kiwi/ui';

// Estados considerados "activos" para el repartidor
const ACTIVE_STATUSES = [
  'assigned',
  'in_transit_to_pickup',
  'picked_up',
  'in_transit_to_delivery',
] as const;

// Flujo lineal con etiquetas de acción
const FLOW_ORDER = [
  'assigned',
  'in_transit_to_pickup',
  'picked_up',
  'in_transit_to_delivery',
  'delivered',
] as const;

const STEP_META: Record<string, { label: string; hint: string }> = {
  assigned: { label: 'Aceptado', hint: 'Andá al comercio a recoger' },
  in_transit_to_pickup: { label: 'En camino', hint: 'Vas hacia el comercio' },
  picked_up: { label: 'Recogido', hint: 'Llevá el pedido al cliente' },
  in_transit_to_delivery: { label: 'Entregando', hint: 'Estás por llegar' },
  delivered: { label: 'Entregado', hint: 'Pedido completado' },
};

const NEXT_STATUS: Record<string, { next: string; label: string; final?: boolean }> = {
  assigned: { next: 'in_transit_to_pickup', label: 'Voy en camino' },
  in_transit_to_pickup: { next: 'picked_up', label: 'Recogí el pedido' },
  picked_up: { next: 'in_transit_to_delivery', label: 'Voy a entregar' },
  in_transit_to_delivery: { next: 'delivered', label: 'Entregué el pedido', final: true },
};

function openMaps(lat?: number | string | null, lng?: number | string | null, address?: string) {
  const coords =
    lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? `${lat},${lng}`
      : null;
  const dest = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || '')}`;
  window.open(dest, '_blank', 'noopener,noreferrer');
}

/** Lleva la vista al mapa dentro de la app (estilo Uber). Fallback: Maps externo. */
function scrollToMap() {
  document.getElementById('driver-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function toMapPoint(
  lat?: number | string | null,
  lng?: number | string | null,
  label?: string,
): { lat: number; lng: number; label?: string } | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || la === 0 || ln === 0) return null;
  return { lat: la, lng: ln, label };
}

/** Ganancia neta: payout del servidor; si falta, se deriva del viaje y la tasa. */
function netPayout(order: Order): number {
  const p = Number((order as any).driverPayout);
  if (Number.isFinite(p)) return p;
  const base = Number((order as any).basePrice ?? 0);
  const rate = Number((order as any).commissionRate ?? 0.15);
  if (!Number.isFinite(base) || !Number.isFinite(rate)) return 0;
  return Math.round(base * (1 - Math.min(Math.max(rate, 0), 1)));
}

/** "Cliente: Ana (8888-1234) · Sin cebolla" -> { name, phone } */
function parseCustomer(special?: string | null): { name?: string; phone?: string } {
  if (!special) return {};
  const m = special.match(/Cliente:\s*([^(·]+?)\s*\(([^)]+)\)/);
  if (m) return { name: m[1].trim(), phone: m[2].trim() };
  const phone = special.match(/(\+?\d[\d\s-]{7,}\d)/);
  return phone ? { phone: phone[1].trim() } : {};
}

function toWaLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length === 8 ? `506${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

function elapsedLabel(iso?: string | null): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  return `hace ${h} h${mins % 60 ? ` ${mins % 60} min` : ''}`;
}

// Clave de caché para render offline
const ORDERS_CACHE_KEY = 'driver_active_orders';

export default function ActiveOrders() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { on: onSocketEvent } = useSocket({});

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  // Offline: pedidos vistos desde caché, acciones esperando sync
  const [fromCache, setFromCache] = useState(false);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  // Interactividad: dirección copiada, sección abierta, confirmación de entrega
  const [copied, setCopied] = useState<'pickup' | 'delivery' | null>(null);
  const [showItems, setShowItems] = useState(true);
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [rejectArmed, setRejectArmed] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [celebration, setCelebration] = useState<{ payout: number } | null>(null);
  // Reloj vivo para "hace X min"
  const [, setTick] = useState(0);
  // orderId -> estado al que se quiere avanzar mientras está encolado
  const [queuedTransitions, setQueuedTransitions] = useState<Record<string, string>>({});
  const queuedTransitionsRef = useRef(queuedTransitions);
  useEffect(() => {
    queuedTransitionsRef.current = queuedTransitions;
  }, [queuedTransitions]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchActiveOrders = useCallback(async () => {
    try {
      setError(null);
      const all = await api.getMyOrders();
      const list: Order[] = Array.isArray(all) ? all : [];
      const active = list.filter((o) => (ACTIVE_STATUSES as readonly string[]).includes(o.status));
      setOrders(active);
      setFromCache(false);
      setSelectedId((prev) =>
        prev && active.some((o) => o.id === prev) ? prev : (active[0]?.id ?? null),
      );
      // Caché para próximo arranque sin conexión
      offlineCache
        .set(ORDERS_CACHE_KEY, active, 'orders')
        .catch((e) => console.error('Failed to cache active orders:', e));
    } catch (err) {
      console.error('Failed to fetch active orders:', err);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos activos');
      // Fallback offline: sirve la última lista activa conocida
      try {
        const cached = await offlineCache.get<Order[]>(ORDERS_CACHE_KEY);
        if (cached && cached.length > 0) {
          setOrders(cached);
          setFromCache(true);
          setSelectedId((prev) =>
            prev && cached.some((o) => o.id === prev) ? prev : (cached[0]?.id ?? null),
          );
        }
      } catch (cacheErr) {
        console.error('Failed to read cached orders:', cacheErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if ((user as any).role && (user as any).role !== 'driver') {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchActiveOrders();
    }
  }, [user, fetchActiveOrders]);

  // Actualización en tiempo real cuando el comercio cambia algo
  useEffect(() => {
    const off = onSocketEvent('order:statusChanged', () => fetchActiveOrders());
    return off;
  }, [onSocketEvent, fetchActiveOrders]);

  // Ping de ubicación también en /active: el loop vive en Home y al aceptar
  // se desmonta — justo cuando el tracking más importa (pickup→delivery).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const ping = () => {
      if (cancelled || document.hidden) return;
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          api
            .updateDriverLocation(pos.coords.latitude, pos.coords.longitude)
            .catch(() => undefined);
        },
        () => undefined,
        { enableHighAccuracy: false, maximumAge: 30_000, timeout: 10_000 },
      );
    };

    ping();
    const t = setInterval(ping, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user]);

  // Aplica la transición localmente (UI optimista) y marca el pedido como encolado
  const applyOptimistic = (orderId: string, nextStatus: string) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
    setQueuedTransitions((prev) => ({ ...prev, [orderId]: nextStatus }));
  };

  const rejectOrder = async () => {
    if (rejecting) return;
    if (!rejectArmed) {
      setRejectArmed(true);
      setTimeout(() => setRejectArmed(false), 5000);
      return;
    }
    setRejectArmed(false);
    setRejecting(true);
    try {
      await api.rejectOrder(order.id);
      const rest = orders.filter((o) => o.id !== order.id);
      setOrders(rest);
      setSelectedId(rest[0]?.id ?? null);
      if (rest.length === 0) {
        router.push('/');
      } else {
        setNotice('Pedido devuelto. El comercio fue avisado para reasignarlo.');
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se pudo rechazar el pedido.');
    } finally {
      setRejecting(false);
    }
  };

  const advanceStatus = async (order: Order) => {
    const flow = NEXT_STATUS[order.status];
    if (!flow || updating) return;

    // Paso final con doble confirmación: un toque accidental no debe cerrar el pedido
    if (flow.final && !confirmArmed) {
      setConfirmArmed(true);
      setTimeout(() => setConfirmArmed(false), 5000);
      return;
    }
    setConfirmArmed(false);

    // ¿Ya hay una transición encolada para este pedido? No duplicar.
    if (queuedTransitionsRef.current[order.id]) return;

    setUpdating(true);
    try {
      await api.updateOrderStatus(order.id, flow.next);
      if (flow.next === 'delivered') {
        setCelebration({ payout: netPayout({ ...order, status: flow.next }) });
      }
      await fetchActiveOrders();
    } catch (err) {
      console.error('Status update failed, queuing for background sync:', err);
      // UI optimista + cola persistente (IndexedDB). backgroundSync replaya
      // con reintentos/backoff al volver la conexión (o en su poll de 5s).
      applyOptimistic(order.id, flow.next);
      try {
        await backgroundSync.enqueue(
          'order:status',
          { id: order.id, status: flow.next },
          { priority: 'critical', metadata: { fromPage: 'driver/active' } },
        );
      } catch (queueErr) {
        console.error('Failed to enqueue status change:', queueErr);
        // Sin cola disponible: revertir para no mostrar un estado mentiroso
        applyOptimistic(order.id, order.status);
        setNotice('Sin conexión y no se pudo guardar el cambio. Intenta de nuevo.');
      }
    } finally {
      setUpdating(false);
      setOnline(navigator.onLine);
    }
  };

  const copyAddress = async (kind: 'pickup' | 'delivery', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setNotice('No se pudo copiar la dirección.');
    }
  };

  // Online/offline + confirmación de sync encolado
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const onSynced = (payload: any) => {
      const action = payload?.action as SyncAction | undefined;
      if (action?.type === 'order:status') {
        const orderId = (action.data as any)?.id;
        if (orderId) {
          setQueuedTransitions((prev) => {
            const next = { ...prev };
            delete next[orderId];
            return next;
          });
        }
        fetchActiveOrders();
      }
    };
    const onFailed = (payload: any) => {
      const action = payload?.action as SyncAction | undefined;
      if (action?.type === 'order:status') {
        const orderId = (action.data as any)?.id;
        if (orderId) {
          setQueuedTransitions((prev) => {
            const next = { ...prev };
            delete next[orderId];
            return next;
          });
          // Revertir al estado real del servidor
          fetchActiveOrders();
          setNotice('Un cambio de estado no se pudo sincronizar después de varios intentos.');
        }
      }
    };

    const offs = [backgroundSync.on('synced', onSynced), backgroundSync.on('failed', onFailed)];

    // Drena la cola al montar (ej. transiciones pendientes de una sesión anterior)
    backgroundSync.processQueue().catch(console.error);

    // Recupera marcadores de transiciones aún pendientes de sesiones anteriores
    backgroundSync
      .getAll()
      .then((actions) => {
        const pending: Record<string, string> = {};
        for (const action of actions) {
          if (
            action.type === 'order:status' &&
            (action.status === 'pending' || action.status === 'syncing')
          ) {
            const data = action.data as { id?: string; status?: string };
            if (data.id && data.status) pending[data.id] = data.status;
          }
        }
        if (Object.keys(pending).length > 0) {
          setQueuedTransitions((prev) => ({ ...pending, ...prev }));
        }
      })
      .catch(console.error);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      offs.forEach((off) => off());
    };
  }, [fetchActiveOrders]);

  if (authLoading || (loading && user)) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <KiwiLoader size={56} />
      </main>
    );
  }

  if (error && orders.length === 0) {
    return (
      <main className="min-h-[100dvh] flex flex-col">
        <header className="pt-safe sticky top-0 z-50 glass-strong">
          <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex min-h-[44px] items-center gap-2 text-surface-600">
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Pedido Activo</h1>
            <div className="w-16" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <p className="text-surface-500 mb-6">{error}</p>
            <button
              onClick={fetchActiveOrders}
              className="px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi-lg"
            >
              <RefreshCw className="h-4 w-4 inline" /> Reintentar
            </button>
          </motion.div>
        </main>
      </main>
    );
  }

  if (orders.length === 0) {
    return (
      <main className="min-h-[100dvh] flex flex-col">
        <header className="pt-safe sticky top-0 z-50 glass-strong">
          <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex min-h-[44px] items-center gap-2 text-surface-600">
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Pedido Activo</h1>
            <div className="w-16" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <Inbox className="h-14 w-14 mx-auto mb-4 text-surface-300 dark:text-surface-600" />
            </motion.div>
            <h2 className="text-lg font-semibold text-surface-800 mb-2">Sin pedidos activos</h2>
            <p className="text-sm text-surface-500 mb-6">
              Acepta un pedido desde el inicio para verlo aquí.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi-lg"
            >
              Ver pedidos disponibles
            </Link>
          </motion.div>
        </main>
        <BottomNav />
      </main>
    );
  }

  const order = orders.find((o) => o.id === selectedId) ?? orders[0];
  const stepIndex = Math.max(0, FLOW_ORDER.indexOf(order.status as (typeof FLOW_ORDER)[number]));
  const meta = STEP_META[order.status] ?? { label: order.status, hint: '' };
  // Nav visible solo antes de iniciar el viaje: en plena entrega la pantalla
  // dueña de la atención es la navegación, no el menú.
  const showBottomNav = order.status === 'assigned';
  const flow = NEXT_STATUS[order.status];
  const driverPayout = netPayout(order);
  // % real del pedido (el admin la puede cambiar; el backend la guarda).
  const feePct = Math.round(Number((order as any).commissionRate ?? 0.15) * 100);
  const distanceKm = Number(order.distanceKm ?? 0);
  const customer = parseCustomer(order.specialInstructions);
  const notes = (order.specialInstructions || '')
    .replace(/Cliente:[^·]*/g, '')
    .replace(/^·\s*/, '')
    .trim();
  // Transición encolada esperando sync para el pedido mostrado
  const pendingStatus = queuedTransitions[order.id];
  const showOfflineBanner = !online || fromCache;
  const progress = Math.min(100, Math.round((stepIndex / (FLOW_ORDER.length - 1)) * 100));
  // Mapa in-app tipo Uber: a dónde voy ahora depende del estado
  const pickupPoint = toMapPoint(
    order.pickupLat,
    order.pickupLng,
    order.merchant?.businessName || order.pickupAddress,
  );
  const deliveryPoint = toMapPoint(order.deliveryLat, order.deliveryLng, order.deliveryAddress);
  const mapTarget = stepIndex >= 2 ? ('delivery' as const) : ('pickup' as const);
  const mapTargetLabel =
    mapTarget === 'pickup'
      ? `Vas a recoger · ${order.merchant?.businessName || 'Comercio'}`
      : `Vas a entregar · ${order.deliveryAddress}`;

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <header className="pt-safe sticky top-0 z-50 glass-strong">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-surface-600">
            <span>←</span>
            <span className="text-sm font-medium">Volver</span>
          </Link>
          <h1 className="font-display font-semibold text-surface-800">Pedido Activo</h1>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchActiveOrders();
            }}
            className="w-16 flex justify-end text-surface-500"
            aria-label="Refrescar"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6 pb-40">
        {/* Mapa in-app tipo Uber: navegación sin salir de la app */}
        <div id="driver-map" className="mb-4 scroll-mt-24">
          <DriverMap
            pickup={pickupPoint}
            delivery={deliveryPoint}
            target={mapTarget}
            targetLabel={mapTargetLabel}
            height={340}
          />
        </div>

        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-3"
            >
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{notice}</p>
              <button
                onClick={() => setNotice(null)}
                aria-label="Descartar aviso"
                className="text-amber-600 dark:text-amber-400"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Banner offline / caché */}
        {showOfflineBanner && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-3">
            <CloudOff className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {fromCache
                ? 'Sin conexión — mostrando tus pedidos guardados. Los cambios se envían al reconectar.'
                : 'Sin conexión — los cambios de estado se guardan y se envían automáticamente.'}
            </p>
          </div>
        )}

        {/* Cola de entregas: todos los activos en orden, se toca para cambiar */}
        {orders.length > 1 && (
          <div className="mb-4 overflow-hidden rounded-3xl glass">
            <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-surface-400">
              Cola de entregas ({orders.length})
            </p>
            <div className="space-y-1 p-2">
              {orders.map((o, idx) => {
                const active = o.id === order.id;
                return (
                  <motion.button
                    key={o.id}
                    onClick={() => {
                      setSelectedId(o.id);
                      setConfirmArmed(false);
                      setRejectArmed(false);
                    }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                      active ? 'bg-kiwi-700 text-white shadow-kiwi' : ''
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-surface-100 dark:bg-surface-700 text-surface-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-semibold ${
                          active ? 'text-white' : 'text-surface-800 dark:text-surface-100'
                        }`}
                      >
                        {(o as any).merchant?.businessName || 'Comercio'} → {o.deliveryAddress}
                      </span>
                      <span className={`text-xs ${active ? 'text-white/80' : 'text-surface-400'}`}>
                        {STEP_META[o.status]?.label ?? o.status}
                        {queuedTransitions[o.id] ? ' · ⏳ sincronizando' : ''}
                        {active ? ' · VIENDO ESTE' : ''}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-mono text-sm font-bold ${
                        active ? 'text-white' : 'text-kiwi-700'
                      }`}
                    >
                      ₡{netPayout(o).toLocaleString()}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* HERO: estado + ganancia + progreso */}
        <AnimatePresence mode="wait">
          <motion.div
            key={order.id + order.status}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="mb-4 overflow-hidden rounded-3xl bg-kiwi-gradient p-5 text-white glow-kiwi-lg relative"
          >
            <motion.div
              className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <motion.p
                    key={order.status}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-display font-bold"
                  >
                    {meta.label}
                  </motion.p>
                  <p className="text-white/80 text-sm">{meta.hint}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-white/70">
                    <Timer className="h-3 w-3" />
                    {elapsedLabel((order as any).assignedAt ?? order.createdAt)} · #
                    {order.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/70">Ganás</p>
                  <AnimatedCounter value={driverPayout} className="text-2xl font-bold font-mono" />
                  <p className="text-xs text-white/70">CRC</p>
                  <p className="mt-0.5 text-[11px] text-white/60">
                    Viaje ₡{Number(order.basePrice ?? driverPayout).toLocaleString()} − {feePct}%
                    Kiwi
                  </p>
                </div>
              </div>

              {/* Stepper */}
              <div className="mt-4 flex items-center">
                {FLOW_ORDER.map((s, i) => {
                  const done = i < stepIndex;
                  const current = i === stepIndex;
                  return (
                    <div key={s} className="flex flex-1 items-center last:flex-none">
                      <motion.div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          done
                            ? 'bg-white text-kiwi-700'
                            : current
                              ? 'bg-white text-kiwi-700 ring-4 ring-white/30'
                              : 'bg-white/20 text-white/70'
                        }`}
                        animate={current ? { scale: [1, 1.12, 1] } : {}}
                        transition={{ duration: 1.6, repeat: Infinity }}
                      >
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </motion.div>
                      {i < FLOW_ORDER.length - 1 && (
                        <div className="mx-1 h-1 flex-1 overflow-hidden rounded bg-white/20">
                          <motion.div
                            className="h-1 rounded bg-white"
                            initial={false}
                            animate={{ width: done ? '100%' : '0%' }}
                            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-white/80">
                <span>Aceptado</span>
                <span>Recogido</span>
                <span>Entregado</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded bg-white/20">
                <motion.div
                  className="h-1 rounded bg-white"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* TIMELINE: recoger -> entregar */}
        <div className="mb-4 rounded-3xl glass p-5">
          {/* Recoger */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <motion.div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  stepIndex >= 2
                    ? 'bg-kiwi-100 text-kiwi-700'
                    : 'bg-kiwi-700 text-white shadow-kiwi'
                }`}
                animate={stepIndex < 2 ? { scale: [1, 1.06, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {stepIndex >= 2 ? <Check className="h-5 w-5" /> : <Store className="h-5 w-5" />}
              </motion.div>
              <div className="my-1 w-0.5 flex-1 rounded bg-surface-200 dark:bg-surface-700" />
            </div>
            <div className="flex-1 pb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-kiwi-700">
                {stepIndex >= 2 ? 'Recogido en' : 'Ir a recoger a'}
              </p>
              <p className="text-base font-semibold text-surface-800 dark:text-surface-100">
                {order.merchant?.businessName || 'Comercio'}
              </p>
              <button
                onClick={() => copyAddress('pickup', order.pickupAddress)}
                className="group mt-0.5 flex items-start gap-1 text-left text-sm text-surface-500"
              >
                <span className="flex-1">{order.pickupAddress}</span>
                {copied === 'pickup' ? (
                  <Check className="h-4 w-4 shrink-0 text-kiwi-500" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                )}
              </button>
              <TapButton
                variant="secondary"
                haptic
                className="mt-3 h-11 w-full rounded-xl text-sm"
                onClick={scrollToMap}
              >
                <Navigation className="h-4 w-4" /> Ver en mapa
              </TapButton>
              <button
                onClick={() =>
                  openMaps(
                    order.pickupLat ? Number(order.pickupLat) : null,
                    order.pickupLng ? Number(order.pickupLng) : null,
                    order.pickupAddress,
                  )
                }
                className="mt-2 w-full text-center text-xs text-surface-400 underline-offset-2 hover:underline"
              >
                Abrir en Google Maps
              </button>
            </div>
          </div>

          {/* Entregar */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <motion.div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  stepIndex >= 3
                    ? 'bg-gold-100 text-gold-600'
                    : 'bg-surface-800 text-white dark:bg-surface-700'
                }`}
                animate={stepIndex === 2 ? { scale: [1, 1.06, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Home className="h-5 w-5" />
              </motion.div>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
                {order.status === 'in_transit_to_delivery' ? 'Ir a entregar a' : 'Entregar en'}
              </p>
              <p className="text-base font-semibold text-surface-800 dark:text-surface-100">
                {order.deliveryAddress}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-surface-500">
                {(order as any).deliveryZone && (
                  <span className="rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 px-2.5 py-0.5 font-medium text-kiwi-700 dark:text-kiwi-300">
                    <MapPin className="h-3 w-3 inline" /> {String((order as any).deliveryZone)}
                  </span>
                )}
                {distanceKm > 0 && <span>{distanceKm} km</span>}
                {customer.name && <span>· {customer.name}</span>}
              </div>
              <button
                onClick={() => copyAddress('delivery', order.deliveryAddress)}
                className="mt-1 flex items-center gap-1 text-xs text-surface-400"
              >
                {copied === 'delivery' ? (
                  <span className="flex items-center gap-1 text-kiwi-700">
                    <Check className="h-3 w-3" /> Copiada
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Copy className="h-3 w-3" /> Copiar dirección
                  </span>
                )}
              </button>
              <TapButton
                variant="gradient"
                haptic
                className="mt-3 h-11 w-full rounded-xl text-sm"
                onClick={scrollToMap}
              >
                <Navigation className="h-4 w-4" /> Navegar en la app
              </TapButton>
              <button
                onClick={() =>
                  openMaps(
                    order.deliveryLat ? Number(order.deliveryLat) : null,
                    order.deliveryLng ? Number(order.deliveryLng) : null,
                    order.deliveryAddress,
                  )
                }
                className="mt-2 w-full text-center text-xs text-surface-400 underline-offset-2 hover:underline"
              >
                Abrir en Google Maps
              </button>
            </div>
          </div>
        </div>

        {/* Contacto cliente */}
        {customer.phone && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 grid grid-cols-2 gap-3"
          >
            <a
              href={`tel:${customer.phone.replace(/\s/g, '')}`}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl glass text-sm font-semibold text-surface-700 dark:text-surface-200"
            >
              <Phone className="h-4 w-4 text-kiwi-500" /> Llamar
            </a>
            <a
              href={toWaLink(customer.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl glass text-sm font-semibold text-surface-700 dark:text-surface-200"
            >
              <MessageCircle className="h-4 w-4 text-kiwi-500" /> WhatsApp
            </a>
          </motion.div>
        )}

        {/* Paquete / flete */}
        {order.kind === 'freight' && (
          <div className="mb-4 rounded-2xl glass p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-surface-800 dark:text-surface-200">
              <Package className="h-4 w-4 text-kiwi-500" />
              {order.packageDescription || 'Encomienda'}
            </p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-surface-500">
              {order.weightKg != null && (
                <span className="flex items-center gap-1">
                  <Weight className="h-3 w-3" /> {Number(order.weightKg)} kg
                </span>
              )}
              {order.packageSize && <span>Tamaño {order.packageSize}</span>}
            </div>
          </div>
        )}

        {/* Qué llevar (colapsable) */}
        {Array.isArray((order as any).items) && (order as any).items.length > 0 && (
          <div className="mb-4 overflow-hidden rounded-2xl glass">
            <button
              onClick={() => setShowItems((v) => !v)}
              className="flex w-full items-center justify-between p-4 text-sm font-semibold text-surface-700 dark:text-surface-200"
            >
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-kiwi-500" />
                Qué llevar (
                {(order as any).items.reduce(
                  (s: number, it: any) => s + Number(it.quantity || 0),
                  0,
                )}
                )
              </span>
              <motion.span animate={{ rotate: showItems ? 180 : 0 }}>
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {showItems && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 px-4 pb-4">
                    {(order as any).items.map((it: any, i: number) => (
                      <div
                        key={it.id ?? i}
                        className="flex items-center justify-between rounded-xl bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-surface-700 dark:text-surface-200">
                          {it.name}
                          {Array.isArray(it.selectedVariants) && it.selectedVariants.length > 0 && (
                            <span className="block text-xs font-normal text-surface-500">
                              {it.selectedVariants.map((v: any) => v.option).join(', ')}
                            </span>
                          )}
                        </span>
                        <span className="rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 px-2.5 py-0.5 text-xs font-bold text-kiwi-700 dark:text-kiwi-300">
                          x{it.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Notas */}
        {notes && (
          <div className="mb-4 rounded-2xl bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 p-4">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-gold-700 dark:text-gold-300">
              <Flag className="h-3 w-3" /> Notas del pedido
            </p>
            <p className="text-sm text-surface-700 dark:text-surface-200">{notes}</p>
          </div>
        )}

        {/* Rechazar: solo asignado sin recoger. Vuelve a concurso y avisa
            al comercio para que reasigne. Doble toque para confirmar. */}
        {order.status === 'assigned' && (
          <div className="mb-4 text-center">
            <button
              onClick={rejectOrder}
              disabled={rejecting}
              className="text-xs font-medium text-surface-400 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {rejecting
                ? 'Rechazando…'
                : rejectArmed
                  ? 'Tocá de nuevo para devolver el pedido'
                  : 'No puedo hacerlo: rechazar pedido'}
            </button>
          </div>
        )}
      </main>

      {/* Barra de acción fija */}
      <div className="fixed inset-x-0 bottom-0 z-40 pb-safe">
        <div className="mx-auto max-w-lg px-4 pb-4">
          <motion.div
            layout
            className="rounded-3xl glass-strong p-3 shadow-kiwi-lg flex items-center gap-3"
          >
            <div className="pl-2">
              <p className="text-[11px] text-surface-400">Ganancia</p>
              <p className="font-mono text-lg font-bold text-kiwi-700">
                ₡{driverPayout.toLocaleString()}
              </p>
              <p className="text-[10px] text-surface-400">neta (−{feePct}% Kiwi)</p>
            </div>
            <div className="flex-1">
              {pendingStatus ? (
                <button
                  disabled
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-surface-200 dark:bg-surface-700 font-semibold text-surface-600 dark:text-surface-300"
                >
                  <CloudUpload className="h-5 w-5 animate-pulse" />
                  <span className="text-sm">Sincronizando…</span>
                </button>
              ) : (
                flow && (
                  <TapButton
                    haptic
                    variant={confirmArmed ? 'secondary' : 'gradient'}
                    onClick={() => advanceStatus(order)}
                    disabled={updating}
                    className="h-14 w-full rounded-2xl text-base font-bold"
                  >
                    {updating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : confirmArmed ? (
                      'Tocá de nuevo para confirmar'
                    ) : (
                      flow.label
                    )}
                  </TapButton>
                )
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Celebración de entrega */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-surface-800 p-8 text-center"
              initial={{ scale: 0.8, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
              >
                <PartyPopper className="h-14 w-14 mx-auto mb-3 text-kiwi-500" />
              </motion.div>
              <h2 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
                ¡Entregado!
              </h2>
              <p className="mt-1 text-sm text-surface-500">Ganaste</p>
              <AnimatedCounter
                value={celebration.payout}
                className="font-mono text-4xl font-bold text-kiwi-700"
              />
              <div className="mt-6 space-y-2">
                <TapButton
                  haptic
                  variant="gradient"
                  className="h-12 w-full rounded-2xl"
                  onClick={() => {
                    setCelebration(null);
                    router.push('/');
                  }}
                >
                  Buscar más pedidos
                </TapButton>
                <button
                  onClick={() => setCelebration(null)}
                  className="h-11 w-full rounded-2xl text-sm font-medium text-surface-500"
                >
                  Quedarme aquí
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showBottomNav && <BottomNav />}
    </main>
  );
}
