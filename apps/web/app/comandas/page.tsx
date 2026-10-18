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
  Copy,
  Check,
} from 'lucide-react';
import {
  api,
  useAuth,
  useSocket,
  playNotificationSound,
  OrderChat,
  useTranslations,
} from '@kiwi/ui';
import { MerchantNav } from '../../components/MerchantNav';

const NEW_STATUSES = new Set(['pending', 'driver_proposals', 'pending_acceptance']);

/** Ya recogidos por el repartidor: no entran en la lista de compras. */
const PICKED_STATUSES = new Set(['picked_up', 'in_transit_to_delivery', 'delivered']);

/**
 * Comandas: pedidos que entran por la app cliente, en vivo y con sonido.
 * Solo lectura + cancelar: el repartidor se asigna solo por concurso y el
 * detalle operativo vive en /orders.
 */
function KioskCard({
  kiosk,
  rows,
  total,
  dateLabel,
  copyKey,
  copied,
  onCopy,
}: {
  kiosk: string;
  rows: Array<{ name: string; qty: number }>;
  total: number;
  dateLabel: string | null;
  copyKey: string;
  copied: boolean;
  onCopy: (key: string, text: string) => void;
}) {
  const { t } = useTranslations();
  // Texto para pedirle al kiosko por WhatsApp (siempre en español: es local).
  const text = [
    `🧾 Pedido Kiwi — ${kiosk}${dateLabel ? ` (${dateLabel})` : ''}`,
    ...rows.map((r) => `• ${r.qty}× ${r.name}`),
    `Total: ${total} uds`,
  ].join('\n');
  return (
    <div className="rounded-xl bg-white dark:bg-surface-800 p-3 shadow-soft dark:shadow-dark">
      <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">🏪 {kiosk}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-surface-700 dark:text-surface-200 truncate">{r.name}</span>
            <span className="shrink-0 font-bold text-surface-800 dark:text-surface-100">
              ×{r.qty}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-right text-xs font-medium text-surface-500 dark:text-surface-400">
        {total} {total === 1 ? t('webshop1.comandas.unitOne') : t('webshop1.comandas.unitMany')}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => void onCopy(copyKey, text)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-surface-200 dark:border-surface-600 px-2 py-1.5 text-xs font-semibold text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-kiwi-600" /> {t('webshop1.comandas.copied')}
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> {t('webshop1.comandas.copyOrder')}
            </>
          )}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366]/15 px-2 py-1.5 text-xs font-semibold text-[#128C4B] dark:text-[#25D366] hover:bg-[#25D366]/25 transition-colors"
        >
          {t('webshop1.comandas.sendWhatsApp')}
        </a>
      </div>
    </div>
  );
}
export default function ComandasPage() {
  const router = useRouter();
  const { t, locale } = useTranslations();
  const { user, loading: authLoading } = useAuth();

  const STATUS_LABEL: Record<string, string> = {
    pending: t('webshop1.comandas.statusPending'),
    driver_proposals: t('webshop1.comandas.statusProposals'),
    assigned: t('webshop1.comandas.statusAssigned'),
    pending_acceptance: t('webshop1.comandas.statusWaiting'),
    in_transit_to_pickup: t('webshop1.comandas.statusToPickup'),
    picked_up: t('webshop1.comandas.statusPickedUp'),
    in_transit_to_delivery: t('webshop1.comandas.statusDelivering'),
  };

  const timeAgo = (iso: string): string => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return t('webshop1.comandas.timeNow');
    if (mins < 60) return t('webshop1.comandas.timeMins', { count: mins });
    const h = Math.floor(mins / 60);
    return t('webshop1.comandas.timeHours', { h, mins: mins % 60 });
  };
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [chatOpenId, setChatOpenId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchIncoming = useCallback(
    async (silent = false) => {
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
        if (!silent) setError(t('webshop1.comandas.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchIncoming();
  }, [user, fetchIncoming]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
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
    const timer = setInterval(() => fetchIncoming(true), 20000);
    return () => clearInterval(timer);
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
      setError(e instanceof Error ? e.message : t('webshop1.comandas.cancelFailed'));
    } finally {
      setCancellingId(null);
    }
  };

  // Lista de compras por kiosko: todo lo pre-vendido (aún no recogido) sumado
  // por puesto, para pedirlo en cada kiosko y luego repartirlo.
  // Se separa en PARA HOY (inmediatos + programados de hoy) y PREVENTA
  // (programados futuros, agrupados por fecha de entrega).
  // OJO hooks: esto va ANTES de cualquier early return (si no, React #310:
  // en loading se llamaba un hook menos que después de cargar).
  const dayKeyOf = (o: any): string | null => {
    const raw = o.scheduledDate ? String(o.scheduledDate) : null;
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };
  const todayKey = (() => {
    const d = new Date();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  })();
  const shopping = useMemo(() => {
    const addTo = (
      map: Map<string, Map<string, number>>,
      kiosk: string,
      name: string,
      qty: number,
    ) => {
      let products = map.get(kiosk);
      if (!products) {
        products = new Map();
        map.set(kiosk, products);
      }
      products.set(name, (products.get(name) ?? 0) + qty);
    };
    const toGroups = (byKiosk: Map<string, Map<string, number>>) =>
      [...byKiosk.entries()].map(([kiosk, products]) => {
        const rows = [...products.entries()].map(([name, qty]) => ({ name, qty }));
        return { kiosk, rows, total: rows.reduce((s, r) => s + r.qty, 0) };
      });
    const todayMap = new Map<string, Map<string, number>>();
    const presaleByDate = new Map<string, Map<string, Map<string, number>>>();
    for (const o of orders) {
      if (PICKED_STATUSES.has(o.status)) continue;
      const dk = dayKeyOf(o);
      const isPresale = o.orderType === 'scheduled' && (!dk || dk > todayKey);
      for (const it of o.items ?? []) {
        if (!it?.name) continue;
        const kiosk = it.kioskName || t('webshop1.comandas.kioskDirect');
        const qty = Number(it.quantity ?? 1);
        if (isPresale) {
          const dateKey = dk ?? 'undated';
          let byKiosk = presaleByDate.get(dateKey);
          if (!byKiosk) {
            byKiosk = new Map();
            presaleByDate.set(dateKey, byKiosk);
          }
          addTo(byKiosk, kiosk, it.name, qty);
        } else {
          addTo(todayMap, kiosk, it.name, qty);
        }
      }
    }
    const presale = [...presaleByDate.entries()]
      .sort(([a], [b]) => (a === 'undated' ? 1 : b === 'undated' ? -1 : a.localeCompare(b)))
      .map(([dateKey, byKiosk]) => ({ dateKey, groups: toGroups(byKiosk) }));
    return { today: toGroups(todayMap), presale };
  }, [orders, t]);

  // Etiqueta de fecha de preventa: Hoy / Mañana / fecha larga.
  const presaleDateLabel = (dateKey: string): string => {
    if (dateKey === 'undated') return t('webshop1.comandas.presaleNoDate');
    const [y, m, d] = dateKey.split('-').map(Number);
    if (!y || !m || !d) return dateKey;
    const dt = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
    if (diff <= 0) return t('webshop1.comandas.presaleToday');
    if (diff === 1) return t('webshop1.comandas.presaleTomorrow');
    return dt.toLocaleDateString(locale === 'es' ? 'es-CR' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const copyKioskOrder = async (key: string, text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Portapapeles bloqueado: el botón de WhatsApp igual lleva el texto.
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
              <Receipt className="h-6 w-6" /> {t('webshop1.comandas.title')}
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-surface-500">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? 'bg-kiwi-500' : 'bg-surface-300'}`}
              />
              {isConnected ? t('webshop1.comandas.live') : t('webshop1.comandas.reconnecting')}
              {orders.length > 0 && t('webshop1.comandas.activeCount', { count: orders.length })}
            </p>
          </div>
          <button
            onClick={() => fetchIncoming()}
            aria-label={t('webshop1.comandas.reloadAria')}
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
              {t('webshop1.comandas.emptyTitle')}
            </p>
            <p className="text-sm text-surface-500 mt-1">{t('webshop1.comandas.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Qué comprar HOY por kiosko (pedidos de hoy, aún no recogidos) */}
            {shopping.today.length > 0 && (
              <motion.section
                className="rounded-2xl border-2 border-kiwi-600/40 bg-kiwi-50 dark:bg-kiwi-900/20 p-5"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="flex items-center gap-2 font-display font-bold text-surface-800 dark:text-surface-100">
                  <ShoppingBasket className="h-5 w-5 text-kiwi-700 dark:text-kiwi-300" />
                  {t('webshop1.comandas.shoppingToday')}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 mb-3">
                  {t('webshop1.comandas.shoppingTodayHint')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {shopping.today.map((s) => (
                    <KioskCard
                      key={s.kiosk}
                      kiosk={s.kiosk}
                      rows={s.rows}
                      total={s.total}
                      dateLabel={null}
                      copyKey={`hoy:${s.kiosk}`}
                      copied={copiedKey === `hoy:${s.kiosk}`}
                      onCopy={copyKioskOrder}
                    />
                  ))}
                </div>
              </motion.section>
            )}
            {/* Preventa por fecha: cuánto pedirle a cada kiosko */}
            {shopping.presale.map((day) => (
              <motion.section
                key={day.dateKey}
                className="rounded-2xl border-2 border-purple-500/40 bg-purple-50 dark:bg-purple-900/20 p-5"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="flex items-center gap-2 font-display font-bold text-surface-800 dark:text-surface-100">
                  📅 {t('webshop1.comandas.shoppingPresale')} · {presaleDateLabel(day.dateKey)}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 mb-3">
                  {t('webshop1.comandas.shoppingPresaleHint')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {day.groups.map((s) => (
                    <KioskCard
                      key={s.kiosk}
                      kiosk={s.kiosk}
                      rows={s.rows}
                      total={s.total}
                      dateLabel={presaleDateLabel(day.dateKey)}
                      copyKey={`${day.dateKey}:${s.kiosk}`}
                      copied={copiedKey === `${day.dateKey}:${s.kiosk}`}
                      onCopy={copyKioskOrder}
                    />
                  ))}
                </div>
              </motion.section>
            ))}
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
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          #{o.id.slice(0, 8).toUpperCase()} · {timeAgo(o.createdAt)}
                        </p>
                        <p className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                          {o.customerName || t('webshop1.comandas.customerFallback')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${
                              isNew
                                ? 'bg-gold-500/20 text-gold-700 dark:text-gold-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            }`}
                          >
                            {isNew
                              ? t('webshop1.comandas.badgeNew')
                              : (STATUS_LABEL[o.status] ?? o.status)}
                          </span>
                          {o.payment?.status === 'completed' && (
                            <span className="rounded-full px-2 py-0.5 font-semibold bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-900/40 dark:text-kiwi-300">
                              {t('webshop1.comandas.paid')}
                            </span>
                          )}
                          {(o.payment?.method === 'cash' || (o as any).cashTendered != null) && (
                            <span className="rounded-full px-2 py-0.5 font-semibold bg-gold-100 text-gold-700 dark:bg-gold-900/40 dark:text-gold-300">
                              {t('webshop1.comandas.cash')}
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
                            {t('webshop1.comandas.payCash', {
                              cash: Number((o as any).cashTendered).toLocaleString(),
                              change: Math.max(
                                0,
                                Number((o as any).cashTendered) - Number(o.totalAmount ?? 0),
                              ).toLocaleString(),
                            })}
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
                          {o.packageDescription || t('webshop1.comandas.parcelFallback')}
                        </li>
                      )}
                    </ul>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-600 dark:text-surface-300 mb-3">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-surface-500 dark:text-surface-400" />
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
                          <Bike className="h-4 w-4 text-surface-500 dark:text-surface-400" />
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
                      <span className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
                        <Clock className="h-3.5 w-3.5" />
                        {t('webshop1.comandas.autoAssign')}
                      </span>
                      <span className="flex-1" />
                      <button
                        onClick={() => setChatOpenId((v) => (v === o.id ? null : o.id))}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                          chatOpenId === o.id
                            ? 'bg-kiwi-100 dark:bg-kiwi-900/40 text-kiwi-700 dark:text-kiwi-300'
                            : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'
                        }`}
                      >
                        {t('webshop1.comandas.chat')}
                      </button>
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
                          ? t('webshop1.comandas.canceling')
                          : confirmCancelId === o.id
                            ? t('webshop1.comandas.confirmCancel')
                            : t('webshop1.comandas.cancel')}
                      </button>
                    </div>
                    {chatOpenId === o.id && (
                      <div className="mt-3">
                        <OrderChat orderId={o.id} />
                      </div>
                    )}
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {fresh.length > 0 && (
          <p className="mt-6 text-center text-xs text-surface-500 dark:text-surface-400">
            {t('webshop1.comandas.pendingFooter', { count: fresh.length })}
          </p>
        )}
      </main>
    </>
  );
}
