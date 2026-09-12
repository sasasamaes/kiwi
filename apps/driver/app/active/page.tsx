'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Home,
  Star,
  Map,
  Phone,
  PartyPopper,
  Package,
  Loader2,
  RefreshCw,
  Weight,
  ClipboardList,
  CloudOff,
  CloudUpload,
} from 'lucide-react';
import {
  useAuth,
  useSocket,
  api,
  Order,
  offlineCache,
  backgroundSync,
  type SyncAction,
} from '@kiwi/ui';

// Estados considerados "activos" para el repartidor
const ACTIVE_STATUSES = [
  'assigned',
  'in_transit_to_pickup',
  'picked_up',
  'in_transit_to_delivery',
] as const;

const STATUS_STEP: Record<string, 1 | 2 | 3> = {
  assigned: 1,
  in_transit_to_pickup: 1,
  picked_up: 2,
  in_transit_to_delivery: 2,
};

const NEXT_STATUS: Record<string, { next: string; label: string }> = {
  assigned: { next: 'in_transit_to_pickup', label: 'Voy a recoger' },
  in_transit_to_pickup: { next: 'picked_up', label: 'Recogí el pedido' },
  picked_up: { next: 'in_transit_to_delivery', label: 'Voy a entregar' },
  in_transit_to_delivery: { next: 'delivered', label: 'Entregué el pedido' },
};

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Asignado',
  in_transit_to_pickup: 'En camino a recoger',
  picked_up: 'Recogido',
  in_transit_to_delivery: 'Entregando',
};

function openMaps(lat?: number | string | null, lng?: number | string | null, address?: string) {
  const coords =
    lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? `${lat},${lng}`
      : null;
  const dest = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || '')}`;
  window.open(dest, '_blank');
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
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  // Offline: pedidos vistos desde caché, acciones esperando sync
  const [fromCache, setFromCache] = useState(false);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  // orderId -> estado al que se quiere avanzar mientras está encolado
  const [queuedTransitions, setQueuedTransitions] = useState<Record<string, string>>({});
  const queuedTransitionsRef = useRef(queuedTransitions);
  queuedTransitionsRef.current = queuedTransitions;

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
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
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

  // Aplica la transición localmente (UI optimista) y marca el pedido como encolado
  const applyOptimistic = (orderId: string, nextStatus: string) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
    setQueuedTransitions((prev) => ({ ...prev, [orderId]: nextStatus }));
  };

  const advanceStatus = async (order: Order) => {
    const flow = NEXT_STATUS[order.status];
    if (!flow || updating) return;

    // ¿Ya hay una transición encolada para este pedido? No duplicar.
    if (queuedTransitionsRef.current[order.id]) return;

    setUpdating(true);
    try {
      await api.updateOrderStatus(order.id, flow.next);
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
        <Loader2 className="h-8 w-8 animate-spin text-kiwi-500" />
      </main>
    );
  }

  if (error && orders.length === 0) {
    return (
      <main className="min-h-[100dvh] flex flex-col">
        <header className="sticky top-0 z-50 glass-strong">
          <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-surface-600">
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Pedido Activo</h1>
            <div className="w-16" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-5xl mb-4">😕</div>
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
        <header className="sticky top-0 z-50 glass-strong">
          <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-surface-600">
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Pedido Activo</h1>
            <div className="w-16" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-6xl mb-4">📭</div>
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
      </main>
    );
  }

  const order = orders.find((o) => o.id === selectedId) ?? orders[0];
  const step = STATUS_STEP[order.status] ?? 1;
  const flow = NEXT_STATUS[order.status];
  const isDelivered = false; // los entregados no aparecen en activos
  const driverPayout = Number(order.driverPayout ?? order.totalAmount ?? 0);
  const distanceKm = Number(order.distanceKm ?? 0);
  // Transición encolada esperando sync para el pedido mostrado
  const pendingStatus = queuedTransitions[order.id];
  const showOfflineBanner = !online || fromCache;

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-surface-600">
            <span>←</span>
            <span className="text-sm font-medium">Volver</span>
          </Link>
          <h1 className="font-display font-semibold text-surface-800">Pedido Activo</h1>
          <button
            onClick={fetchActiveOrders}
            className="w-16 flex justify-end text-surface-500"
            aria-label="Refrescar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        {notice && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-3">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{notice}</p>
            <button onClick={() => setNotice(null)} className="text-amber-600 dark:text-amber-400">
              ✕
            </button>
          </div>
        )}
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

        {/* Selector cuando hay varios activos */}
        {orders.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedId(o.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  o.id === order.id
                    ? 'bg-kiwi-500 text-white'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                }`}
              >
                #{o.id.slice(0, 6)} · {STATUS_LABEL[o.status] ?? o.status}
                {queuedTransitions[o.id] ? ' ⏳' : ''}
              </button>
            ))}
          </div>
        )}

        {/* Status Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div
              className={`flex items-center gap-2 ${step >= 1 ? 'text-kiwi-600' : 'text-surface-400'}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  step >= 1 ? 'bg-kiwi-500 text-white' : 'bg-surface-200 dark:bg-surface-700'
                }`}
              >
                1
              </span>
              <span className="text-sm font-medium">Recoger</span>
            </div>
            <div className="flex-1 mx-2 h-1 bg-surface-200 dark:bg-surface-700 rounded">
              <div
                className={`h-1 bg-kiwi-500 rounded transition-all ${step >= 2 ? 'w-full' : 'w-0'}`}
              />
            </div>
            <div
              className={`flex items-center gap-2 ${step >= 2 ? 'text-kiwi-600' : 'text-surface-400'}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  step >= 2 ? 'bg-kiwi-500 text-white' : 'bg-surface-200 dark:bg-surface-700'
                }`}
              >
                2
              </span>
              <span className="text-sm font-medium">Entregar</span>
            </div>
            <div className="flex-1 mx-2 h-1 bg-surface-200 dark:bg-surface-700 rounded">
              <div
                className={`h-1 bg-kiwi-500 rounded transition-all ${step >= 3 ? 'w-full' : 'w-0'}`}
              />
            </div>
            <div
              className={`flex items-center gap-2 ${step >= 3 ? 'text-kiwi-600' : 'text-surface-400'}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  step >= 3 ? 'bg-kiwi-500 text-white' : 'bg-surface-200 dark:bg-surface-700'
                }`}
              >
                3
              </span>
              <span className="text-sm font-medium">Listo</span>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="mb-6 rounded-2xl glass p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 px-3 py-1 text-xs font-medium text-kiwi-700 dark:text-kiwi-300">
              #{order.id.slice(0, 8)} · {STATUS_LABEL[order.status] ?? order.status}
            </span>
            <span className="text-lg font-bold text-surface-800 dark:text-surface-100">
              ₡{driverPayout.toLocaleString()}
            </span>
          </div>

          {/* Package info para fletes */}
          {order.kind === 'freight' && (
            <div className="mb-4 rounded-xl bg-surface-50 dark:bg-surface-800 p-3 space-y-1">
              <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                📦 {order.packageDescription || 'Encomienda'}
              </p>
              {order.weightKg != null && (
                <p className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1">
                  <Weight className="h-3 w-3" /> {Number(order.weightKg)} kg
                  {Number(order.weightKg) > 5 ? ' (los primeros 5 kg incluidos)' : ''}
                </p>
              )}
              {order.packageSize && (
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Tamaño: {order.packageSize}
                </p>
              )}
            </div>
          )}

          {/* Pickup Location */}
          <div className="mb-4 rounded-xl glass p-4">
            <div className="mb-2 flex items-center gap-2">
              <MapPin className="text-lg h-5 w-5" />
              <span className="text-sm font-semibold text-kiwi-700 dark:text-kiwi-400">
                {order.status === 'picked_up' || order.status === 'in_transit_to_delivery'
                  ? 'Recogido'
                  : 'Ir a recoger'}
              </span>
            </div>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
              {order.merchant?.businessName || 'Comercio'}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">{order.pickupAddress}</p>
            <button
              onClick={() =>
                openMaps(
                  order.pickupLat ? Number(order.pickupLat) : null,
                  order.pickupLng ? Number(order.pickupLng) : null,
                  order.pickupAddress,
                )
              }
              className="mt-3 w-full rounded-xl bg-kiwi-500 py-2.5 text-sm font-medium text-white shadow-kiwi hover:bg-kiwi-600 transition-colors"
            >
              <Map className="h-4 w-4 inline" /> Abrir en Maps
            </button>
          </div>

          {/* Delivery Location */}
          <div className="rounded-xl glass p-4">
            <div className="mb-2 flex items-center gap-2">
              <Home className="text-lg h-5 w-5" />
              <span className="text-sm font-semibold text-kiwi-700 dark:text-kiwi-400">
                {order.status === 'in_transit_to_delivery' ? 'Ir a entregar' : 'Entrega'}
              </span>
            </div>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
              {order.deliveryAddress}
            </p>
            {distanceKm > 0 && (
              <p className="text-xs text-surface-500 dark:text-surface-400">{distanceKm} km</p>
            )}
            <button
              onClick={() =>
                openMaps(
                  order.deliveryLat ? Number(order.deliveryLat) : null,
                  order.deliveryLng ? Number(order.deliveryLng) : null,
                  order.deliveryAddress,
                )
              }
              className="mt-3 w-full rounded-xl bg-surface-800 dark:bg-surface-700 py-2.5 text-sm font-medium text-white hover:bg-surface-700 dark:hover:bg-surface-600 transition-colors"
            >
              <Map className="h-4 w-4 inline" /> Abrir en Maps
            </button>
          </div>

          {/* Instrucciones */}
          {order.specialInstructions && (
            <div className="mt-4 rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
              <p className="text-xs font-medium text-surface-600 dark:text-surface-300 mb-1">
                📝 Instrucciones
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {order.specialInstructions}
              </p>
            </div>
          )}

          {/* Contenido del pedido */}
          {Array.isArray((order as any).items) && (order as any).items.length > 0 && (
            <div className="mt-4 rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
              <p className="text-xs font-medium text-surface-600 dark:text-surface-300 mb-2">
                🛍️ Qué llevar
              </p>
              <div className="space-y-1.5">
                {(order as any).items.map((it: any, i: number) => (
                  <div key={it.id ?? i} className="flex justify-between text-xs">
                    <span className="text-surface-700 dark:text-surface-200">
                      {it.quantity}x {it.name}
                      {Array.isArray(it.selectedVariants) && it.selectedVariants.length > 0 && (
                        <span className="text-surface-500">
                          {' '}
                          ({it.selectedVariants.map((v: any) => v.option).join(', ')})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {pendingStatus ? (
            // Cambio encolado: bloquear avance hasta confirmar sync
            <button
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-surface-200 dark:bg-surface-700 py-4 text-lg font-semibold text-surface-600 dark:text-surface-300"
            >
              <CloudUpload className="h-5 w-5 animate-pulse" /> Esperando sincronización…
            </button>
          ) : (
            flow && (
              <button
                onClick={() => advanceStatus(order)}
                disabled={updating}
                className="w-full rounded-2xl bg-kiwi-gradient py-4 text-lg font-semibold text-white shadow-kiwi-lg hover:shadow-kiwi-xl transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {updating ? <Loader2 className="h-5 w-5 inline animate-spin" /> : flow.label}
              </button>
            )
          )}

          {isDelivered && (
            <Link
              href="/"
              className="block w-full rounded-2xl bg-kiwi-gradient py-4 text-center text-lg font-semibold text-white shadow-kiwi-lg"
            >
              <PartyPopper className="h-5 w-5 inline" /> ¡Pedido completado!
            </Link>
          )}
        </div>
      </main>
    </main>
  );
}
