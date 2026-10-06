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
import { api, buildTrackingUrl } from '@kiwi/ui';

interface AdminOrder {
  id: string;
  status: string;
  orderType: string;
  pickupAddress: string;
  deliveryAddress: string;
  deliveryZone?: string | null;
  distanceKm?: number | string | null;
  basePrice: number | string;
  commission: number | string;
  commissionRate?: number | string | null;
  driverPayout: number | string;
  totalAmount: number | string;
  createdAt: string;
  assignedAt?: string | null;
  deliveredAt?: string | null;
  merchant?: { businessName?: string | null } | null;
  driver?: { fullName?: string | null } | null;
  items?: Array<{ name: string; quantity: number }>;
  pickupProofPhotoUrl?: string | null;
  deliveryProofPhotoUrl?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  driver_proposals: 'Propuestas',
  assigned: 'Asignado',
  pending_acceptance: 'Esperando al repartidor',
  in_transit_to_pickup: 'A recoger',
  picked_up: 'Recogido',
  in_transit_to_delivery: 'Entregando',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  no_driver: 'Sin repartidores',
};

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

const FILTERS = [
  { id: '', label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'assigned', label: 'Asignados' },
  { id: 'in_transit_to_delivery', label: 'Entregando' },
  { id: 'delivered', label: 'Entregados' },
  { id: 'cancelled', label: 'Cancelados' },
];

const PAGE_SIZE = 20;

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{
    revenue: number;
    platformFee: number;
    byStatus: Record<string, number>;
  } | null>(null);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [copiedTrack, setCopiedTrack] = useState(false);
  // Cancelación de duplicados/trabados (ej. chofer con 20 en curso por
  // reintentos sin internet). Solo estados cancelables por transición.
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // Avance manual de pedidos ajenos trabados (el admin salta actores y,
  // si hace falta, la foto — queda auditado en el log del servidor).
  const [advancing, setAdvancing] = useState(false);
  const [nextStatus, setNextStatus] = useState('');

  const NEXT_STATUS: Record<string, Array<{ id: string; label: string }>> = {
    pending: [
      { id: 'pending_acceptance', label: 'En aceptación' },
      { id: 'no_driver', label: 'Sin repartidores' },
    ],
    driver_proposals: [{ id: 'assigned', label: 'Asignado (elegir repartidor aparte)' }],
    pending_acceptance: [
      { id: 'assigned', label: 'Asignado' },
      { id: 'pending', label: 'A concurso' },
    ],
    assigned: [{ id: 'in_transit_to_pickup', label: 'Va a recoger' }],
    in_transit_to_pickup: [{ id: 'picked_up', label: 'Recogido' }],
    picked_up: [{ id: 'in_transit_to_delivery', label: 'En camino a entregar' }],
    in_transit_to_delivery: [{ id: 'delivered', label: 'Entregado' }],
    no_driver: [{ id: 'pending', label: 'Reabrir concurso' }],
  };

  const advanceSelected = async () => {
    if (!selected || !nextStatus || advancing) return;
    setAdvancing(true);
    setCancelError(null);
    try {
      await api.updateOrderStatus(selected.id, nextStatus);
      setSelected(null);
      setNextStatus('');
      await load(filter, search, page);
    } catch (e: any) {
      setCancelError(e?.message || 'No se pudo cambiar el estado');
    } finally {
      setAdvancing(false);
    }
  };

  // Cierre directo a entregado (cola trabada vieja ya entregada en la calle).
  const forceDeliverSelected = async () => {
    if (!selected || advancing) return;
    if (
      !window.confirm(
        `Marcar ENTREGADO el pedido #${selected.id.slice(0, 8).toUpperCase()} de ${selected.merchant?.businessName ?? ''}? Solo si ya se entregó en la calle.`,
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
      await load(filter, search, page);
    } catch (e: any) {
      setCancelError(e?.message || 'No se pudo marcar entregado');
    } finally {
      setAdvancing(false);
    }
  };

  const cancelSelected = async () => {
    if (!selected || cancelling) return;
    if (
      !window.confirm(
        `Cancelar el pedido #${selected.id.slice(0, 8).toUpperCase()} de ${selected.merchant?.businessName ?? ''}? No se puede deshacer.`,
      )
    ) {
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await api.updateOrderStatus(selected.id, 'cancelled');
      setSelected(null);
      await load(filter, search, page);
    } catch (e: any) {
      setCancelError(e?.message || 'No se pudo cancelar');
    } finally {
      setCancelling(false);
    }
  };
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (status: string, q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getOrdersAdmin({
        take: PAGE_SIZE,
        skip: p * PAGE_SIZE,
        status: status || undefined,
        search: q.trim() || undefined,
      });
      setOrders(Array.isArray(res?.items) ? res.items : []);
      setTotal(Number(res?.total ?? 0));
      setStats(res?.stats ?? null);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(filter, search, page), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [filter, search, page, load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          <Package className="h-6 w-6" /> Gestión de Pedidos
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {total} pedidos · ₡{Number(stats?.revenue ?? 0).toLocaleString()} movidos · ₡
          {Number(stats?.platformFee ?? 0).toLocaleString()} comisión
        </p>
      </div>

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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por ID, dirección o nombre…"
            className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 pl-10 pr-4 py-2.5 text-sm"
          />
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
        <div className="rounded-2xl glass p-8 text-center">
          <Package className="h-10 w-10 mx-auto mb-2 text-surface-300" />
          <p className="text-sm text-surface-500">Sin pedidos con este filtro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o, i) => (
            <motion.button
              key={o.id}
              onClick={() => {
                setSelected(o);
                setCopiedTrack(false);
              }}
              className="flex w-full items-center gap-3 rounded-2xl glass p-4 text-left"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-surface-400">
                    #{o.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[o.status] ?? 'bg-surface-100 text-surface-500'}`}
                  >
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-surface-800 dark:text-surface-100">
                  {o.merchant?.businessName ?? '—'} → {o.deliveryAddress}
                </p>
                <p className="text-xs text-surface-400">
                  {new Date(o.createdAt).toLocaleString('es-CR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {o.driver?.fullName ? ` · ${o.driver.fullName}` : ' · Sin repartidor'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-surface-800 dark:text-surface-100">
                  ₡{Number(o.totalAmount).toLocaleString()}
                </p>
                <p className="text-xs text-kiwi-700">
                  ₡{Number(o.commission).toLocaleString()} com.
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
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="text-xs text-surface-500">
            Página {page + 1} de {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 disabled:opacity-40"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
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
                  <p className="font-mono text-xs text-surface-400">
                    #{selected.id.slice(0, 8).toUpperCase()}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[selected.status] ?? ''}`}
                  >
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                </div>
                <button onClick={() => setSelected(null)} className="text-surface-400">
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
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                  <span>
                    {selected.deliveryAddress}
                    {selected.deliveryZone && (
                      <span className="ml-2 rounded-full bg-kiwi-100 px-2 py-0.5 text-xs text-kiwi-700">
                        {selected.deliveryZone}
                      </span>
                    )}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Bike className="h-4 w-4 shrink-0 text-surface-400" />
                  {selected.driver?.fullName ?? 'Sin repartidor asignado'}
                </p>
                <div className="flex items-center gap-2 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 px-3 py-2">
                  <Navigation className="h-4 w-4 shrink-0 text-kiwi-700" />
                  <a
                    href={buildTrackingUrl(selected.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-xs font-medium text-kiwi-700 dark:text-kiwi-300 hover:underline"
                  >
                    Seguimiento en vivo
                  </a>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(buildTrackingUrl(selected.id));
                        setCopiedTrack(true);
                        setTimeout(() => setCopiedTrack(false), 2000);
                      } catch {
                        window.prompt('Copiá el link:', buildTrackingUrl(selected.id));
                      }
                    }}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-kiwi-700 dark:text-kiwi-300 hover:bg-kiwi-100 dark:hover:bg-kiwi-900/50"
                  >
                    {copiedTrack ? '¡Copiado!' : 'Copiar'}
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
                      Evidencia fotográfica
                    </p>
                    {selected.pickupProofPhotoUrl && (
                      <div>
                        <p className="mb-1 text-xs text-surface-500">Comercio al entregar</p>
                        <img
                          src={selected.pickupProofPhotoUrl}
                          alt="Foto del comercio al entregar"
                          className="rounded-xl w-full object-cover"
                        />
                      </div>
                    )}
                    {selected.deliveryProofPhotoUrl && (
                      <div>
                        <p className="mb-1 text-xs text-surface-500">Entrega al cliente</p>
                        <img
                          src={selected.deliveryProofPhotoUrl}
                          alt="Foto de la entrega al cliente"
                          className="rounded-xl w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-surface-500">Viaje (repartidor)</span>
                    <span className="font-mono">
                      ₡{Number(selected.driverPayout).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">
                      Comisión
                      {selected.commissionRate != null
                        ? ` (${Math.round(Number(selected.commissionRate) * 100)}%)`
                        : ''}
                    </span>
                    <span className="font-mono text-kiwi-700">
                      ₡{Number(selected.commission).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-surface-200 pt-1 text-sm font-bold">
                    <span>Total</span>
                    <span className="font-mono">
                      ₡{Number(selected.totalAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="flex items-center gap-2 text-xs text-surface-400">
                  <Wallet className="h-3 w-3" />
                  Creado {new Date(selected.createdAt).toLocaleString('es-CR')}
                  {selected.deliveredAt
                    ? ` · Entregado ${new Date(selected.deliveredAt).toLocaleString('es-CR')}`
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
                          <option value="">Avanzar a…</option>
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
                          {advancing ? '…' : 'Aplicar'}
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => void forceDeliverSelected()}
                      disabled={advancing}
                      className="w-full rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {advancing ? 'Marcando…' : 'Marcar entregado'}
                    </button>
                    <button
                      onClick={() => void cancelSelected()}
                      disabled={cancelling}
                      className="w-full rounded-xl border border-red-300 px-4 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelando…' : 'Cancelar este pedido'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
