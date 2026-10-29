// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { History as HistoryIcon, Package } from 'lucide-react';
import { api, LanguageSwitcherCompact, ScrollToTop, useTranslations } from '@kiwi/ui';

interface HistoryOrder {
  id: string;
  status: string;
  orderType: string;
  merchantName?: string | null;
  pickupAddress: string;
  deliveryAddress: string;
  driverPayout: number;
  isTest?: boolean;
  createdAt: string;
  deliveredAt?: string | null;
  assignedAt?: string | null;
  durationSeconds?: number | null;
}

const PAGE_SIZE = 20;
// En curso = todo lo que no está cerrado (ni entregado ni cancelado).
const ACTIVE_STATUS = new Set([
  'pending',
  'driver_proposals',
  'pending_acceptance',
  'assigned',
  'in_transit_to_pickup',
  'picked_up',
  'in_transit_to_delivery',
  'no_driver',
]);

const STATUS_COLOR: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

export default function HistoryPage() {
  const { t } = useTranslations();
  const [filter, setFilter] = useState<'all' | 'delivered' | 'cancelled' | 'active'>('all');
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (f: typeof filter, append: boolean) => {
      try {
        if (append) setLoadingMore(true);
        else {
          setLoading(true);
          setError(null);
        }
        // "En curso" abarca varios estados: se trae sin filtro y se filtra acá
        // (el volumen por repartidor es bajo y así no se toca el API).
        const status = f === 'active' ? undefined : f === 'all' ? undefined : f;
        const skip = append ? orders.length : 0;
        const data = await api.getDriverOrders({ status, take: PAGE_SIZE, skip });
        const items: HistoryOrder[] = Array.isArray(data?.items) ? data.items : [];
        const visible = f === 'active' ? items.filter((o) => ACTIVE_STATUS.has(o.status)) : items;
        setOrders((prev) => (append ? [...prev, ...visible] : visible));
        setTotal(Number(data?.total ?? 0));
      } catch (err) {
        if (!append) setError(err instanceof Error ? err.message : t('wdrvwork.history.loadError'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [orders.length, t],
  );

  useEffect(() => {
    setOrders([]);
    load(filter, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const statusKey = (s: string) =>
    s === 'delivered' ? 'statusDelivered' : s === 'cancelled' ? 'statusCancelled' : 'statusActive';
  const statusColor = (s: string) => STATUS_COLOR[s] ?? STATUS_COLOR.active;

  const fmtDuration = (secs?: number | null) => {
    if (secs == null || !Number.isFinite(secs)) return null;
    const s = Math.max(0, Math.round(secs));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      <header className="pt-safe sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex min-h-[44px] items-center gap-2 text-surface-600 dark:text-surface-400"
            >
              <span>←</span>
              <span className="text-sm font-medium">{t('wdrvwork.history.back')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              {t('wdrvwork.history.title')}
            </h1>
            <LanguageSwitcherCompact />
          </div>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-lg px-4 py-4 pb-28">
        <p className="mb-3 text-sm text-surface-500 dark:text-surface-400">
          {t('wdrvwork.history.subtitle')}
        </p>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: 'all', label: t('wdrvwork.history.filterAll') },
              { id: 'delivered', label: t('wdrvwork.history.filterDelivered') },
              { id: 'cancelled', label: t('wdrvwork.history.filterCancelled') },
              { id: 'active', label: t('wdrvwork.history.filterActive') },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-medium ${
                filter === f.id
                  ? 'bg-kiwi-700 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 p-8 text-center">
            <p className="mb-3 text-sm text-surface-500">{error}</p>
            <button
              onClick={() => load(filter, false)}
              className="min-h-[44px] rounded-xl bg-kiwi-700 px-4 text-sm font-semibold text-white"
            >
              {t('wdrvwork.history.retry')}
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 p-8 text-center">
            <HistoryIcon className="h-10 w-10 mx-auto mb-2 text-surface-300" />
            <p className="text-sm text-surface-500">{t('wdrvwork.history.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div
                key={o.id}
                className="flex w-full items-center gap-3 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-700">
                  <Package className="h-5 w-5 text-surface-500" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-surface-500">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(o.status)}`}
                    >
                      {t(`wdrvwork.history.${statusKey(o.status)}` as any)}
                    </span>
                    {o.isTest === true && (
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        🧪 TEST
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-sm font-medium text-surface-800 dark:text-surface-100">
                    {o.merchantName ?? o.pickupAddress} → {o.deliveryAddress}
                  </span>
                  <span className="text-xs text-surface-500">
                    {new Date(o.deliveredAt || o.createdAt).toLocaleString('es-CR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {o.durationSeconds != null && fmtDuration(o.durationSeconds)
                      ? ` · ⏱ ${fmtDuration(o.durationSeconds)}`
                      : ''}
                  </span>
                </span>
                <span className="shrink-0 font-bold text-surface-800 dark:text-surface-100">
                  ₡{o.isTest === true ? 0 : Number(o.driverPayout).toLocaleString()}
                </span>
              </div>
            ))}
            {orders.length < total && filter !== 'active' && (
              <button
                onClick={() => load(filter, true)}
                disabled={loadingMore}
                className="min-h-[44px] w-full rounded-xl bg-surface-100 dark:bg-surface-800 text-sm font-medium disabled:opacity-40"
              >
                {t('wdrvwork.history.loadMore')}
              </button>
            )}
          </div>
        )}
      </div>

      <BottomNav />
      <ScrollToTop />
    </main>
  );
}
