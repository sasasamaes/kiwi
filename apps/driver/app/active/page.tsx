// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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
  ShoppingBag,
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
  playNotificationSound,
  OrderChat,
  LanguageSwitcherCompact,
  useDeliveryZones,
  useTranslations,
} from '@kiwi/ui';

// Estados considerados "activos" para el repartidor
const ACTIVE_STATUSES = [
  'assigned',
  'pending_acceptance',
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

const STEP_META: Record<string, { labelKey: string; hintKey: string }> = {
  assigned: { labelKey: 'stepAssignedLabel', hintKey: 'stepAssignedHint' },
  pending_acceptance: { labelKey: 'stepPendingLabel', hintKey: 'stepPendingHint' },
  in_transit_to_pickup: { labelKey: 'stepToPickupLabel', hintKey: 'stepToPickupHint' },
  picked_up: { labelKey: 'stepPickedLabel', hintKey: 'stepPickedHint' },
  in_transit_to_delivery: { labelKey: 'stepToDeliveryLabel', hintKey: 'stepToDeliveryHint' },
  delivered: { labelKey: 'stepDeliveredLabel', hintKey: 'stepDeliveredHint' },
};

const NEXT_STATUS: Record<string, { next: string; labelKey: string; final?: boolean }> = {
  assigned: { next: 'in_transit_to_pickup', labelKey: 'nextToPickup' },
  in_transit_to_pickup: { next: 'picked_up', labelKey: 'nextPickedUp' },
  picked_up: { next: 'in_transit_to_delivery', labelKey: 'nextToDelivery' },
  in_transit_to_delivery: { next: 'delivered', labelKey: 'nextDelivered', final: true },
};

// Terminales: nunca se muestran en la lista de activos.
const TERMINAL_STATUSES = ['delivered', 'cancelled'];

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

/**
 * Cuenta regresiva aislada: el intervalo de 1s vive ACÁ, no en la página.
 * Antes el tick estaba en el state de la página y cada segundo re-renderizaba
 * TODO (mapa, lista, botones). Ahora solo este texto se actualiza.
 */
function Countdown({
  targetMs,
  children,
}: {
  targetMs: number | null;
  children: (remainingMs: number | null) => ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (targetMs == null || targetMs <= Date.now()) return;
    const t = setInterval(() => {
      const n = Date.now();
      if (n >= targetMs) clearInterval(t);
      setNow(n);
    }, 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  return <>{children(targetMs == null ? null : Math.max(0, targetMs - now))}</>;
}

function toWaLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length === 8 ? `506${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

function elapsedLabel(
  iso: string | null | undefined,
  t: (key: string, variables?: Record<string, string | number>) => string,
): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return t('wdrvwork.active.elapsedNow');
  if (mins < 60) return t('wdrvwork.active.elapsedMins', { count: mins });
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m
    ? t('wdrvwork.active.elapsedHoursMins', { h, m })
    : t('wdrvwork.active.elapsedHours', { h });
}

// Clave de caché para render offline
const ORDERS_CACHE_KEY = 'driver_active_orders';

export default function ActiveOrders() {
  const router = useRouter();
  const { t } = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { on: onSocketEvent } = useSocket({});

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  // Subida de evidencia delivery: foto de la entrega al cliente.
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
  const [accepting, setAccepting] = useState(false);
  const [celebration, setCelebration] = useState<{ payout: number } | null>(null);
  // Zonas con label legible (hook arriba: hay returns tempranos abajo).
  const deliveryZones = useDeliveryZones();
  // Reloj vivo para "hace X min"
  const [, setTick] = useState(0);
  // Factura del mandado: el driver registra lo que pagó en la tienda.
  const [receiptInput, setReceiptInput] = useState('');
  const [savingReceipt, setSavingReceipt] = useState(false);
  const saveReceipt = async (orderId: string) => {
    const amount = Math.round(Number(receiptInput));
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice(t('wdrvwork.active.mandaReceiptError'));
      return;
    }
    setSavingReceipt(true);
    try {
      await api.setReceiptAmount(orderId, amount);
      setReceiptInput('');
      setNotice(t('wdrvwork.active.mandaReceiptSaved'));
      await fetchActiveOrders();
    } catch {
      setNotice(t('wdrvwork.active.mandaReceiptError'));
    } finally {
      setSavingReceipt(false);
    }
  };
  // orderId -> estado al que se quiere avanzar mientras está encolado
  const [queuedTransitions, setQueuedTransitions] = useState<Record<string, string>>({});
  const queuedTransitionsRef = useRef(queuedTransitions);
  useEffect(() => {
    queuedTransitionsRef.current = queuedTransitions;
  }, [queuedTransitions]);
  // La primera carga fallida usa la pantalla de error; las siguientes deben
  // avisar en vez de dejar la lista vieja en silencio.
  const loadedOnceRef = useRef(false);

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
      setError(err instanceof Error ? err.message : t('wdrvwork.active.loadError'));
      // Si ya había lista en pantalla, el error era invisible y la lista
      // quedaba vieja ("no se cierran"): avisar con reintento.
      if (loadedOnceRef.current) {
        setNotice(t('wdrvwork.active.listStale'));
      }
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
      loadedOnceRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

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

  // Aplica la transición localmente (UI optimista) y marca el pedido como encolado.
  // Los estados terminales se quitan de la lista al momento (igual que hace el
  // servidor): un entregado que sigue visible "abierto" es el reporte típico.
  // Si el sync falla después, el refetch restaura la verdad del servidor.
  const applyOptimistic = (orderId: string, nextStatus: string) => {
    if (TERMINAL_STATUSES.includes(nextStatus)) {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } else {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
    }
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
        setNotice(t('wdrvwork.active.rejectDone'));
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('wdrvwork.active.rejectFailed'));
    } finally {
      setRejecting(false);
    }
  };

  const acceptAssignment = async () => {
    if (accepting || rejecting) return;
    setAccepting(true);
    try {
      await api.acceptAssignment(order.id);
      setNotice(t('wdrvwork.active.acceptDone'));
      await fetchActiveOrders();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('wdrvwork.active.acceptFailed'));
    } finally {
      setAccepting(false);
    }
  };

  // Cuenta regresiva de aceptación y readyAt: el tick de 1s vive dentro del
  // componente <Countdown> (solo se re-renderiza el texto). Acá queda un poll
  // sin setState que solo dispara sonido/vibración cuando un readyAt se cumple.
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // readyAt alcanzado → sonido + vibración una vez por pedido (ir a recoger).
  const readyNotifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const checkReady = () => {
      for (const o of ordersRef.current) {
        const t = new Date(String((o as any).readyAt ?? '')).getTime();
        if (
          !Number.isFinite(t) ||
          t > Date.now() ||
          (o.status !== 'assigned' && o.status !== 'in_transit_to_pickup') ||
          readyNotifiedRef.current.has(o.id)
        ) {
          continue;
        }
        readyNotifiedRef.current.add(o.id);
        playNotificationSound('order_update');
        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
        } catch {
          // sin vibración: el sonido y el banner alcanzan
        }
      }
    };
    checkReady();
    const needsPoll = ordersRef.current.some((o) => {
      const t = new Date(String((o as any).readyAt ?? '')).getTime();
      return (
        Number.isFinite(t) &&
        t > Date.now() &&
        (o.status === 'assigned' || o.status === 'in_transit_to_pickup')
      );
    });
    if (!needsPoll) return;
    const timer = setInterval(checkReady, 1000);
    return () => clearInterval(timer);
  }, [orders]);

  const advanceStatus = async (order: Order) => {
    const flow = NEXT_STATUS[order.status];
    if (!flow || updating) return;

    // Evidencia 1+1 obligatoria: sin foto no se avanza (el backend también
    // lo bloquea con 400, esto evita el tap inútil y explica el porqué).
    if (flow.next === 'picked_up' && !(order as any).pickupProofPhotoUrl) {
      setNotice(t('wdrvwork.active.needPickupPhoto'));
      return;
    }
    if (flow.next === 'delivered' && !(order as any).deliveryProofPhotoUrl) {
      // La foto la toma el driver en este paso:
      setNotice(t('wdrvwork.active.needDeliveryPhoto'));
      return;
    }

    // Paso final con doble confirmación: un toque accidental no debe cerrar el pedido
    if (flow.final && !confirmArmed) {
      setConfirmArmed(true);
      setTimeout(() => setConfirmArmed(false), 5000);
      return;
    }
    setConfirmArmed(false);

    // ¿Ya hay una transición encolada para este pedido? No duplicar (pero
    // avisar: el tap silencioso que no hace nada parece "no cierra").
    if (queuedTransitionsRef.current[order.id]) {
      setNotice(t('wdrvwork.active.alreadyQueued'));
      return;
    }

    // Marcar ANTES del request (ref síncrono + state): sin esto el guard de
    // arriba nunca ve la transición en curso y el doble tap duplica el PUT.
    // Se limpia al confirmar; si va a la cola, el marcador queda hasta el sync.
    const markQueued = (next: string | null) => {
      if (next == null) {
        const { [order.id]: _dropped, ...rest } = queuedTransitionsRef.current;
        queuedTransitionsRef.current = rest;
        setQueuedTransitions(rest);
      } else {
        queuedTransitionsRef.current = { ...queuedTransitionsRef.current, [order.id]: next };
        setQueuedTransitions(queuedTransitionsRef.current);
      }
    };
    markQueued(flow.next);

    setUpdating(true);
    try {
      await api.updateOrderStatus(order.id, flow.next);
      markQueued(null);
      if (flow.next === 'delivered') {
        setCelebration({ payout: netPayout({ ...order, status: flow.next }) });
      }
      await fetchActiveOrders();
    } catch (err) {
      console.error('Status update failed, queuing for background sync:', err);
      // ¿El servidor SÍ avanzó y se perdió la respuesta? Reconciliar antes de
      // encolar un duplicado que el backend rechazaría con 400 ("No se puede
      // cambiar"), envenenando la cola y revirtiendo la UI al estado viejo.
      try {
        const server = await api.getOrderById(order.id);
        const rank = (s: string) => FLOW_ORDER.indexOf(s as (typeof FLOW_ORDER)[number]);
        const serverDone =
          server != null &&
          (TERMINAL_STATUSES.includes(server.status) || rank(server.status) >= rank(flow.next));
        if (serverDone) {
          markQueued(null);
          if (server.status === 'delivered') {
            setCelebration({ payout: netPayout({ ...order, status: flow.next }) });
          }
          await fetchActiveOrders();
          return;
        }
      } catch {
        // Sin red: seguir a la cola persistente.
      }
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
        setNotice(t('wdrvwork.active.queueFailed'));
      }
    } finally {
      setUpdating(false);
      setOnline(navigator.onLine);
    }
  };

  // Evidencia delivery: el repartidor fotografía la entrega al cliente.
  // Después de subir se refresca la orden para que el avance se desbloquee.
  const uploadDeliveryPhoto = async (target: Order, file: File) => {
    if (uploadingPhoto) return;
    if (file.size > 5 * 1024 * 1024) {
      setNotice(t('wdrvwork.active.photoTooBig'));
      return;
    }
    if (
      file.type &&
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(
        file.type,
      )
    ) {
      setNotice(t('wdrvwork.active.photoBadType'));
      return;
    }
    setUploadingPhoto(true);
    try {
      await api.uploadOrderProofPhoto(target.id, 'delivery', file);
      setNotice(t('wdrvwork.active.photoSaved'));
      await fetchActiveOrders();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('wdrvwork.active.photoFailed'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const copyAddress = async (kind: 'pickup' | 'delivery', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setNotice(t('wdrvwork.active.copyFailed'));
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
          // "No se puede cambiar" = el servidor ya se movió (respuesta
          // perdida o doble tap): convergió, no es un error real.
          const errMsg = String((payload as any)?.error ?? '');
          if (!/No se puede cambiar/i.test(errMsg)) {
            setNotice(t('wdrvwork.active.syncFailed'));
          }
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
              <span className="text-sm font-medium">{t('wdrvwork.active.back')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">
              {t('wdrvwork.active.title')}
            </h1>
            <LanguageSwitcherCompact />
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
              <RefreshCw className="h-4 w-4 inline" /> {t('wdrvwork.active.retry')}
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
              <span className="text-sm font-medium">{t('wdrvwork.active.back')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">
              {t('wdrvwork.active.title')}
            </h1>
            <LanguageSwitcherCompact />
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
            <h2 className="text-lg font-semibold text-surface-800 mb-2">
              {t('wdrvwork.active.emptyTitle')}
            </h2>
            <p className="text-sm text-surface-500 mb-6">{t('wdrvwork.active.emptyDesc')}</p>
            <Link
              href="/"
              className="inline-block px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi-lg"
            >
              {t('wdrvwork.active.emptyCta')}
            </Link>
          </motion.div>
        </main>
        <BottomNav />
      </main>
    );
  }

  const order = orders.find((o) => o.id === selectedId) ?? orders[0];
  // El pedido puede traer la zona como id crudo (UUID de la DB). Se resuelve
  // contra el catálogo; si sigue pareciendo UUID, se oculta el chip.
  const zoneLabel = (() => {
    const raw = String((order as any).deliveryZone ?? '').trim();
    if (!raw) return '';
    const found = deliveryZones.find((z) => z.id === raw || z.label === raw);
    if (found) return found.label;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return '';
    return raw;
  })();
  const stepIndex = Math.max(0, FLOW_ORDER.indexOf(order.status as (typeof FLOW_ORDER)[number]));
  const meta = STEP_META[order.status];
  // La barra de acción fija es dueña del borde inferior en todos los pasos:
  // el BottomNav se oculta en esta pantalla para que no tape el botón
  // (antes se traslapaban en "assigned" y el botón quedaba cortado).
  const flow = NEXT_STATUS[order.status];
  const driverPayout = netPayout(order);
  // % real del pedido (el admin la puede cambiar; el backend la guarda).
  const feePct = Math.round(Number((order as any).commissionRate ?? 0.15) * 100);
  // Efectivo a cobrar en mano: el total en pedidos de la app cliente,
  // solo el viaje en pedidos del comercio (los productos ya los cobró
  // el comercio). Igual que la validación del backend.
  const isClientOrder = (order as any).origin === 'client_app';
  const collectable = Math.round(
    isClientOrder ? Number(order.totalAmount ?? 0) : Number(order.basePrice ?? 0),
  );
  const tendered = (order as any).cashTendered != null ? Number((order as any).cashTendered) : null;
  const distanceKm = Number(order.distanceKm ?? 0);
  // Contacto del cliente: primero los campos del pedido (siempre vienen para
  // el asignado), fallback al parseo de instrucciones viejas ("Cliente: …").
  const parsedCustomer = parseCustomer(order.specialInstructions);
  const customer = {
    name: (order as any).customerName?.trim() || parsedCustomer.name,
    phone: (order as any).customerPhone?.trim() || parsedCustomer.phone,
  };
  const merchantPhone =
    typeof (order as any).merchant?.user?.phone === 'string'
      ? (order as any).merchant.user.phone
      : null;
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
      ? t('wdrvwork.active.mapPickup', {
          name: order.merchant?.businessName || t('wdrvwork.active.commerceFallback'),
        })
      : t('wdrvwork.active.mapDelivery', { address: order.deliveryAddress });

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <header className="pt-safe sticky top-0 z-50 glass-strong">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-surface-600">
            <span>←</span>
            <span className="text-sm font-medium">{t('wdrvwork.active.back')}</span>
          </Link>
          <h1 className="font-display font-semibold text-surface-800">
            {t('wdrvwork.active.title')}
          </h1>
          <div className="flex items-center gap-2">
            <LanguageSwitcherCompact />
            <button
              onClick={() => {
                setRefreshing(true);
                fetchActiveOrders();
              }}
              className="flex justify-end text-surface-500"
              aria-label={t('wdrvwork.active.refreshAria')}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
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
                aria-label={t('wdrvwork.active.dismissAria')}
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
              {fromCache ? t('wdrvwork.active.offlineCached') : t('wdrvwork.active.offlineQueue')}
            </p>
          </div>
        )}
        {/* Aceptación: el comercio te eligió, confirmá antes de que vuelva a concurso */}
        {order.status === 'pending_acceptance' && (
          <Countdown
            targetMs={
              (order as any).acceptanceExpiresAt
                ? new Date((order as any).acceptanceExpiresAt).getTime()
                : null
            }
          >
            {(remaining) => {
              const mm =
                remaining != null ? String(Math.floor(remaining / 60000)).padStart(2, '0') : '--';
              const ss =
                remaining != null
                  ? String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')
                  : '--';
              return (
                <div className="mb-4 rounded-3xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-5">
                  <p className="flex items-center gap-2 text-base font-semibold text-surface-800 dark:text-surface-100">
                    <Timer className="h-5 w-5 text-kiwi-600" />
                    {t('wdrvwork.active.acceptTitle')}
                  </p>
                  <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                    {remaining != null && remaining <= 0
                      ? t('wdrvwork.active.acceptExpired')
                      : t('wdrvwork.active.acceptCountdown', { time: `${mm}:${ss}` })}
                  </p>
                  <p className="mt-2 font-mono text-3xl font-bold text-kiwi-700 dark:text-kiwi-300">
                    {mm}:{ss}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <TapButton
                      haptic
                      variant="gradient"
                      className="h-12 w-full rounded-2xl text-sm font-bold"
                      onClick={acceptAssignment}
                      disabled={accepting || rejecting}
                    >
                      {accepting ? t('wdrvwork.active.accepting') : t('wdrvwork.active.acceptCta')}
                    </TapButton>
                    <TapButton
                      haptic
                      variant="secondary"
                      className="h-12 w-full rounded-2xl text-sm font-bold"
                      onClick={rejectOrder}
                      disabled={accepting || rejecting}
                    >
                      {rejecting
                        ? t('wdrvwork.active.rejecting')
                        : rejectArmed
                          ? t('wdrvwork.active.rejectConfirm')
                          : t('wdrvwork.active.rejectCta')}
                    </TapButton>
                  </div>
                </div>
              );
            }}
          </Countdown>
        )}
        {/* Recogida rápida: cuenta atrás hasta que la comida está lista */}
        {(order.status === 'assigned' || order.status === 'in_transit_to_pickup') &&
          (() => {
            const readyMs = new Date(String((order as any).readyAt ?? '')).getTime();
            if (!Number.isFinite(readyMs)) return null;
            return (
              <Countdown targetMs={readyMs}>
                {(remaining) => {
                  const left = remaining ?? 0;
                  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
                  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
                  const ready = left <= 0;
                  const hh = new Date(readyMs).toLocaleTimeString('es-CR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div
                      className={`mb-4 rounded-3xl border p-5 shadow-soft dark:shadow-dark ${
                        ready
                          ? 'bg-kiwi-700 text-white border-kiwi-700'
                          : 'bg-white dark:bg-surface-800 border-surface-200/60 dark:border-white/[0.06]'
                      }`}
                    >
                      <p
                        className={`flex items-center gap-2 text-base font-semibold ${
                          ready ? 'text-white' : 'text-surface-800 dark:text-surface-100'
                        }`}
                      >
                        <Timer className="h-5 w-5" />
                        {ready
                          ? t('wdrvwork.active.readyToGo')
                          : t('wdrvwork.active.readyAt', { time: hh })}
                      </p>
                      {ready ? (
                        <p className="mt-1 text-sm text-white/90">
                          {t('wdrvwork.active.pickupAt', {
                            name:
                              (order as any).merchant?.businessName ||
                              t('wdrvwork.active.merchantFallback'),
                          })}
                        </p>
                      ) : (
                        <p className="mt-2 font-mono text-3xl font-bold text-kiwi-700 dark:text-kiwi-300">
                          {mm}:{ss}
                        </p>
                      )}
                    </div>
                  );
                }}
              </Countdown>
            );
          })()}
        {/* Cola de entregas: todos los activos en orden, se toca para cambiar */}{' '}
        {orders.length > 1 && (
          <div className="mb-4 overflow-hidden rounded-3xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark">
            <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
              {t('wdrvwork.active.queueTitle', { count: orders.length })}
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
                      active ? 'bg-kiwi-700 text-white' : ''
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
                        {(o as any).merchant?.businessName || t('wdrvwork.active.commerceFallback')}{' '}
                        → {o.deliveryAddress}
                      </span>
                      <span
                        className={`text-xs ${active ? 'text-white/80' : 'text-surface-500 dark:text-surface-400'}`}
                      >
                        {STEP_META[o.status]
                          ? t(`wdrvwork.active.${STEP_META[o.status].labelKey}`)
                          : o.status}
                        {queuedTransitions[o.id] ? t('wdrvwork.active.syncingSuffix') : ''}
                        {active ? t('wdrvwork.active.viewingSuffix') : ''}
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
                    {meta ? t(`wdrvwork.active.${meta.labelKey}`) : order.status}
                  </motion.p>
                  <p className="text-white/80 text-sm">
                    {meta ? t(`wdrvwork.active.${meta.hintKey}`) : ''}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-white/70">
                    <Timer className="h-3 w-3" />
                    {elapsedLabel((order as any).assignedAt ?? order.createdAt, t)} · #
                    {order.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/70">{t('wdrvwork.active.earnLabel')}</p>
                  <AnimatedCounter value={driverPayout} className="text-2xl font-bold font-mono" />
                  <p className="text-xs text-white/70">{t('wdrvwork.active.currencyCode')}</p>
                  <p className="mt-0.5 text-[11px] text-white/60">
                    {t('wdrvwork.active.tripNet', {
                      amount: Number(order.basePrice ?? driverPayout).toLocaleString(),
                      pct: feePct,
                    })}
                  </p>
                </div>
              </div>
              {/* Efectivo: cuánto cobrar y cuánto dar de vuelto */}
              {((order as any).payment?.method === 'cash' || tendered != null) && (
                <div className="mt-4 rounded-2xl bg-gold-400/90 p-4 text-surface-900">
                  <p className="text-sm font-bold">
                    {t('wdrvwork.active.cashTitle', {
                      amount: collectable.toLocaleString(),
                    })}
                  </p>
                  {!isClientOrder && (
                    <p className="mt-0.5 text-xs font-medium">
                      {t('wdrvwork.active.cashTripOnly')}
                    </p>
                  )}
                  {tendered != null ? (
                    <p className="mt-0.5 text-sm font-semibold">
                      {t('wdrvwork.active.cashChange', {
                        tendered: tendered.toLocaleString(),
                        change: Math.max(0, tendered - collectable).toLocaleString(),
                      })}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs">{t('wdrvwork.active.cashNoTender')}</p>
                  )}
                </div>
              )}
              {/* Stepper */}{' '}
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
                <span>{t('wdrvwork.active.stepAccepted')}</span>
                <span>{t('wdrvwork.active.stepPicked')}</span>
                <span>{t('wdrvwork.active.stepDelivered')}</span>
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
        <div className="mb-4 rounded-3xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-5">
          {/* Recoger */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <motion.div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  stepIndex >= 2 ? 'bg-kiwi-100 text-kiwi-700' : 'bg-kiwi-700 text-white'
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
                {stepIndex >= 2 ? t('wdrvwork.active.pickupDone') : t('wdrvwork.active.pickupGo')}
              </p>
              <p className="text-base font-semibold text-surface-800 dark:text-surface-100">
                {order.merchant?.businessName || t('wdrvwork.active.commerceFallback')}
              </p>
              <button
                onClick={() => copyAddress('pickup', order.pickupAddress)}
                className="group mt-0.5 flex items-start gap-1 text-left text-sm text-surface-500"
              >
                <span className="min-w-0 flex-1 break-words">{order.pickupAddress}</span>
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
                <Navigation className="h-4 w-4" /> {t('wdrvwork.active.viewOnMap')}
              </TapButton>
              {merchantPhone && (
                <a
                  href={`tel:${merchantPhone.replace(/\s/g, '')}`}
                  className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark text-sm font-semibold text-surface-700 dark:text-surface-200"
                >
                  <Phone className="h-4 w-4 text-kiwi-500" /> {t('wdrvwork.active.callCommerce')}
                </a>
              )}
              <button
                onClick={() =>
                  openMaps(
                    order.pickupLat ? Number(order.pickupLat) : null,
                    order.pickupLng ? Number(order.pickupLng) : null,
                    order.pickupAddress,
                  )
                }
                className="mt-2 w-full text-center text-xs text-surface-500 dark:text-surface-400 underline-offset-2 hover:underline"
              >
                {t('wdrvwork.active.openGmaps')}
              </button>
            </div>
          </div>

          {/* Mandado: qué comprar + factura */}
          {(order as any).isMandado && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <motion.div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-400/10 dark:text-orange-300">
                  <ShoppingBag className="h-5 w-5" aria-hidden />
                </motion.div>
              </div>
              <div className="min-w-0 flex-1 rounded-2xl border border-orange-500/30 dark:border-orange-400/20 bg-orange-50/60 dark:bg-orange-400/[0.06] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                  {t('wdrvwork.active.mandaTitle')}
                </p>
                <p className="mt-1 break-words text-base font-semibold text-surface-800 dark:text-surface-100">
                  {t('wdrvwork.active.mandaStore')}:{' '}
                  {String((order as any).purchaseStore ?? order.pickupAddress)}
                </p>
                {(order as any).packageDescription && (
                  <p className="mt-1 break-words text-sm text-surface-600 dark:text-surface-300">
                    {t('wdrvwork.active.mandaList')}:{' '}
                    {String((order as any).packageDescription).replace(/^Mandado en [^:]+:\s*/, '')}
                  </p>
                )}
                <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                  {t('wdrvwork.active.mandaEstimate')}: ₡
                  {Number(
                    (order as any).receiptAmount ?? (order as any).purchaseEstimate ?? 0,
                  ).toLocaleString()}
                  {' · '}
                  {t('wdrvwork.active.mandaBonus')}
                </p>
                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={receiptInput}
                      onChange={(e) => setReceiptInput(e.target.value.replace(/[^0-9]/g, ''))}
                      inputMode="numeric"
                      placeholder={t('wdrvwork.active.mandaReceiptPh')}
                      aria-label={t('wdrvwork.active.mandaReceipt')}
                      className="min-w-0 flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => void saveReceipt(order.id)}
                      disabled={savingReceipt}
                      className="shrink-0 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {t('wdrvwork.active.mandaReceiptSave')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

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
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
                {order.status === 'in_transit_to_delivery'
                  ? t('wdrvwork.active.deliverGo')
                  : t('wdrvwork.active.deliverAt')}
              </p>
              <p className="break-words text-base font-semibold text-surface-800 dark:text-surface-100">
                {order.deliveryAddress}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-surface-500">
                {zoneLabel ? (
                  <span className="rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 px-2.5 py-0.5 font-medium text-kiwi-700 dark:text-kiwi-300">
                    <MapPin className="h-3 w-3 inline" /> {zoneLabel}
                  </span>
                ) : null}
                {distanceKm > 0 && <span>{distanceKm} km</span>}
              </div>
              <button
                onClick={() => copyAddress('delivery', order.deliveryAddress)}
                className="mt-1 flex items-center gap-1 text-xs text-surface-500 dark:text-surface-400"
              >
                {copied === 'delivery' ? (
                  <span className="flex items-center gap-1 text-kiwi-700">
                    <Check className="h-3 w-3" /> {t('wdrvwork.active.copied')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Copy className="h-3 w-3" /> {t('wdrvwork.active.copyAddress')}
                  </span>
                )}
              </button>
              <TapButton
                variant="gradient"
                haptic
                className="mt-3 h-11 w-full rounded-xl text-sm"
                onClick={scrollToMap}
              >
                <Navigation className="h-4 w-4" /> {t('wdrvwork.active.navigateInApp')}
              </TapButton>
              <button
                onClick={() =>
                  openMaps(
                    order.deliveryLat ? Number(order.deliveryLat) : null,
                    order.deliveryLng ? Number(order.deliveryLng) : null,
                    order.deliveryAddress,
                  )
                }
                className="mt-2 w-full text-center text-xs text-surface-500 dark:text-surface-400 underline-offset-2 hover:underline"
              >
                {t('wdrvwork.active.openGmaps')}
              </button>
            </div>
          </div>
        </div>
        {/* Contacto cliente */}
        {customer.phone && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
              {t('wdrvwork.active.customerContact')}
              {customer.name ? ` · ${customer.name}` : ''}
            </p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-3"
            >
              <a
                href={`tel:${customer.phone.replace(/\s/g, '')}`}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark text-sm font-semibold text-surface-700 dark:text-surface-200"
              >
                <Phone className="h-4 w-4 text-kiwi-500" /> {t('wdrvwork.active.call')}
              </a>
              <a
                href={toWaLink(customer.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark text-sm font-semibold text-surface-700 dark:text-surface-200"
              >
                <MessageCircle className="h-4 w-4 text-kiwi-500" /> WhatsApp
              </a>
            </motion.div>
          </div>
        )}
        {/* Chat del pedido (comercio + cliente con cuenta) */}
        <div className="mb-4">
          <OrderChat orderId={order.id} />
        </div>
        {/* Paquete / flete */}
        {order.kind === 'freight' && (
          <div className="mb-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-surface-800 dark:text-surface-200">
              <Package className="h-4 w-4 text-kiwi-500" />
              {order.packageDescription || t('wdrvwork.active.parcelFallback')}
            </p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-surface-500">
              {order.weightKg != null && (
                <span className="flex items-center gap-1">
                  <Weight className="h-3 w-3" /> {Number(order.weightKg)} kg
                </span>
              )}
              {order.packageSize && (
                <span>{t('wdrvwork.active.sizeLabel', { size: order.packageSize })}</span>
              )}
            </div>
          </div>
        )}
        {/* Qué llevar (colapsable) */}
        {Array.isArray((order as any).items) && (order as any).items.length > 0 && (
          <div className="mb-4 overflow-hidden rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark">
            <button
              onClick={() => setShowItems((v) => !v)}
              className="flex w-full items-center justify-between p-4 text-sm font-semibold text-surface-700 dark:text-surface-200"
            >
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-kiwi-500" />
                {t('wdrvwork.active.itemsTitle', {
                  count: (order as any).items.reduce(
                    (s: number, it: any) => s + Number(it.quantity || 0),
                    0,
                  ),
                })}
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
              <Flag className="h-3 w-3" /> {t('wdrvwork.active.notesTitle')}
            </p>
            <p className="text-sm text-surface-700 dark:text-surface-200">{notes}</p>
          </div>
        )}
        {/* Evidencia 1+1: foto del comercio al recoger, foto tuya al entregar */}
        <div className="mb-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4">
          <p className="mb-2 text-sm font-semibold text-surface-800 dark:text-surface-100">
            {t('wdrvwork.active.evidenceTitle')}
          </p>
          {(order as any).pickupProofPhotoUrl ? (
            <div className="mb-3">
              <p className="text-xs font-medium text-kiwi-700 dark:text-kiwi-300">
                {t('wdrvwork.active.pickupPhotoDone')}
              </p>
              <img
                src={(order as any).pickupProofPhotoUrl}
                alt={t('wdrvwork.active.pickupPhotoAlt')}
                className="mt-1.5 rounded-xl w-full object-cover"
              />
            </div>
          ) : (
            <p className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {t('wdrvwork.active.pickupPhotoMissing')}
            </p>
          )}
          {(order.status === 'picked_up' ||
            order.status === 'in_transit_to_delivery' ||
            order.status === 'delivered') && (
            <div>
              {(order as any).deliveryProofPhotoUrl ? (
                <div>
                  <p className="text-xs font-medium text-kiwi-700 dark:text-kiwi-300">
                    {t('wdrvwork.active.deliveryPhotoDone')}
                  </p>
                  <img
                    src={(order as any).deliveryProofPhotoUrl}
                    alt={t('wdrvwork.active.deliveryPhotoAlt')}
                    className="mt-1.5 rounded-xl w-full object-cover"
                  />
                </div>
              ) : (
                <div>
                  <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-kiwi-700 px-4 py-3 text-sm font-bold text-white">
                    {uploadingPhoto
                      ? t('wdrvwork.active.uploading')
                      : t('wdrvwork.active.takePhoto')}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                      capture="environment"
                      className="hidden"
                      disabled={uploadingPhoto}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        void uploadDeliveryPhoto(order, file);
                      }}
                    />
                  </label>
                  {/* Fallback: en algunos Android el intent de cámara con
                      capture no abre nada. La galería siempre funciona. */}
                  <label className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-2.5 text-sm font-semibold text-surface-600 dark:text-surface-300">
                    {uploadingPhoto
                      ? t('wdrvwork.active.uploading')
                      : t('wdrvwork.active.chooseGallery')}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                      className="hidden"
                      disabled={uploadingPhoto}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        void uploadDeliveryPhoto(order, file);
                      }}
                    />
                  </label>
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                    {t('wdrvwork.active.photoRequired')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Rechazar: solo asignado sin recoger. Vuelve a concurso y avisa
            al comercio para que reasigne. Doble toque para confirmar. */}
        {order.status === 'assigned' && (
          <div className="mb-4 text-center">
            <button
              onClick={rejectOrder}
              disabled={rejecting}
              className="text-xs font-medium text-surface-500 dark:text-surface-400 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {rejecting
                ? t('wdrvwork.active.rejecting')
                : rejectArmed
                  ? t('wdrvwork.active.rejectConfirmReturn')
                  : t('wdrvwork.active.cantDo')}
            </button>
          </div>
        )}
      </main>

      {/* Barra de acción fija: no se muestra en pending_acceptance (ahí mandan Aceptar/Rechazar) */}
      {order.status !== 'pending_acceptance' && (
        <div className="fixed inset-x-0 bottom-0 z-40 pb-safe">
          <div className="mx-auto max-w-lg px-4 pb-4">
            <motion.div
              layout
              className="rounded-3xl glass-strong p-2.5 shadow-kiwi-lg flex items-center gap-3"
            >
              <div className="pl-2">
                <p className="font-mono text-lg font-bold text-kiwi-700">
                  ₡{driverPayout.toLocaleString()}{' '}
                  <span className="font-sans text-[10px] font-medium text-surface-500 dark:text-surface-400">
                    {t('wdrvwork.active.netSuffix', { pct: feePct })}
                  </span>
                </p>
              </div>
              <div className="flex-1">
                {pendingStatus ? (
                  <button
                    disabled
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-surface-200 dark:bg-surface-700 font-semibold text-surface-600 dark:text-surface-300"
                  >
                    <CloudUpload className="h-5 w-5 animate-pulse" />
                    <span className="text-sm">{t('wdrvwork.active.syncingBtn')}</span>
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
                        t('wdrvwork.active.confirmTap')
                      ) : (
                        t(`wdrvwork.active.${flow.labelKey}`)
                      )}
                    </TapButton>
                  )
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}

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
                {t('wdrvwork.active.deliveredTitle')}
              </h2>
              <p className="mt-1 text-sm text-surface-500">{t('wdrvwork.active.youWon')}</p>
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
                  {t('wdrvwork.active.moreOrders')}
                </TapButton>
                <button
                  onClick={() => setCelebration(null)}
                  className="h-11 w-full rounded-2xl text-sm font-medium text-surface-500"
                >
                  {t('wdrvwork.active.stayHere')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sin BottomNav: la barra de acción fija ocupa el borde inferior. */}
    </main>
  );
}
