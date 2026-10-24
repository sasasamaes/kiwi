// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Search,
  Bike,
  Phone,
  MapPin,
  Store,
  ChevronDown,
  RefreshCw,
  Check,
  Clock,
} from 'lucide-react';
import {
  api,
  useAuth,
  useSocket,
  type Order,
  ShareTrackingButton,
  ScrollReveal,
  useTranslations,
  downscalePhoto,
} from '@kiwi/ui';
import { MerchantNav } from '../../components/MerchantNav';

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  driver_proposals: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pending_acceptance: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  in_transit_to_pickup: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  picked_up: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  in_transit_to_delivery:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  no_driver: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const ACTIVE = new Set([
  'pending',
  'driver_proposals',
  'assigned',
  'pending_acceptance',
  'in_transit_to_pickup',
  'picked_up',
  'in_transit_to_delivery',
  'no_driver',
]);

export default function OrdersPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const { user, loading: authLoading } = useAuth();

  const STATUS_LABEL: Record<string, string> = {
    pending: t('webshop1.orders.statusPending'),
    driver_proposals: t('webshop1.orders.statusProposals'),
    assigned: t('webshop1.orders.statusAssigned'),
    pending_acceptance: t('webshop1.orders.statusWaiting'),
    in_transit_to_pickup: t('webshop1.orders.statusToPickup'),
    picked_up: t('webshop1.orders.statusPickedUp'),
    in_transit_to_delivery: t('webshop1.orders.statusDelivering'),
    delivered: t('webshop1.orders.statusDelivered'),
    cancelled: t('webshop1.orders.statusCancelled'),
    no_driver: t('webshop1.orders.statusNoDriver'),
  };

  const TABS = [
    { id: 'active', label: t('webshop1.orders.tabActive') },
    { id: 'all', label: t('webshop1.orders.tabAll') },
    { id: 'delivered', label: t('webshop1.orders.tabDelivered') },
    { id: 'cancelled', label: t('webshop1.orders.tabCancelled') },
  ] as const;

  const timelineOf = (o: any) => {
    if (o.status === 'cancelled') {
      return [
        { label: t('webshop1.orders.timelineCreated'), at: o.createdAt, done: true },
        {
          label: t('webshop1.orders.timelineCancelled'),
          at: o.updatedAt ?? o.createdAt,
          done: true,
        },
      ];
    }
    return [
      { label: t('webshop1.orders.timelineCreated'), at: o.createdAt, done: true },
      {
        label: o.driver?.fullName
          ? t('webshop1.orders.timelineAcceptedWith', { name: o.driver.fullName })
          : t('webshop1.orders.timelineAccepted'),
        at: o.assignedAt,
        done: !!o.assignedAt,
      },
      { label: t('webshop1.orders.timelinePickedUp'), at: o.pickedUpAt, done: !!o.pickedUpAt },
      { label: t('webshop1.orders.timelineDelivered'), at: o.deliveredAt, done: !!o.deliveredAt },
    ];
  };

  /**
   * Nombre del cliente: campo estructurado (pedidos nuevos) o parseado de
   * `specialInstructions` ("Cliente: Nombre (teléfono) · notas") para el
   * historial viejo que se creó sin customerName.
   */
  const getClientInfo = (o: any): { name: string | null; phone: string | null } => {
    const rawName = typeof o?.customerName === 'string' ? o.customerName.trim() : '';
    const rawPhone = typeof o?.customerPhone === 'string' ? o.customerPhone.trim() : '';
    if (rawName) return { name: rawName, phone: rawPhone || null };
    const instructions = typeof o?.specialInstructions === 'string' ? o.specialInstructions : '';
    const m = instructions.match(/Cliente:\s*([^(()·]+?)\s*(?:\(([^)]+)\))?\s*(?:·|$)/i);
    if (m) {
      const name = (m[1] ?? '').trim();
      const phone = (m[2] ?? '').trim();
      if (name) return { name, phone: phone || rawPhone || null };
    }
    if (rawPhone) return { name: null, phone: rawPhone };
    return { name: null, phone: null };
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('active');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  // Aviso de rechazo: el asignado devolvió el pedido, hay que reasignar.
  const [rejected, setRejected] = useState<{ orderId: string; driverName?: string } | null>(null);
  // Subida de evidencia: orderId que está subiendo su foto pickup.
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  // Error de foto junto al botón (el global queda arriba del listado y en el
  // celular no se ve). Se limpia al reintentar o al lograr la subida.
  const [photoError, setPhotoError] = useState<{ orderId: string; message: string } | null>(null);
  // Config del servidor (Cloudinary): null = aún cargando o sin permiso.
  const [uploadEnabled, setUploadEnabled] = useState<boolean | null>(null);
  // Reintento/cancelación de pedidos sin repartidor.
  const [actingId, setActingId] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOrders = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setError(null);
        const data = await api.getMyOrders();
        setOrders(Array.isArray(data) ? data : []);
      } catch {
        if (!silent) setError(t('webshop1.orders.loadFailed'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user, fetchOrders]);

  // Estado de la subida: si el servidor no la tiene configurada se avisa
  // ANTES de intentar subir (el 503 tardío era el banner rojo confuso).
  useEffect(() => {
    if (!user) return;
    api
      .getImageUploadStatus()
      .then((r) => setUploadEnabled(r?.enabled === true))
      .catch(() => setUploadEnabled(null));
  }, [user]);

  // Destello de la fila actualizada (con ref para limpiarlo al desmontar).
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  // Tiempo real: cualquier cambio del pedido refresca la lista y destella la fila
  const scheduleRefresh = useCallback(
    (orderId?: string) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (orderId) {
        setFlashId(orderId);
        flashTimer.current = setTimeout(() => setFlashId(null), 4000);
      }
      refreshTimer.current = setTimeout(() => fetchOrders(true), 800);
    },
    [fetchOrders],
  );

  const { isConnected, on: onSocket } = useSocket({
    onOrderAccepted: (d) => scheduleRefresh(d?.orderId),
    onOrderStatusChanged: (d) => scheduleRefresh(d?.orderId),
  });

  useEffect(() => {
    const offs = [
      onSocket('order:driverAssigned', (d: any) => scheduleRefresh(d?.orderId)),
      onSocket('order:proposalReceived', (d: any) => scheduleRefresh(d?.orderId)),
      onSocket('order:rejected', (d: any) => {
        scheduleRefresh(d?.orderId);
        if (d?.orderId) {
          setRejected({ orderId: d.orderId, driverName: d?.driverName });
        }
      }),
      // Concurso y sin-repartidor: antes solo llegaban con refresh manual.
      onSocket('order:contestStarted', (d: any) => scheduleRefresh(d?.orderId)),
      onSocket('order:noDriver', (d: any) => scheduleRefresh(d?.orderId)),
    ];
    return () => offs.forEach((off) => off());
  }, [onSocket, scheduleRefresh]);

  // Evidencia pickup: el comercio fotografía el pedido al entregarlo al
  // repartidor. Sin foto el repartidor no puede marcarlo como recogido.
  // La foto se comprime en el navegador: la cámara del celular entrega
  // 3–12 MB y eso en datos móviles no termina nunca (o pega el tope de
  // 5 MB del backend sin que se entienda por qué).
  const uploadPickupPhoto = async (orderId: string, file: File) => {
    setUploadingId(orderId);
    setPhotoError(null);
    let small = file;
    try {
      small = await downscalePhoto(file);
    } catch {
      small = file;
    }
    if (small.size > 5 * 1024 * 1024) {
      setUploadingId(null);
      setPhotoError({ orderId, message: t('webshop1.orders.photoTooBig') });
      return;
    }
    if (
      small.type &&
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(
        small.type,
      )
    ) {
      setUploadingId(null);
      setPhotoError({ orderId, message: t('webshop1.orders.photoFormat') });
      return;
    }
    try {
      await api.uploadOrderProofPhoto(orderId, 'pickup', small);
      await fetchOrders(true);
    } catch (e) {
      setPhotoError({
        orderId,
        message: e instanceof Error ? e.message : t('webshop1.orders.photoFailed'),
      });
    } finally {
      setUploadingId(null);
    }
  };

  // Sin repartidor: el concurso venció y el pedido quedó en no_driver. Sin
  // estos botones el pedido quedaba bricked (no había transición de salida).
  const retryOrder = async (orderId: string) => {
    setActingId(orderId);
    try {
      setError(null);
      await api.updateOrderStatus(orderId, 'pending');
      await fetchOrders(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('webshop1.orders.retryFailed'));
    } finally {
      setActingId(null);
    }
  };

  const cancelOrder = async (orderId: string) => {
    setActingId(orderId);
    try {
      setError(null);
      await api.updateOrderStatus(orderId, 'cancelled');
      await fetchOrders(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('webshop1.orders.cancelFailed'));
    } finally {
      setActingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <MerchantNav />
        <main className="mx-auto max-w-3xl space-y-3 p-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
            />
          ))}
        </main>
      </>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = orders.filter((o) => {
    if (tab === 'active' && !ACTIVE.has(o.status)) return false;
    if (tab === 'delivered' && o.status !== 'delivered') return false;
    if (tab === 'cancelled' && o.status !== 'cancelled') return false;
    if (!q) return true;
    const client = getClientInfo(o);
    return (
      o.id.toLowerCase().includes(q) ||
      (client.name ?? '').toLowerCase().includes(q) ||
      (client.phone ?? '').toLowerCase().includes(q) ||
      (o.deliveryAddress ?? '').toLowerCase().includes(q) ||
      (o.driver?.fullName ?? '').toLowerCase().includes(q)
    );
  });
  const activeCount = orders.filter((o) => ACTIVE.has(o.status)).length;

  return (
    <>
      <MerchantNav />
      <main className="mx-auto max-w-3xl p-6 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t('webshop1.orders.title')}</h1>
            <p className="flex items-center gap-1.5 text-xs text-surface-500">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? 'bg-kiwi-500' : 'bg-surface-300'}`}
              />
              {isConnected ? t('webshop1.orders.live') : t('webshop1.orders.reconnecting')}
              {activeCount > 0 && t('webshop1.orders.activeCount', { count: activeCount })}
            </p>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchOrders();
            }}
            aria-label={t('webshop1.orders.refreshAria')}
            className="rounded-xl p-2.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {uploadEnabled === false && (
          <p className="mt-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            {t('webshop1.orders.uploadDisabled')}
          </p>
        )}

        {rejected && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {rejected.driverName
                  ? t('webshop1.orders.rejectedWithName', { name: rejected.driverName })
                  : t('webshop1.orders.rejectedGeneric')}{' '}
                {t('webshop1.orders.rejectedOrderSuffix', {
                  id: rejected.orderId.slice(0, 8).toUpperCase(),
                })}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t('webshop1.orders.rejectedHint')}
              </p>
            </div>
            <Link
              href="/drivers"
              className="shrink-0 rounded-xl bg-kiwi-700 px-4 py-2 text-sm font-semibold text-white"
            >
              {t('webshop1.orders.reassign')}
            </Link>
            <button
              onClick={() => setRejected(null)}
              aria-label={t('webshop1.orders.dismissAria')}
              className="shrink-0 rounded-xl p-2 text-amber-600 dark:text-amber-400"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <Link
            href="/orders/share"
            className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-900/40 dark:text-kiwi-300"
          >
            {t('webshop1.orders.shareLinkCta')}
          </Link>
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tab === tabItem.id
                  ? 'bg-kiwi-700 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500 dark:text-surface-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('webshop1.orders.searchPlaceholder')}
            className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 pl-10 pr-4 py-2.5 text-sm"
          />
        </div>

        {filtered.length === 0 && (
          <div className="mt-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-8 text-center">
            <Package className="mx-auto mb-2 h-10 w-10 text-surface-300" />
            <p className="text-sm text-surface-500">
              {tab === 'active' ? t('webshop1.orders.emptyActive') : t('webshop1.orders.emptyNone')}
            </p>
            <Link
              href="/orders/new"
              className="mt-4 inline-block rounded-xl bg-kiwi-700 px-5 py-2.5 text-sm font-bold text-white"
            >
              {t('webshop1.orders.createCta')}
            </Link>
          </div>
        )}

        <ul className="mt-4 space-y-3">
          {filtered.map((order: any, i) => {
            const open = expanded === order.id;
            const driverPhone = order.driver?.user?.phone;
            const client = getClientInfo(order);
            const clientName = client.name ?? t('webshop1.orders.unnamedClient');
            return (
              <ScrollReveal key={order.id} index={Math.min(i, 6)} as="li">
                <motion.div
                  animate={flashId === order.id ? { scale: [1, 1.015, 1] } : {}}
                  className={`overflow-hidden rounded-2xl border bg-white dark:bg-surface-900 transition-colors ${
                    flashId === order.id
                      ? 'border-kiwi-400'
                      : 'border-surface-100 dark:border-surface-800'
                  }`}
                >
                  <button
                    onClick={() => setExpanded(open ? null : order.id)}
                    aria-expanded={open}
                    aria-label={t('webshop1.orders.detailAria', { name: clientName })}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{clientName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[order.status] ?? 'bg-surface-100 text-surface-500'}`}
                      >
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                      <motion.span animate={{ rotate: open ? 180 : 0 }}>
                        <ChevronDown className="h-4 w-4 text-surface-500 dark:text-surface-400" />
                      </motion.span>
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4 border-t border-surface-100 dark:border-surface-800 p-4">
                          {/* Cliente */}
                          <div className="flex items-center justify-between rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                            <div className="min-w-0">
                              <p className="text-xs text-surface-500 dark:text-surface-400">
                                {t('webshop1.orders.clientLabel')}
                              </p>
                              <p className="truncate text-sm font-semibold">{clientName}</p>
                              {client.phone && (
                                <p className="text-xs text-surface-500">{client.phone}</p>
                              )}
                            </div>
                            {client.phone && (
                              <a
                                href={`tel:${client.phone}`}
                                className="flex shrink-0 items-center gap-1 rounded-lg bg-kiwi-700 px-3 py-1.5 text-xs font-bold text-white"
                              >
                                <Phone className="h-3.5 w-3.5" /> {t('webshop1.orders.call')}
                              </a>
                            )}
                          </div>
                          <p className="font-mono text-xs text-surface-500 dark:text-surface-400">
                            {t('webshop1.orders.orderNumber', {
                              id: order.id.slice(-4).toUpperCase(),
                            })}
                          </p>
                          {/* Timeline */}
                          <ol className="space-y-0">
                            {timelineOf(order).map((s, j) => (
                              <li key={j} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <span
                                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                      s.done
                                        ? 'bg-kiwi-700 text-white'
                                        : 'bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400'
                                    }`}
                                  >
                                    {s.done ? (
                                      <Check className="h-3.5 w-3.5" />
                                    ) : (
                                      <Clock className="h-3.5 w-3.5" />
                                    )}
                                  </span>
                                  {j < timelineOf(order).length - 1 && (
                                    <span className="my-0.5 w-0.5 flex-1 bg-surface-200 dark:bg-surface-700" />
                                  )}
                                </div>
                                <div className="pb-4">
                                  <p className="text-sm font-medium">{s.label}</p>
                                  {s.at && (
                                    <p className="text-xs text-surface-500 dark:text-surface-400">
                                      {new Date(s.at).toLocaleString('es-CR', {
                                        timeZone: 'America/Costa_Rica',
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </p>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ol>

                          {/* Repartidor */}
                          {order.driver ? (
                            <div className="flex items-center justify-between rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                              <p className="flex items-center gap-2 text-sm font-medium">
                                {(order.driver as any).photoUrl ? (
                                  // NOTE: <img> intencional — foto dinámica externa
                                  <img
                                    src={(order.driver as any).photoUrl}
                                    alt={order.driver.fullName}
                                    className="h-8 w-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <Bike className="h-4 w-4 text-kiwi-500" />
                                )}
                                {order.driver.fullName}
                                {order.driver.vehicleType ? ` · ${order.driver.vehicleType}` : ''}
                                {(order.driver as any).vehiclePlate
                                  ? ` · ${(order.driver as any).vehiclePlate}`
                                  : ''}
                              </p>
                              {driverPhone && (
                                <a
                                  href={`tel:${driverPhone}`}
                                  className="flex items-center gap-1 rounded-lg bg-kiwi-700 px-3 py-1.5 text-xs font-bold text-white"
                                >
                                  <Phone className="h-3.5 w-3.5" /> {t('webshop1.orders.call')}
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
                              {t('webshop1.orders.waitingDriver')}
                            </p>
                          )}

                          {/* Evidencia pickup: foto al entregar al repartidor */}
                          {(order.status === 'assigned' ||
                            order.status === 'in_transit_to_pickup') && (
                            <div className="rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                              {order.pickupProofPhotoUrl ? (
                                <div>
                                  <p className="text-xs font-semibold text-kiwi-700 dark:text-kiwi-300">
                                    {t('webshop1.orders.photoDone')}
                                  </p>
                                  <img
                                    src={order.pickupProofPhotoUrl}
                                    alt={t('webshop1.orders.photoAlt')}
                                    className="mt-2 rounded-xl w-full object-cover"
                                  />
                                </div>
                              ) : uploadEnabled === false ? (
                                <p className="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                                  {t('webshop1.orders.uploadDisabledShort')}
                                </p>
                              ) : (
                                <div>
                                  <label
                                    className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-kiwi-800 ${uploadingId === order.id ? 'animate-pulse opacity-80' : ''}`}
                                  >
                                    {uploadingId === order.id
                                      ? t('webshop1.orders.uploading')
                                      : t('webshop1.orders.uploadCta')}
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                                      capture="environment"
                                      className="hidden"
                                      disabled={uploadingId === order.id}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        if (!file) return;
                                        void uploadPickupPhoto(order.id, file);
                                      }}
                                    />
                                  </label>
                                  {/* Fallback: en algunos Android el intent de cámara con
                                      capture no abre nada. La galería siempre funciona. */}
                                  <label
                                    className={`mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-2.5 text-sm font-semibold text-surface-600 dark:text-surface-300 ${uploadingId === order.id ? 'opacity-50' : ''}`}
                                  >
                                    {uploadingId === order.id
                                      ? t('webshop1.orders.uploading')
                                      : t('webshop1.orders.chooseGallery')}
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                                      className="hidden"
                                      disabled={uploadingId === order.id}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        if (!file) return;
                                        void uploadPickupPhoto(order.id, file);
                                      }}
                                    />
                                  </label>
                                  {photoError?.orderId === order.id && (
                                    <p
                                      role="alert"
                                      className="mt-1.5 text-xs font-medium text-red-600"
                                    >
                                      {photoError.message}
                                    </p>
                                  )}
                                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                                    {t('webshop1.orders.photoRequired')}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Evidencia histórica: las fotos siguen visibles después
                              de entregado (el bloque de arriba solo existe en
                              assigned/in_transit_to_pickup). */}
                          {(order.pickupProofPhotoUrl || (order as any).deliveryProofPhotoUrl) &&
                            order.status !== 'assigned' &&
                            order.status !== 'in_transit_to_pickup' && (
                              <div className="rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                                <p className="mb-2 text-xs font-semibold text-surface-600 dark:text-surface-300">
                                  {t('webshop1.orders.evidenceTitle')}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {order.pickupProofPhotoUrl && (
                                    <div>
                                      <img
                                        src={order.pickupProofPhotoUrl}
                                        alt={t('webshop1.orders.photoAlt')}
                                        className="rounded-xl w-full object-cover"
                                      />
                                      <p className="mt-1 text-[11px] text-surface-500">
                                        {t('webshop1.orders.evidencePickup')}
                                      </p>
                                    </div>
                                  )}
                                  {(order as any).deliveryProofPhotoUrl && (
                                    <div>
                                      <img
                                        src={(order as any).deliveryProofPhotoUrl}
                                        alt={t('webshop1.orders.deliveryAlt')}
                                        className="rounded-xl w-full object-cover"
                                      />
                                      <p className="mt-1 text-[11px] text-surface-500">
                                        {t('webshop1.orders.evidenceDelivery')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Sin repartidor: reintentar el concurso o cancelar */}
                          {order.status === 'no_driver' && (
                            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
                              <p className="text-xs font-medium text-red-700 dark:text-red-300">
                                {t('webshop1.orders.noDriverHint')}
                              </p>
                              <div className="mt-2 flex gap-2">
                                <button
                                  onClick={() => void retryOrder(order.id)}
                                  disabled={actingId === order.id}
                                  className="flex-1 rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                                >
                                  {actingId === order.id
                                    ? t('webshop1.orders.processing')
                                    : t('webshop1.orders.retry')}
                                </button>
                                <button
                                  onClick={() => void cancelOrder(order.id)}
                                  disabled={actingId === order.id}
                                  className="flex-1 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50"
                                >
                                  {t('webshop1.orders.cancel')}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Duplicados por reintento sin internet: el comercio
                              puede cancelar el/los de más (vale antes de que
                              el repartidor lo recoja). */}
                          {[
                            'pending',
                            'driver_proposals',
                            'pending_acceptance',
                            'assigned',
                          ].includes(order.status) && (
                            <div className="rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                              <p className="text-xs text-surface-500">
                                {t('webshop1.orders.dupHint')}
                              </p>
                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      t('webshop1.orders.confirmCancel', {
                                        name: clientName,
                                        id: order.id.slice(-4).toUpperCase(),
                                      }),
                                    )
                                  ) {
                                    void cancelOrder(order.id);
                                  }
                                }}
                                disabled={actingId === order.id}
                                className="mt-2 w-full rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50"
                              >
                                {actingId === order.id
                                  ? t('webshop1.orders.canceling')
                                  : t('webshop1.orders.cancelThis')}
                              </button>
                            </div>
                          )}

                          {/* Detalle */}
                          <div className="space-y-1 text-xs text-surface-500">
                            <p className="flex items-start gap-1.5">
                              <Store className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {order.pickupAddress}
                            </p>
                            <p className="flex items-start gap-1.5">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {order.deliveryAddress}
                              {(order as any).deliveryZone
                                ? ` · ${(order as any).deliveryZone}`
                                : ''}
                            </p>
                            {Array.isArray(order.items) && order.items.length > 0 && (
                              <p>
                                {t('webshop1.orders.contentsLabel')}{' '}
                                {order.items
                                  .map((it: any) => `${it.quantity}x ${it.name}`)
                                  .join(', ')}
                              </p>
                            )}
                            <p className="font-mono">
                              {t('webshop1.orders.fareLine', {
                                ship: Number(
                                  order.driverPayout ?? order.basePrice ?? 0,
                                ).toLocaleString(),
                                fee: Number(order.commission ?? 0).toLocaleString(),
                                total: Number(order.totalAmount).toLocaleString(),
                              })}
                            </p>
                          </div>

                          <ShareTrackingButton
                            orderId={order.id}
                            label={t('webshop1.orders.shareTracking')}
                            className="w-full !py-2.5 !text-sm"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </ScrollReveal>
            );
          })}
        </ul>
      </main>
    </>
  );
}
