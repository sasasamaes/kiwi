// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  Phone,
  MapPin,
  Bike,
  Clock,
  RefreshCw,
  Volume2,
  ShoppingBasket,
} from 'lucide-react';
import { api, useAuth, useSocket, playNotificationSound } from '@kiwi/ui';
import { MerchantNav } from '../../components/MerchantNav';

const NEW_STATUSES = new Set(['pending', 'driver_proposals', 'pending_acceptance']);

/** Ya recogidos por el repartidor: no entran en la lista de compras. */
const PICKED_STATUSES = new Set(['picked_up', 'in_transit_to_delivery', 'delivered']);

const STATUS_LABEL: Record<string, string> = {
  pending: 'Buscando repartidor',
  driver_proposals: 'Recibiendo propuestas',
  assigned: 'Repartidor asignado',
  pending_acceptance: 'Esperando al repartidor',
  in_transit_to_pickup: 'Va a recoger',
  picked_up: 'Recogido',
  in_transit_to_delivery: 'En camino a entregar',
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  return `hace ${h} h ${mins % 60} min`;
}

/**
 * Comandas: pedidos que entran por la app cliente, en vivo y con sonido.
 * Solo lectura + cancelar: el repartidor se asigna solo por concurso y el
 * detalle operativo vive en /orders.
 */
export default function ComandasPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchIncoming = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);
      const data = await api.getIncomingOrders();
      const list = Array.isArray(data) ? data : [];
      // Pedidos nuevos desde la última carga: sonido + destello (no en la
      // primera carga, para no sonar por el historial al abrir).
      if (!firstLoad.current) {
        const fresh = list.filter((o: any) => o?.id && !knownIds.current.has(o.id));
        if (fresh.length > 0) {
          try {
            playNotificationSound('new_order');
          } catch {
            // audio bloqueado: el destello visual igual avisa
          }
          setFlashId(fresh[0].id);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlashId(null), 5000);
        }
      }
      firstLoad.current = false;
      knownIds.current = new Set(list.map((o: any) => o.id));
      setOrders(list);
    } catch {
      if (!silent) setError('No se pudieron cargar las comandas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchIncoming();
  }, [user, fetchIncoming]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const { isConnected, on: onSocket } = useSocket({
    onOrderStatusChanged: () => fetchIncoming(true),
  });

  useEffect(() => {
    const offs = [
      onSocket('order:driverAssigned', () => fetchIncoming(true)),
      onSocket('order:proposalReceived', () => fetchIncoming(true)),
      onSocket('order:contestStarted', () => fetchIncoming(true)),
      onSocket('order:noDriver', () => fetchIncoming(true)),
    ];
    return () => offs.forEach((off) => off());
  }, [onSocket, fetchIncoming]);

  // Polling de respaldo cada 20s (si el socket se cae, igual entran).
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => fetchIncoming(true), 20000);
    return () => clearInterval(t);
  }, [user, fetchIncoming]);

  const cancelOrder = async (orderId: string) => {
    if (confirmCancelId !== orderId) {
      setConfirmCancelId(orderId);
      return;
    }
    setConfirmCancelId(null);
    setCancellingId(orderId);
    try {
      await api.updateOrderStatus(orderId, 'cancelled');
      fetchIncoming(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar');
    } finally {
      setCancellingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <MerchantNav />
        <main className="mx-auto max-w-3xl space-y-3 p-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
            />
          ))}
        </main>
      </>
    );
  }

  const fresh = orders.filter((o) => NEW_STATUSES.has(o.status));

  // Lista de compras por kiosko: todo lo pre-vendido (aún no recogido) sumado
  // por puesto, para pedirlo en cada kiosko y luego repartirlo.
  const shopping = useMemo(() => {
    const byKiosk = new Map<string, Map<string, number>>();
    for (const o of orders) {
      if (PICKED_STATUSES.has(o.status)) continue;
      for (const it of o.items ?? []) {
        if (!it?.name) continue;
        const kiosk = it.kioskName || 'Directo del comercio';
        let products = byKiosk.get(kiosk);
        if (!products) {
          products = new Map();
          byKiosk.set(kiosk, products);
        }
        products.set(it.name, (products.get(it.name) ?? 0) + Number(it.quantity ?? 1));
      }
    }
    return [...byKiosk.entries()].map(([kiosk, products]) => {
      const rows = [...products.entries()].map(([name, qty]) => ({ name, qty }));
      return { kiosk, rows, total: rows.reduce((s, r) => s + r.qty, 0) };
    });
  }, [orders]);

  return (
    <>
      <MerchantNav
        isConnected={isConnected}
        businessName={(user as any)?.merchantProfile?.businessName}
      />
      <main className="mx-auto max-w-3xl p-6 pb-20">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Receipt className="h-6 w-6" /> Comandas
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-surface-500">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? 'bg-kiwi-500' : 'bg-surface-300'}`}
              />
              {isConnected ? 'En vivo · suena con cada pedido nuevo' : 'Reconectando…'}
              {orders.length > 0 && ` · ${orders.length} activas`}
            </p>
          </div>
          <button
            onClick={() => fetchIncoming()}
            aria-label="Recargar comandas"
            className="rounded-xl p-2.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-surface-300 dark:border-surface-700 p-10 text-center">
            <Volume2 className="h-10 w-10 mx-auto mb-3 text-surface-300" />
            <p className="font-medium text-surface-700 dark:text-surface-200">
              Sin comandas por ahora
            </p>
            <p className="text-sm text-surface-500 mt-1">
              Los pedidos de la app cliente aparecen aquí solos, con sonido.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Qué comprar por kiosko (pre-vendido, aún no recogido) */}
            {shopping.length > 0 && (
              <motion.section
                className="rounded-2xl border-2 border-purple-500/40 bg-purple-50 dark:bg-purple-900/20 p-5"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="flex items-center gap-2 font-display font-bold text-surface-800 dark:text-surface-100">
                  <ShoppingBasket className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                  Qué comprar por kiosko
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 mb-3">
                  Pre-vendido y por recoger: pedilo en cada puesto y luego repartilo.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {shopping.map((s) => (
                    <div
                      key={s.kiosk}
                      className="rounded-xl bg-white dark:bg-surface-800 p-3 shadow-soft dark:shadow-dark"
                    >
                      <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                        🏪 {s.kiosk}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {s.rows.map((r) => (
                          <li
                            key={r.name}
                            className="flex items-baseline justify-between gap-2 text-sm"
                          >
                            <span className="text-surface-700 dark:text-surface-200 truncate">
                              {r.name}
                            </span>
                            <span className="shrink-0 font-bold text-surface-800 dark:text-surface-100">
                              ×{r.qty}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-right text-xs font-medium text-surface-400">
                        {s.total} {s.total === 1 ? 'unidad' : 'unidades'}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
            <AnimatePresence initial={false}>
              {orders.map((o) => {
                const isNew = NEW_STATUSES.has(o.status);
                const items = Array.isArray(o.items) ? o.items : [];
                return (
                  <motion.article
                    key={o.id}
                    layout
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border-2 bg-white dark:bg-surface-800 p-5 shadow-soft dark:shadow-dark transition-colors ${
                      flashId === o.id ? 'border-kiwi-500' : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs text-surface-400">
                          #{o.id.slice(0, 8).toUpperCase()} · {timeAgo(o.createdAt)}
                        </p>
                        <p className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                          {o.customerName || 'Cliente'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${
                              isNew
                                ? 'bg-gold-500/20 text-gold-700 dark:text-gold-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            }`}
                          >
                            {isNew ? '● Nuevo' : (STATUS_LABEL[o.status] ?? o.status)}
                          </span>
                          {o.payment?.status === 'completed' && (
                            <span className="rounded-full px-2 py-0.5 font-semibold bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-900/40 dark:text-kiwi-300">
                              Pagado
                            </span>
                          )}
                          {(o.payment?.method === 'cash' || (o as any).cashTendered != null) && (
                            <span className="rounded-full px-2 py-0.5 font-semibold bg-gold-100 text-gold-700 dark:bg-gold-900/40 dark:text-gold-300">
                              Efectivo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-kiwi-700 dark:text-kiwi-400">
                          ₡{Number(o.totalAmount ?? 0).toLocaleString()}
                        </p>
                        {(o as any).cashTendered != null && (
                          <p className="text-xs font-semibold text-gold-700 dark:text-gold-300">
                            Paga con ₡{Number((o as any).cashTendered).toLocaleString()} · Vuelto ₡
                            {Math.max(
                              0,
                              Number((o as any).cashTendered) - Number(o.totalAmount ?? 0),
                            ).toLocaleString()}
                          </p>
                        )}
                        {o.deliveryZone && (
                          <p className="text-xs text-surface-500">{o.deliveryZone}</p>
                        )}
                      </div>
                    </div>

                    <ul className="divide-y divide-surface-100 dark:divide-surface-700/50 mb-3">
                      {items.map((it: any, i: number) => (
                        <li key={i} className="py-2 flex items-start justify-between gap-2 text-sm">
                          <div>
                            <span className="font-semibold text-kiwi-700 dark:text-kiwi-300">
                              {it.quantity}x{' '}
                            </span>
                            <span className="text-surface-800 dark:text-surface-100">
                              {it.name}
                            </span>
                            {it.kioskName && (
                              <span className="ml-2 rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                                🏪 {it.kioskName}
                              </span>
                            )}
                            {Array.isArray(it.selectedVariants) &&
                              it.selectedVariants.length > 0 && (
                                <p className="text-xs text-surface-500">
                                  {it.selectedVariants
                                    .map((v: any) => v?.option ?? v?.optionName ?? '')
                                    .filter(Boolean)
                                    .join(', ')}
                                </p>
                              )}
                            {it.notes && (
                              <p className="text-xs italic text-surface-500">“{it.notes}”</p>
                            )}
                          </div>
                        </li>
                      ))}
                      {items.length === 0 && (
                        <li className="py-2 text-sm text-surface-500">
                          {o.packageDescription || 'Encomienda'}
                        </li>
                      )}
                    </ul>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-600 dark:text-surface-300 mb-3">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-surface-400" />
                        {o.deliveryAddress}
                      </span>
                      {o.customerPhone && (
                        <a
                          href={`tel:${o.customerPhone.replace(/\D/g, '')}`}
                          className="flex items-center gap-1.5 text-kiwi-700 dark:text-kiwi-300 font-medium"
                        >
                          <Phone className="h-4 w-4" /> {o.customerPhone}
                        </a>
                      )}
                      {o.driver?.fullName && (
                        <span className="flex items-center gap-1.5">
                          <Bike className="h-4 w-4 text-surface-400" />
                          {o.driver.fullName}
                        </span>
                      )}
                      {o.specialInstructions && (
                        <span className="w-full text-xs italic text-surface-500">
                          “{o.specialInstructions}”
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-surface-400">
                        <Clock className="h-3.5 w-3.5" />
                        El repartidor se asigna solo
                      </span>
                      <span className="flex-1" />
                      <button
                        onClick={() => void cancelOrder(o.id)}
                        disabled={cancellingId === o.id}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          confirmCancelId === o.id
                            ? 'bg-red-600 text-white'
                            : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                      >
                        {cancellingId === o.id
                          ? 'Cancelando…'
                          : confirmCancelId === o.id
                            ? '¿Seguro? Tocá de nuevo'
                            : 'Cancelar'}
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {fresh.length > 0 && (
          <p className="mt-6 text-center text-xs text-surface-400">
            {fresh.length} por atender · el resto ya va en camino
          </p>
        )}
      </main>
    </>
  );
}
