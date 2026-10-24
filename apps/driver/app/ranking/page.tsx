// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { Trophy, Medal, Timer, Bike } from 'lucide-react';
import { api, LanguageSwitcherCompact, useTranslations, useAuth } from '@kiwi/ui';

interface RankRow {
  driverId: string;
  name: string;
  photoUrl: string | null;
  vehicleType: string;
  trips: number;
  avgSeconds: number;
}

function fmt(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

const PERIODS = ['week', 'month', 'all'] as const;

export default function RankingPage() {
  const { t } = useTranslations();
  const { user } = useAuth();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('week');
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const myDriverId = (user as any)?.driverProfile?.id as string | undefined;

  const load = useCallback(
    async (p: string) => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getDriverRanking(p);
        setRows(Array.isArray(data?.ranking) ? data.ranking : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('wdrvwork.active.rankLoadError'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    load(period);
  }, [period, load]);

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
              <span className="text-sm font-medium">{t('wdrvwork.active.back')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              {t('wdrvwork.active.rankTitle')}
            </h1>
            <LanguageSwitcherCompact />
          </div>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-lg px-4 py-4 pb-28">
        <p className="mb-3 text-sm text-surface-500 dark:text-surface-400">
          {t('wdrvwork.active.rankSubtitle')}
        </p>
        <div className="mb-4 flex gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium ${
                period === p
                  ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-100 shadow-soft'
                  : 'text-surface-500 dark:text-surface-400'
              }`}
            >
              {t(
                `wdrvwork.active.rankPeriod${p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All'}` as any,
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 p-8 text-center">
            <p className="mb-3 text-sm text-surface-500">{error}</p>
            <button
              onClick={() => load(period)}
              className="min-h-[44px] rounded-xl bg-kiwi-700 px-4 text-sm font-semibold text-white"
            >
              {t('wdrvwork.active.rankRetry')}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 p-8 text-center">
            <Trophy className="h-10 w-10 mx-auto mb-2 text-surface-300" />
            <p className="text-sm text-surface-500">{t('wdrvwork.active.rankEmpty')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, idx) => {
              const isMe = myDriverId != null && r.driverId === myDriverId;
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
              return (
                <div
                  key={r.driverId}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    isMe
                      ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30'
                      : 'bg-white dark:bg-surface-800 border-surface-200/60 dark:border-white/[0.06]'
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-700 text-sm font-bold">
                    {medal ?? <span className="text-surface-500">{idx + 1}</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-surface-800 dark:text-surface-100">
                      <span className="truncate">{r.name}</span>
                      {isMe && (
                        <span className="shrink-0 rounded-full bg-kiwi-700 px-2 py-0.5 text-[10px] font-bold text-white">
                          {t('wdrvwork.active.rankYou')}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-surface-500">
                      {t('wdrvwork.active.rankTrips', { count: r.trips })} ·{' '}
                      {t('wdrvwork.active.rankAvg', { time: fmt(r.avgSeconds) })}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-base font-bold text-kiwi-700 dark:text-kiwi-300">
                    <Timer className="h-4 w-4" />
                    {fmt(r.avgSeconds)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 p-4 text-xs text-surface-500 dark:text-surface-400">
          <p className="flex items-center gap-1.5">
            <Medal className="h-4 w-4 text-gold-500" />
            {t('wdrvwork.active.rankSubtitle')}
          </p>
          <p className="mt-1 flex items-center gap-1.5">
            <Bike className="h-4 w-4" />
            {t('wdrvwork.active.rankTop3')}
          </p>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
