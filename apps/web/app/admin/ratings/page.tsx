// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, RefreshCw } from 'lucide-react';
import { api, useTranslations } from '@kiwi/ui';

interface RatingItem {
  id: string;
  rating: number;
  comment?: string | null;
  onTime?: boolean | null;
  carefulWithOrder?: boolean | null;
  createdAt: string;
  driver?: { fullName?: string | null } | null;
  merchant?: { businessName?: string | null } | null;
  order?: { id: string; deliveryAddress?: string | null } | null;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= value ? 'fill-gold-400 text-gold-400' : 'text-surface-300 dark:text-surface-600'}`}
        />
      ))}
    </span>
  );
}

export default function AdminRatings() {
  const { t } = useTranslations();
  const [items, setItems] = useState<RatingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'good' | 'bad'>('all');
  const [onlyWithComment, setOnlyWithComment] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { take: 30, onlyWithComment };
      if (filter === 'good') params.minRating = 4;
      if (filter === 'bad') params.maxRating = 3;
      const res = await api.getRatingsAdmin(params);
      setItems(Array.isArray(res?.items) ? res.items : []);
      setTotal(Number(res?.total ?? 0));
      setAverage(Number(res?.summary?.average ?? 0));
      setCount(Number(res?.summary?.count ?? 0));
    } catch (e: any) {
      setError(e?.message || t('webadmin2.arat.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [filter, onlyWithComment]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            <MessageSquare className="h-6 w-6" /> {t('webadmin2.arat.title')}
          </h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            {t('webadmin2.arat.subtitle')}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> {t('webadmin2.arat.refresh')}
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 text-center">
          <p className="text-3xl font-bold text-surface-800 dark:text-surface-100">
            {average.toFixed(1)}
          </p>
          <Stars value={Math.round(average)} />
          <p className="mt-1 text-xs text-surface-500">{t('webadmin2.arat.avg', { count })}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 text-center">
          <p className="text-3xl font-bold text-surface-800 dark:text-surface-100">{total}</p>
          <p className="mt-1 text-xs text-surface-500">{t('webadmin2.arat.inView')}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 text-center">
          <p className="text-3xl font-bold text-kiwi-700">
            {items.filter((i) => (i.rating ?? 0) >= 4).length}
          </p>
          <p className="mt-1 text-xs text-surface-500">{t('webadmin2.arat.fourPlus')}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'all', labelKey: 'webadmin2.arat.fAll' },
            { id: 'good', labelKey: 'webadmin2.arat.fGood' },
            { id: 'bad', labelKey: 'webadmin2.arat.fBad' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === f.id
                ? 'bg-kiwi-700 text-white'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
        <button
          onClick={() => setOnlyWithComment((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            onlyWithComment
              ? 'bg-gold-100 text-gold-700 dark:bg-gold-900/40 dark:text-gold-300'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
          }`}
        >
          {t('webadmin2.arat.onlyText')}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse"
            />
          ))
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-8 text-center">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 text-surface-300" />
            <p className="text-sm text-surface-500">{t('webadmin2.arat.empty')}</p>
          </div>
        ) : (
          items.map((r, i) => (
            <motion.div
              key={r.id}
              className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
            >
              <div className="mb-1 flex items-center justify-between">
                <Stars value={r.rating} />
                <span className="text-xs text-surface-500 dark:text-surface-400">
                  {new Date(r.createdAt).toLocaleDateString('es-CR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
              {r.comment && (
                <p className="text-sm text-surface-800 dark:text-surface-100">“{r.comment}”</p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-surface-500">
                <span>
                  {t('webadmin2.arat.driver', {
                    name: r.driver?.fullName ?? t('webadmin2.arat.unknown'),
                  })}
                </span>
                <span>
                  {t('webadmin2.arat.merchant', {
                    name: r.merchant?.businessName ?? t('webadmin2.arat.unknown'),
                  })}
                </span>
                {r.onTime != null && (
                  <span>{r.onTime ? t('webadmin2.arat.onTime') : t('webadmin2.arat.late')}</span>
                )}
                {r.carefulWithOrder != null && (
                  <span>
                    {r.carefulWithOrder
                      ? t('webadmin2.arat.careful')
                      : t('webadmin2.arat.careless')}
                  </span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
