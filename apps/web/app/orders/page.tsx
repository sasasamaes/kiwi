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
import { api, useAuth, useSocket, type Order, ShareTrackingButton, ScrollReveal } from '@kiwi/ui';
import { MerchantNav } from '../../components/MerchantNav';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Buscando repartidor',
  driver_proposals: 'Recibiendo propuestas',
  assigned: 'Repartidor asignado',
  in_transit_to_pickup: 'Va a recoger',
  picked_up: 'Recogido',
  in_transit_to_delivery: 'En camino a entregar',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  driver_proposals: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  in_transit_to_pickup: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  picked_up: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  in_transit_to_delivery:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const ACTIVE = new Set([
  'pending',
  'driver_proposals',
  'assigned',
  'in_transit_to_pickup',
  'picked_up',
  'in_transit_to_delivery',
]);

const TABS = [
  { id: 'active', label: 'En curso' },
  { id: 'all', label: 'Todos' },
  { id: 'delivered', label: 'Entregados' },
  { id: 'cancelled', label: 'Cancelados' },
] as const;

function timelineOf(o: any) {
  if (o.status === 'cancelled') {
    return [
      { label: 'Creado', at: o.createdAt, done: true },
      { label: 'Cancelado', at: o.updatedAt ?? o.createdAt, done: true },
    ];
  }
  return [
    { label: 'Creado', at: o.createdAt, done: true },
    {
      label: o.driver?.fullName ? `Aceptado · ${o.driver.fullName}` : 'Aceptado',
      at: o.assignedAt,
      done: !!o.assignedAt,
    },
    { label: 'Recogido', at: o.pickedUpAt, done: !!o.pickedUpAt },
    { label: 'Entregado', at: o.deliveredAt, done: !!o.deliveredAt },
  ];
}

/**
 * Nombre del cliente: campo estructurado (pedidos nuevos) o parseado de
 * `specialInstructions` ("Cliente: Nombre (teléfono) · notas") para el
 * historial viejo que se creó sin customerName.
 */
function getClientInfo(o: any): { name: string | null; phone: string | null } {
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
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
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
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOrders = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);
      const data = await api.getMyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      if (!silent) setError('No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user, fetchOrders]);

  // Tiempo real: cualquier cambio del pedido refresca la lista y destella la fila
  const scheduleRefresh = useCallback(
    (orderId?: string) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (orderId) {
        setFlashId(orderId);
        setTimeout(() => setFlashId(null), 4000);
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
    ];
    return () => offs.forEach((off) => off());
  }, [onSocket, scheduleRefresh]);

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
            <h1 className="text-2xl font-semibold">Mis envíos</h1>
            <p className="flex items-center gap-1.5 text-xs text-surface-500">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? 'bg-kiwi-500' : 'bg-surface-300'}`}
              />
              {isConnected ? 'En vivo · se actualiza solo' : 'Reconectando…'}
              {activeCount > 0 && ` · ${activeCount} en curso`}
            </p>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchOrders();
            }}
            aria-label="Actualizar"
            className="rounded-xl p-2.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {rejected && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {rejected.driverName ? `${rejected.driverName} rechazó` : 'Rechazaron'} el pedido #
                {rejected.orderId.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Volvió a concurso. Reasignalo a otro repartidor.
              </p>
            </div>
            <Link
              href="/drivers"
              className="shrink-0 rounded-xl bg-kiwi-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Reasignar
            </Link>
            <button
              onClick={() => setRejected(null)}
              aria-label="Descartar aviso"
              className="shrink-0 rounded-xl p-2 text-amber-600 dark:text-amber-400"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-kiwi-700 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, dirección o repartidor…"
            className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 pl-10 pr-4 py-2.5 text-sm"
          />
        </div>

        {filtered.length === 0 && (
          <div className="mt-6 rounded-2xl glass p-8 text-center">
            <Package className="mx-auto mb-2 h-10 w-10 text-surface-300" />
            <p className="text-sm text-surface-500">
              {tab === 'active' ? 'Sin envíos en curso. Todo entregado.' : 'Nada por aquí.'}
            </p>
            <Link
              href="/orders/new"
              className="mt-4 inline-block rounded-xl bg-kiwi-700 px-5 py-2.5 text-sm font-bold text-white"
            >
              Crear envío
            </Link>
          </div>
        )}

        <ul className="mt-4 space-y-3">
          {filtered.map((order: any, i) => {
            const open = expanded === order.id;
            const driverPhone = order.driver?.user?.phone;
            const client = getClientInfo(order);
            const clientName = client.name ?? 'Cliente sin nombre';
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
                    aria-label={`Ver detalle del pedido de ${clientName}`}
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
                        <ChevronDown className="h-4 w-4 text-surface-400" />
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
                              <p className="text-xs text-surface-400">Cliente</p>
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
                                <Phone className="h-3.5 w-3.5" /> Llamar
                              </a>
                            )}
                          </div>
                          <p className="font-mono text-xs text-surface-400">
                            Pedido #{order.id.slice(-4).toUpperCase()}
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
                                        : 'bg-surface-200 dark:bg-surface-700 text-surface-400'
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
                                    <p className="text-xs text-surface-400">
                                      {new Date(s.at).toLocaleString('es-CR', {
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
                                <Bike className="h-4 w-4 text-kiwi-500" />
                                {order.driver.fullName}
                                {order.driver.vehicleType ? ` · ${order.driver.vehicleType}` : ''}
                              </p>
                              {driverPhone && (
                                <a
                                  href={`tel:${driverPhone}`}
                                  className="flex items-center gap-1 rounded-lg bg-kiwi-700 px-3 py-1.5 text-xs font-bold text-white"
                                >
                                  <Phone className="h-3.5 w-3.5" /> Llamar
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
                              Todavía ningún repartidor lo toma. Te avisamos en cuanto alguien lo
                              acepte.
                            </p>
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
                                Contenido:{' '}
                                {order.items
                                  .map((it: any) => `${it.quantity}x ${it.name}`)
                                  .join(', ')}
                              </p>
                            )}
                            <p className="font-mono">
                              Envío ₡
                              {Number(order.driverPayout ?? order.basePrice ?? 0).toLocaleString()}{' '}
                              · Comisión ₡{Number(order.commission ?? 0).toLocaleString()} · Total ₡
                              {Number(order.totalAmount).toLocaleString()}
                            </p>
                          </div>

                          <ShareTrackingButton
                            orderId={order.id}
                            label="Compartir seguimiento"
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
