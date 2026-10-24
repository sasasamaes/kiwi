// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Search,
  X,
  MapPin,
  Store,
  Bike,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Navigation,
} from 'lucide-react';
import { api, buildTrackingUrl, useTranslations, useSocket, playNotificationSound } from '@kiwi/ui';
import { useDeliveryZones } from '@kiwi/ui';
import { findDeliveryZone } from '@kiwi/types';

interface AdminOrder {
  id: string;
  status: string;
  orderType: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupLat?: number | string | null;
  pickupLng?: number | string | null;
  deliveryLat?: number | string | null;
  deliveryLng?: number | string | null;
  deliveryZone?: string | null;
  distanceKm?: number | string | null;
  basePrice: number | string;
  commission: number | string;
  commissionRate?: number | string | null;
  driverPayout: number | string;
  totalAmount: number | string;
  productsTotal?: number | string | null;
  cashTendered?: number | string | null;
  payment?: { method?: string | null; status?: string | null } | null;
  createdAt: string;
  assignedAt?: string | null;
  deliveredAt?: string | null;
  merchant?: { businessName?: string | null } | null;
  driver?: { fullName?: string | null } | null;
  items?: Array<{ name: string; quantity: number }>;
  pickupProofPhotoUrl?: string | null;
  deliveryProofPhotoUrl?: string | null;
}

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

const PAGE_SIZE = 20;

// Destino para Maps/Waze: coordenadas cuando hay GPS, dirección escrita si no.
function mapsUrl(lat?: number | string | null, lng?: number | string | null, address?: string) {
  const coords =
    lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? `${lat},${lng}`
      : null;
  return coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || '')}`;
}

function wazeUrl(lat?: number | string | null, lng?: number | string | null, address?: string) {
  const coords =
    lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? `${lat},${lng}`
      : null;
  return coords
    ? `https://waze.com/ul?ll=${coords}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(address || '')}&navigate=yes`;
}

export default function AdminOrders() {
  const { t } = useTranslations();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{
    revenue: number;
    platformFee: number;
    byStatus: Record<string, number>;
  } | null>(null);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [driverId, setDriverId] = useState('');
  const [drivers, setDrivers] = useState<Array<{ id: string; fullName: string }>>([]);
  const [merchants, setMerchants] = useState<Array<{ id: string; businessName: string }>>([]);
  const deliveryZones = useDeliveryZones();
  const [zones, setZones] = useState<any[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({
    merchantId: '',
    driverId: '',
    pickupAddress: '',
    deliveryAddress: '',
    deliveryZone: '',
    basePrice: '',
    status: 'delivered',
    customerName: '',
    customerPhone: '',
    packageDescription: '',
    deliveredAt: '',
  });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [copiedTrack, setCopiedTrack] = useState(false);
  // Reasignación admin: el aceptado no puede hacerlo y se pasa a otro.
  const [reassignTo, setReassignTo] = useState('');
  const [reassigning, setReassigning] = useState(false);
  // Cancelación de duplicados/trabados (ej. chofer con 20 en curso por
  // reintentos sin internet). Solo estados cancelables por transición.
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // Avance manual de pedidos ajenos trabados (el admin salta actores y,
  // si hace falta, la foto — queda auditado en el log del servidor).
  const [advancing, setAdvancing] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  // Hub logístico en vivo: el backend emite order:new y order:statusChanged
  // al rol admin. En primera página sin filtros la lista se actualiza sola;
  // con filtros/paginación se acumula contador + feed con botón Recargar.
  interface LiveEvent {
    key: number;
    kind: 'new' | 'status';
    orderId: string;
    message: string;
    at: number;
  }
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [pendingLive, setPendingLive] = useState(0);
  const liveKey = useRef(0);
  const listCtx = useRef({ page, filter, search, driverId });
  listCtx.current = { page, filter, search, driverId };

  const STATUS_LABEL: Record<string, string> = {
    pending: t('webadmin1.aorders.status.pending'),
    driver_proposals: t('webadmin1.aorders.status.proposals'),
    assigned: t('webadmin1.aorders.status.assigned'),
    pending_acceptance: t('webadmin1.aorders.status.awaiting'),
    in_transit_to_pickup: t('webadmin1.aorders.status.toPickup'),
    picked_up: t('webadmin1.aorders.status.pickedUp'),
    in_transit_to_delivery: t('webadmin1.aorders.status.delivering'),
    delivered: t('webadmin1.aorders.status.delivered'),
    cancelled: t('webadmin1.aorders.status.cancelled'),
    no_driver: t('webadmin1.aorders.status.noDriver'),
  };

  const FILTERS = [
    { id: '', label: t('webadmin1.aorders.filters.all') },
    { id: 'pending', label: t('webadmin1.aorders.filters.pending') },
    { id: 'assigned', label: t('webadmin1.aorders.filters.assigned') },
    { id: 'in_transit_to_delivery', label: t('webadmin1.aorders.filters.delivering') },
    { id: 'delivered', label: t('webadmin1.aorders.filters.delivered') },
    { id: 'cancelled', label: t('webadmin1.aorders.filters.cancelled') },
  ];

  const NEXT_STATUS: Record<string, Array<{ id: string; label: string }>> = {
    pending: [
      { id: 'pending_acceptance', label: t('webadmin1.aorders.next.toAccept') },
      { id: 'no_driver', label: t('webadmin1.aorders.next.toNoDriver') },
    ],
    driver_proposals: [{ id: 'assigned', label: t('webadmin1.aorders.next.assignedContest') }],
    pending_acceptance: [
      { id: 'assigned', label: t('webadmin1.aorders.next.assigned') },
      { id: 'pending', label: t('webadmin1.aorders.next.toContest') },
    ],
    assigned: [{ id: 'in_transit_to_pickup', label: t('webadmin1.aorders.next.toPickup') }],
    in_transit_to_pickup: [{ id: 'picked_up', label: t('webadmin1.aorders.next.pickedUp') }],
    picked_up: [{ id: 'in_transit_to_delivery', label: t('webadmin1.aorders.next.toDeliver') }],
    in_transit_to_delivery: [{ id: 'delivered', label: t('webadmin1.aorders.next.delivered') }],
    no_driver: [{ id: 'pending', label: t('webadmin1.aorders.next.reopen') }],
  };

  const advanceSelected = async () => {
    if (!selected || !nextStatus || advancing) return;
    setAdvancing(true);
    setCancelError(null);
    try {
      await api.updateOrderStatus(selected.id, nextStatus);
      setSelected(null);
      setNextStatus('');
      await load(filter, search, page, driverId);
    } catch (e: any) {
      setCancelError(e?.message || t('webadmin1.aorders.statusChangeError'));
    } finally {
      setAdvancing(false);
    }
  };

  // Cierre directo a entregado (cola trabada vieja ya entregada en la calle).
  const forceDeliverSelected = async () => {
    if (!selected || advancing) return;
    if (
      !window.confirm(
        t('webadmin1.aorders.confirmDeliver', {
          id: selected.id.slice(0, 8).toUpperCase(),
          biz: selected.merchant?.businessName ?? '',
        }),
      )
    ) {
      return;
    }
    setAdvancing(true);
    setCancelError(null);
    try {
      await api.updateOrderStatus(selected.id, 'delivered');
      setSelected(null);
      setNextStatus('');
      await load(filter, search, page, driverId);
    } catch (e: any) {
      setCancelError(e?.message || t('webadmin1.aorders.markDeliveredError'));
    } finally {
      setAdvancing(false);
    }
  };

  const cancelSelected = async () => {
    if (!selected || cancelling) return;
    if (
      !window.confirm(
        t('webadmin1.aorders.confirmCancel', {
          id: selected.id.slice(0, 8).toUpperCase(),
          biz: selected.merchant?.businessName ?? '',
        }),
      )
    ) {
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await api.updateOrderStatus(selected.id, 'cancelled');
      setSelected(null);
      await load(filter, search, page, driverId);
    } catch (e: any) {
      setCancelError(e?.message || t('webadmin1.aorders.cancelError'));
    } finally {
      setCancelling(false);
    }
  };

  const reassignSelected = async () => {
    if (!selected || !reassignTo || reassigning) return;
    const target = drivers.find((d) => d.id === reassignTo);
    if (
      !window.confirm(
        t('webadmin1.aorders.confirmReassign', {
          id: selected.id.slice(0, 8).toUpperCase(),
          name: target?.fullName ?? '',
        }),
      )
    ) {
      return;
    }
    setReassigning(true);
    setCancelError(null);
    try {
      await api.reassignDriver(selected.id, reassignTo);
      setSelected(null);
      setReassignTo('');
      await load(filter, search, page, driverId);
    } catch (e: any) {
      setCancelError(e?.message || t('webadmin1.aorders.reassignError'));
    } finally {
      setReassigning(false);
    }
  };
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (status: string, q: string, p: number, dId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getOrdersAdmin({
          take: PAGE_SIZE,
          skip: p * PAGE_SIZE,
          status: status || undefined,
          search: q.trim() || undefined,
          driverId: dId || undefined,
        });
        setOrders(Array.isArray(res?.items) ? res.items : []);
        setTotal(Number(res?.total ?? 0));
        setStats(res?.stats ?? null);
      } catch (e: any) {
        setError(e?.message || t('webadmin1.aorders.loadError'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(filter, search, page, driverId), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [filter, search, page, driverId, load]);

  useEffect(() => {
    api
      .getDriversAdminList()
      .then((res: any) => setDrivers(Array.isArray(res) ? res : []))
      .catch(() => setDrivers([]));
    api
      .getMerchantsAdmin?.()
      .then((res: any) => setMerchants(Array.isArray(res) ? res : []))
      .catch(() => setMerchants([]));
  }, []);

  const pushLive = useCallback((kind: 'new' | 'status', orderId: string, message: string) => {
    liveKey.current += 1;
    const evt: LiveEvent = { key: liveKey.current, kind, orderId, message, at: Date.now() };
    setLiveEvents((prev) => [evt, ...prev].slice(0, 15));
  }, []);

  const { isConnected, on } = useSocket({
    onOrderStatusChanged: useCallback(
      (data: any) => {
        const id = String(data?.orderId ?? data?.id ?? '');
        if (!id) return;
        pushLive(
          'status',
          id,
          String(data?.message ?? `${id.slice(0, 8).toUpperCase()}: ${data?.status ?? ''}`),
        );
        setOrders((prev) =>
          prev.map((o) =>
            o.id === id && data?.status ? { ...o, status: String(data.status) } : o,
          ),
        );
        setSelected((sel) =>
          sel && sel.id === id && data?.status ? { ...sel, status: String(data.status) } : sel,
        );
      },
      [pushLive],
    ),
  });

  // Altas del hub: canal propio admin:orderNew (cubre inmediatos,
  // programados y asignación directa sin tocar la semántica driver).
  const handleAdminNew = useCallback(
    (data: any) => {
      const id = String(data?.id ?? data?.orderId ?? '');
      if (!id) return;
      const msg = `#${id.slice(0, 8).toUpperCase()} · ${data?.merchantName ?? ''} → ${data?.deliveryAddress ?? ''} · ₡${Number(data?.totalAmount ?? 0).toLocaleString()}`;
      pushLive('new', id, msg);
      try {
        playNotificationSound('new_order');
      } catch {
        // sonido decorativo: nunca tumba el feed
      }
      const ctx = listCtx.current;
      if (ctx.page === 0 && !ctx.filter && !ctx.search && !ctx.driverId) {
        setOrders((prev) => {
          if (prev.some((o) => o.id === id)) return prev;
          const row: AdminOrder = {
            id,
            status: String(data?.status ?? 'pending'),
            orderType: String(data?.orderType ?? 'immediate'),
            pickupAddress: String(data?.pickupAddress ?? ''),
            deliveryAddress: String(data?.deliveryAddress ?? ''),
            deliveryZone: data?.deliveryZone ?? null,
            distanceKm: data?.distanceKm ?? null,
            basePrice: Number(data?.totalAmount ?? 0),
            commission: 0,
            commissionRate: null,
            driverPayout: data?.driverPayout ?? 0,
            totalAmount: Number(data?.totalAmount ?? 0),
            productsTotal: null,
            cashTendered: null,
            payment: null,
            createdAt: data?.createdAt ?? new Date().toISOString(),
            merchant: data?.merchantName ? { businessName: data.merchantName } : null,
            driver: null,
            items: [],
          };
          return [row, ...prev].slice(0, PAGE_SIZE);
        });
        setTotal((n) => n + 1);
      } else {
        setPendingLive((n) => n + 1);
      }
    },
    [pushLive],
  );

  useEffect(() => {
    const off = on('admin:orderNew', handleAdminNew);
    return off;
  }, [on, handleAdminNew]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          <Package className="h-6 w-6" /> {t('webadmin1.aorders.title')}
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {t('webadmin1.aorders.subtitle', {
            total,
            revenue: Number(stats?.revenue ?? 0).toLocaleString(),
            fee: Number(stats?.platformFee ?? 0).toLocaleString(),
          })}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs" aria-live="polite">
          <span
            className={`inline-block h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-surface-300 dark:bg-surface-600'}`}
          />
          <span className="text-surface-500 dark:text-surface-400">
            {isConnected ? t('webadmin1.aorders.liveOn') : t('webadmin1.aorders.liveOff')}
          </span>
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowManual(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-semibold text-white"
      >
        + Crear pedido manual
      </button>

      {/* Hub en vivo: últimos eventos + aviso cuando hay nuevos fuera de vista */}
      {pendingLive > 0 && (
        <button
          onClick={() => {
            setPendingLive(0);
            setPage(0);
            setFilter('');
            setSearch('');
            setDriverId('');
            load('', '', 0);
          }}
          className="w-full rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-semibold text-white"
        >
          {t('webadmin1.aorders.liveRefresh', { count: pendingLive })}
        </button>
      )}
      {liveEvents.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
            {t('webadmin1.aorders.liveFeed')}
          </p>
          <ul className="max-h-36 space-y-1 overflow-y-auto" aria-live="polite">
            {liveEvents.map((e) => (
              <li key={e.key} className="flex items-center gap-2 text-xs">
                <span>{e.kind === 'new' ? '🆕' : '🔄'}</span>
                <span className="min-w-0 flex-1 truncate text-surface-700 dark:text-surface-300">
                  {e.message}
                </span>
                <span className="shrink-0 text-surface-400">
                  {new Date(e.at).toLocaleTimeString('es-CR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(0);
              }}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.id
                  ? 'bg-kiwi-700 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
              }`}
            >
              {f.label}
              {f.id !== '' && stats ? ` (${stats.byStatus[f.id] ?? 0})` : ''}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500 dark:text-surface-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={t('webadmin1.aorders.searchPh')}
            className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="driver-filter"
            className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
          >
            {t('webadmin1.aorders.driverFilter')}
          </label>
          <select
            id="driver-filter"
            value={driverId}
            onChange={(e) => {
              setDriverId(e.target.value);
              setPage(0);
            }}
            className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 text-sm"
          >
            <option value="">{t('webadmin1.aorders.driverAll')}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-8 text-center">
          <Package className="h-10 w-10 mx-auto mb-2 text-surface-300" />
          <p className="text-sm text-surface-500">{t('webadmin1.aorders.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o, i) => (
            <motion.button
              key={o.id}
              onClick={() => {
                setSelected(o);
                setReassignTo('');
                setCopiedTrack(false);
              }}
              className="flex w-full items-center gap-3 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 text-left"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-surface-500 dark:text-surface-400">
                    #{o.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[o.status] ?? 'bg-surface-100 text-surface-500'}`}
                  >
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                  <span className="text-xs text-surface-400 dark:text-surface-500">
                    {new Date(o.createdAt).toLocaleString('es-CR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-surface-800 dark:text-surface-100">
                  {o.merchant?.businessName ?? '—'} → {o.deliveryAddress}
                </p>
                <p className="mt-0.5 truncate text-xs text-surface-500 dark:text-surface-400">
                  {o.driver?.fullName ?? t('webadmin1.aorders.noDriverAssigned')}
                  {' · '}
                  {(() => {
                    const m = o.payment?.method ?? null;
                    const label =
                      m === 'cash'
                        ? t('webadmin1.aorders.payCash')
                        : m === 'card'
                          ? t('webadmin1.aorders.payCard')
                          : m === 'sinpe'
                            ? t('webadmin1.aorders.paySinpe')
                            : m === 'crypto'
                              ? t('webadmin1.aorders.payCrypto')
                              : m === 'credit'
                                ? t('webadmin1.aorders.payCredit')
                                : t('webadmin1.aorders.payUnknown');
                    const st =
                      o.payment?.status === 'collected'
                        ? t('webadmin1.aorders.payDone')
                        : o.payment?.status
                          ? t('webadmin1.aorders.payPending')
                          : null;
                    return st ? `${label} (${st})` : label;
                  })()}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-surface-800 dark:text-surface-100">
                  ₡{Number(o.totalAmount).toLocaleString()}
                </p>
                <p className="text-xs text-kiwi-700">
                  {t('webadmin1.aorders.commissionShort', {
                    amount: Number(o.commission).toLocaleString(),
                  })}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Paginación */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> {t('webadmin1.aorders.prev')}
          </button>
          <span className="text-xs text-surface-500">
            {t('webadmin1.aorders.pageOf', { p: page + 1, pages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 disabled:opacity-40"
          >
            {t('webadmin1.aorders.nextPage')} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Drawer detalle */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-surface-800 p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-surface-500 dark:text-surface-400">
                    #{selected.id.slice(0, 8).toUpperCase()}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[selected.status] ?? ''}`}
                  >
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-surface-500 dark:text-surface-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <p className="flex items-start gap-2">
                  <Store className="mt-0.5 h-4 w-4 shrink-0 text-kiwi-500" />
                  <span>
                    <b>{selected.merchant?.businessName ?? '—'}</b>
                    <br />
                    <span className="text-surface-500">{selected.pickupAddress}</span>
                    <br />
                    <span className="text-xs">
                      <a
                        href={mapsUrl(
                          selected.pickupLat,
                          selected.pickupLng,
                          selected.pickupAddress,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-kiwi-700 dark:text-kiwi-300 hover:underline"
                      >
                        {t('webadmin1.aorders.openGmaps')}
                      </a>
                      <span aria-hidden className="mx-1.5 text-surface-300">
                        ·
                      </span>
                      <a
                        href={wazeUrl(
                          selected.pickupLat,
                          selected.pickupLng,
                          selected.pickupAddress,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-kiwi-700 dark:text-kiwi-300 hover:underline"
                      >
                        {t('webadmin1.aorders.openWaze')}
                      </a>
                    </span>
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                  <span>
                    {selected.deliveryAddress}
                    {selected.deliveryZone && (
                      <span className="ml-2 rounded-full bg-kiwi-100 px-2 py-0.5 text-xs text-kiwi-700">
                        {findDeliveryZone(selected.deliveryZone)?.label ?? 'Zona desconocida'}
                      </span>
                    )}
                    {(selected.deliveryLat != null || selected.deliveryLng != null) && (
                      <span className="ml-2 text-xs text-surface-400">
                        GPS: {selected.deliveryLat ?? '—'}, {selected.deliveryLng ?? '—'}
                      </span>
                    )}
                    <br />
                    <span className="text-xs">
                      <a
                        href={mapsUrl(
                          selected.deliveryLat,
                          selected.deliveryLng,
                          selected.deliveryAddress,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-kiwi-700 dark:text-kiwi-300 hover:underline"
                      >
                        {t('webadmin1.aorders.openGmaps')}
                      </a>
                      <span aria-hidden className="mx-1.5 text-surface-300">
                        ·
                      </span>
                      <a
                        href={wazeUrl(
                          selected.deliveryLat,
                          selected.deliveryLng,
                          selected.deliveryAddress,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-kiwi-700 dark:text-kiwi-300 hover:underline"
                      >
                        {t('webadmin1.aorders.openWaze')}
                      </a>
                    </span>
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Bike className="h-4 w-4 shrink-0 text-surface-500 dark:text-surface-400" />
                  {selected.driver?.fullName ?? t('webadmin1.aorders.noDriverAssigned')}
                </p>
                <div className="flex items-center gap-2 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 px-3 py-2">
                  <Navigation className="h-4 w-4 shrink-0 text-kiwi-700" />
                  <a
                    href={buildTrackingUrl(selected.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-xs font-medium text-kiwi-700 dark:text-kiwi-300 hover:underline"
                  >
                    {t('webadmin1.aorders.liveTracking')}
                  </a>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(buildTrackingUrl(selected.id));
                        setCopiedTrack(true);
                        setTimeout(() => setCopiedTrack(false), 2000);
                      } catch {
                        window.prompt(
                          t('webadmin1.aorders.copyPrompt'),
                          buildTrackingUrl(selected.id),
                        );
                      }
                    }}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-kiwi-700 dark:text-kiwi-300 hover:bg-kiwi-100 dark:hover:bg-kiwi-900/50"
                  >
                    {copiedTrack ? t('webadmin1.aorders.copied') : t('webadmin1.aorders.copy')}
                  </button>
                </div>
                {Array.isArray(selected.items) && selected.items.length > 0 && (
                  <div className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-3">
                    {selected.items.map((it, j) => (
                      <p key={j} className="text-xs">
                        {it.quantity}x {it.name}
                      </p>
                    ))}
                  </div>
                )}
                {(selected.pickupProofPhotoUrl || selected.deliveryProofPhotoUrl) && (
                  <div className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-3 space-y-3">
                    <p className="text-xs font-semibold text-surface-600 dark:text-surface-300">
                      {t('webadmin1.aorders.photoEvidence')}
                    </p>
                    {selected.pickupProofPhotoUrl && (
                      <div>
                        <p className="mb-1 text-xs text-surface-500">
                          {t('webadmin1.aorders.pickupPhotoLabel')}
                        </p>
                        <img
                          src={selected.pickupProofPhotoUrl}
                          alt={t('webadmin1.aorders.pickupPhotoAlt')}
                          className="rounded-xl w-full object-cover"
                        />
                      </div>
                    )}
                    {selected.deliveryProofPhotoUrl && (
                      <div>
                        <p className="mb-1 text-xs text-surface-500">
                          {t('webadmin1.aorders.deliveryPhotoLabel')}
                        </p>
                        <img
                          src={selected.deliveryProofPhotoUrl}
                          alt={t('webadmin1.aorders.deliveryPhotoAlt')}
                          className="rounded-xl w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-surface-500">{t('webadmin1.aorders.payMethod')}</span>
                    <span className="font-semibold">
                      {(() => {
                        const m = selected.payment?.method;
                        const label =
                          m === 'cash'
                            ? t('webadmin1.aorders.payCash')
                            : m === 'onvopay_card'
                              ? t('webadmin1.aorders.payCard')
                              : m === 'onvopay_sinpe'
                                ? t('webadmin1.aorders.paySinpe')
                                : m === 'crypto'
                                  ? t('webadmin1.aorders.payCrypto')
                                  : m === 'credit'
                                    ? t('webadmin1.aorders.payCredit')
                                    : t('webadmin1.aorders.payUnknown');
                        const done = selected.payment?.status === 'completed';
                        return `${label} · ${done ? t('webadmin1.aorders.payDone') : t('webadmin1.aorders.payPending')}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">{t('webadmin1.aorders.productsStore')}</span>
                    <span className="font-mono">
                      ₡{Number(selected.productsTotal ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">{t('webadmin1.aorders.tripDriver')}</span>
                    <span className="font-mono">
                      ₡{Number(selected.driverPayout).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">
                      {t('webadmin1.aorders.commission')}
                      {selected.commissionRate != null
                        ? ` (${Math.round(Number(selected.commissionRate) * 100)}%)`
                        : ''}
                    </span>
                    <span className="font-mono text-kiwi-700">
                      ₡{Number(selected.commission).toLocaleString()}
                    </span>
                  </div>
                  {selected.payment?.method === 'cash' && selected.cashTendered != null && (
                    <div className="flex justify-between">
                      <span className="text-surface-500">
                        {t('webadmin1.aorders.paidWith', {
                          amount: Number(selected.cashTendered).toLocaleString(),
                          change: Math.max(
                            0,
                            Number(selected.cashTendered) - Number(selected.totalAmount),
                          ).toLocaleString(),
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-surface-200 pt-1 text-sm font-bold">
                    <span>{t('webadmin1.aorders.total')}</span>
                    <span className="font-mono">
                      ₡{Number(selected.totalAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
                  <Wallet className="h-3 w-3" />
                  {t('webadmin1.aorders.createdAt', {
                    date: new Date(selected.createdAt).toLocaleString('es-CR'),
                  })}
                  {selected.deliveredAt
                    ? ` ${t('webadmin1.aorders.deliveredAt', {
                        date: new Date(selected.deliveredAt).toLocaleString('es-CR'),
                      })}`
                    : ''}
                </p>
                {selected.status !== 'delivered' && selected.status !== 'cancelled' && (
                  <div className="space-y-2">
                    {cancelError && <p className="mb-2 text-xs text-red-600">{cancelError}</p>}
                    {(NEXT_STATUS[selected.status] ?? []).length > 0 && (
                      <div className="flex gap-2">
                        <select
                          value={nextStatus}
                          onChange={(e) => setNextStatus(e.target.value)}
                          className="min-w-0 flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2.5 text-sm"
                        >
                          <option value="">{t('webadmin1.aorders.advanceTo')}</option>
                          {(NEXT_STATUS[selected.status] ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => void advanceSelected()}
                          disabled={!nextStatus || advancing}
                          className="shrink-0 rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {advancing
                            ? t('webadmin1.aorders.applying')
                            : t('webadmin1.aorders.apply')}
                        </button>
                      </div>
                    )}
                    {[
                      'assigned',
                      'pending_acceptance',
                      'in_transit_to_pickup',
                      'picked_up',
                      'in_transit_to_delivery',
                    ].includes(selected.status) && (
                      <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
                        <p className="mb-2 text-xs font-semibold text-surface-600 dark:text-surface-300">
                          {t('webadmin1.aorders.reassignTitle')}
                        </p>
                        <div className="flex gap-2">
                          <select
                            value={reassignTo}
                            onChange={(e) => setReassignTo(e.target.value)}
                            className="min-w-0 flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2.5 text-sm"
                          >
                            <option value="">{t('webadmin1.aorders.reassignPick')}</option>
                            {drivers
                              .filter((d) => d.id !== (selected as any).driverId)
                              .map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.fullName}
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => void reassignSelected()}
                            disabled={!reassignTo || reassigning}
                            className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {reassigning
                              ? t('webadmin1.aorders.reassigning')
                              : t('webadmin1.aorders.reassignCta')}
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => void forceDeliverSelected()}
                      disabled={advancing}
                      className="w-full rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {advancing
                        ? t('webadmin1.aorders.marking')
                        : t('webadmin1.aorders.markDelivered')}
                    </button>
                    <button
                      onClick={() => void cancelSelected()}
                      disabled={cancelling}
                      className="w-full rounded-xl border border-red-300 px-4 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50"
                    >
                      {cancelling
                        ? t('webadmin1.aorders.cancelling')
                        : t('webadmin1.aorders.cancelOrder')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showManual && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowManual(false)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 dark:bg-surface-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                Crear pedido manual
              </h2>
              <button onClick={() => setShowManual(false)} className="text-surface-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            {manualError && <p className="mb-3 text-sm text-red-600">{manualError}</p>}
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">Comercio</span>
                <select
                  value={manualForm.merchantId}
                  onChange={(e) => setManualForm((f) => ({ ...f, merchantId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                >
                  <option value="">Seleccionar…</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.businessName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">
                  Repartidor (opcional)
                </span>
                <select
                  value={manualForm.driverId}
                  onChange={(e) => setManualForm((f) => ({ ...f, driverId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                >
                  <option value="">Sin asignar</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">
                  Dirección de recogida
                </span>
                <input
                  value={manualForm.pickupAddress}
                  onChange={(e) => setManualForm((f) => ({ ...f, pickupAddress: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">Dirección de entrega</span>
                <input
                  value={manualForm.deliveryAddress}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, deliveryAddress: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">Zona</span>
                <select
                  value={manualForm.deliveryZone}
                  onChange={(e) => setManualForm((f) => ({ ...f, deliveryZone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                >
                  <option value="">Sin zona</option>
                  {deliveryZones.map((z: any) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">Precio del viaje</span>
                <input
                  type="number"
                  value={manualForm.basePrice}
                  onChange={(e) => setManualForm((f) => ({ ...f, basePrice: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">Estado final</span>
                <select
                  value={manualForm.status}
                  onChange={(e) => setManualForm((f) => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                >
                  <option value="delivered">Entregado</option>
                  <option value="assigned">Asignado</option>
                  <option value="pending">Pendiente</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">
                  Nombre del cliente (opcional)
                </span>
                <input
                  value={manualForm.customerName}
                  onChange={(e) => setManualForm((f) => ({ ...f, customerName: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">
                  Teléfono del cliente (opcional)
                </span>
                <input
                  value={manualForm.customerPhone}
                  onChange={(e) => setManualForm((f) => ({ ...f, customerPhone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">
                  Qué se envía (opcional)
                </span>
                <input
                  value={manualForm.packageDescription}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, packageDescription: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-surface-600">
                  Fecha de entrega (opcional)
                </span>
                <input
                  type="datetime-local"
                  value={manualForm.deliveredAt}
                  onChange={(e) => setManualForm((f) => ({ ...f, deliveredAt: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 dark:bg-surface-900"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={manualBusy}
                onClick={async () => {
                  setManualBusy(true);
                  setManualError(null);
                  try {
                    await api.createAdminOrder({
                      ...manualForm,
                      basePrice: Number(manualForm.basePrice),
                      driverId: manualForm.driverId || undefined,
                      deliveryZone: manualForm.deliveryZone || undefined,
                      deliveredAt: manualForm.deliveredAt
                        ? new Date(manualForm.deliveredAt).toISOString()
                        : undefined,
                    });
                    setShowManual(false);
                    setManualForm({
                      merchantId: '',
                      driverId: '',
                      pickupAddress: '',
                      deliveryAddress: '',
                      deliveryZone: '',
                      basePrice: '',
                      status: 'delivered',
                      customerName: '',
                      customerPhone: '',
                      packageDescription: '',
                      deliveredAt: '',
                    });
                    await load(filter, search, page, driverId);
                  } catch (e: any) {
                    setManualError(e?.message || 'No se pudo crear el pedido');
                  } finally {
                    setManualBusy(false);
                  }
                }}
                className="flex-1 rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {manualBusy ? 'Creando…' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="rounded-xl border border-surface-200 px-4 py-2.5 text-sm font-semibold text-surface-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
