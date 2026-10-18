// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Calendar,
  CalendarDays,
  BarChart3,
  Infinity as InfinityIcon,
  Truck,
  Car,
  Clock,
  Inbox,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { api, ScrollToTop, LanguageSwitcherCompact, useTranslations } from '@kiwi/ui';

interface EarningsData {
  period: string;
  totalEarnings: number;
  totalTrips: number;
  averagePerTrip: number;
  totalHours: number;
  earningsPerHour: number;
  daily: Array<{ date: string; amount: number }>;
  transactions: Array<{
    id: string;
    merchantName: string;
    pickupAddress: string;
    deliveryAddress: string;
    amount: number;
    date: string;
    orderType: string;
  }>;
  summary: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime: number;
  };
}

const PERIODS = [
  { id: 'today', labelKey: 'periodToday', icon: Calendar },
  { id: 'week', labelKey: 'periodWeek', icon: CalendarDays },
  { id: 'month', labelKey: 'periodMonth', icon: Calendar },
  { id: 'all', labelKey: 'periodAll', icon: InfinityIcon },
];

const ORDER_TYPE_ICONS: Record<string, any> = {
  immediate: Package,
  scheduled: Calendar,
  freight: Truck,
  trip: Car,
};

export default function EarningsPage() {
  const { t } = useTranslations();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  const fetchEarnings = useCallback(
    async (period: string) => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getDriverEarnings(period);
        setEarnings(data);
      } catch (err) {
        console.error('Failed to fetch earnings:', err);
        setError(err instanceof Error ? err.message : t('wdrvwork.earnings.loadError'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    fetchEarnings(selectedPeriod);
  }, [selectedPeriod, fetchEarnings]);

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString()}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-CR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate max daily amount for chart scaling
  const maxDailyAmount = earnings?.daily ? Math.max(...earnings.daily.map((d) => d.amount), 1) : 1;

  if (loading && !earnings) {
    return (
      <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
        {/* Header */}
        <header className="pt-safe sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
              >
                <span>←</span>
                <span className="text-sm font-medium">{t('wdrvwork.earnings.back')}</span>
              </Link>
              <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                {t('wdrvwork.earnings.title')}
              </h1>
              <LanguageSwitcherCompact />
            </div>
          </div>
        </header>

        {/* Loading Skeleton */}
        <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6 space-y-4">
          <div className="h-40 rounded-3xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
          <div className="h-12 rounded-xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 rounded-xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
            <div className="h-24 rounded-xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
            <div className="h-24 rounded-xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
            <div className="h-24 rounded-xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
          </div>
        </main>
      </main>
    );
  }

  if (error && !earnings) {
    return (
      <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
        {/* Header */}
        <header className="pt-safe sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
              >
                <span>←</span>
                <span className="text-sm font-medium">{t('wdrvwork.earnings.back')}</span>
              </Link>
              <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                {t('wdrvwork.earnings.title')}
              </h1>
              <LanguageSwitcherCompact />
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6 flex items-center justify-center">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <AlertTriangle className="h-14 w-14 mx-auto mb-4 text-amber-500" />
            <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
              {t('wdrvwork.earnings.errorTitle')}
            </h2>
            <p className="text-surface-500 dark:text-surface-400 mb-6">{error}</p>
            <motion.button
              onClick={() => fetchEarnings(selectedPeriod)}
              className="px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {t('wdrvwork.earnings.retry')}
            </motion.button>
          </motion.div>
        </main>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <header className="pt-safe sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Ganancias
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 pt-6 pb-28">
        {/* Total Earnings Card */}
        <motion.div
          className="mb-6 rounded-3xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg overflow-hidden relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Background decorations */}
          <motion.div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute -left-5 -bottom-5 h-20 w-20 rounded-full bg-white/10"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          />

          <div className="relative">
            <p className="text-white/80 text-sm font-medium">
              {(() => {
                const found = PERIODS.find((p) => p.id === selectedPeriod);
                return found
                  ? t('wdrvwork.earnings.totalFor', {
                      period: t(`wdrvwork.earnings.${found.labelKey}`),
                    })
                  : t('wdrvwork.earnings.totalAll');
              })()}
            </p>
            <motion.p
              className="mt-1 text-4xl font-display font-bold"
              key={earnings?.totalEarnings}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10 }}
            >
              {formatCurrency(earnings?.totalEarnings || 0)}
            </motion.p>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-white/80">
                <Package className="text-kiwi-200 h-5 w-5" />
                <span>
                  {t('wdrvwork.earnings.tripsCount', { count: earnings?.totalTrips || 0 })}
                </span>
              </div>
              <div className="flex items-center gap-1 text-white/80">
                <Clock className="h-5 w-5 text-kiwi-200" />
                <span>
                  {t('wdrvwork.earnings.hoursCount', {
                    count: earnings?.totalHours?.toFixed(1) || 0,
                  })}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Period Tabs */}
        <motion.div
          className="mb-6 flex gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 p-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {PERIODS.map((period) => {
            const PeriodIcon = period.icon as any;
            return (
              <motion.button
                key={period.id}
                onClick={() => setSelectedPeriod(period.id)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  selectedPeriod === period.id
                    ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-100 shadow-soft'
                    : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                {typeof PeriodIcon === 'string' ? (
                  <span className="mr-1">{PeriodIcon}</span>
                ) : (
                  <PeriodIcon className="h-4 w-4 inline mr-1" />
                )}
                {t(`wdrvwork.earnings.${period.labelKey}`)}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          className="mb-6 grid grid-cols-2 gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div
            className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
            whileHover={{ y: -2 }}
          >
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('wdrvwork.earnings.statTrips')}
            </p>
            <p className="mt-1 text-2xl font-bold text-surface-800 dark:text-surface-100">
              {earnings?.totalTrips || 0}
            </p>
          </motion.div>
          <motion.div
            className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
            whileHover={{ y: -2 }}
          >
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('wdrvwork.earnings.statAvg')}
            </p>
            <p className="mt-1 text-2xl font-bold text-surface-800 dark:text-surface-100">
              {formatCurrency(earnings?.averagePerTrip || 0)}
            </p>
          </motion.div>
          <motion.div
            className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
            whileHover={{ y: -2 }}
          >
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('wdrvwork.earnings.statHours')}
            </p>
            <p className="mt-1 text-2xl font-bold text-surface-800 dark:text-surface-100">
              {earnings?.totalHours?.toFixed(1) || '0'}h
            </p>
          </motion.div>
          <motion.div
            className="rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4 shadow-soft dark:shadow-dark border border-kiwi-200 dark:border-kiwi-800"
            whileHover={{ y: -2 }}
          >
            <p className="text-sm text-kiwi-700 dark:text-kiwi-400">
              {t('wdrvwork.earnings.statPerHour')}
            </p>
            <p className="mt-1 text-2xl font-bold text-kiwi-700 dark:text-kiwi-300">
              {formatCurrency(earnings?.earningsPerHour || 0)}
            </p>
          </motion.div>
        </motion.div>

        {/* Mini Bar Chart */}
        {earnings?.daily && earnings.daily.length > 0 && (
          <motion.div
            className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="mb-4 text-sm font-semibold text-surface-600 dark:text-surface-400">
              <BarChart3 className="h-4 w-4 inline" /> {t('wdrvwork.earnings.dailyTitle')}
            </h3>
            <div className="flex items-end gap-1 h-32">
              {earnings.daily.slice(-7).map((day, index) => (
                <motion.div
                  key={day.date}
                  className="flex-1 flex flex-col items-center"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                >
                  <div className="w-full flex flex-col items-center justify-end h-24">
                    <motion.div
                      className="w-full rounded-t-lg bg-kiwi-gradient"
                      initial={{ height: 0 }}
                      animate={{ height: `${(day.amount / maxDailyAmount) * 100}%` }}
                      transition={{ delay: 0.5 + index * 0.05, type: 'spring', stiffness: 100 }}
                      style={{ minHeight: day.amount > 0 ? '8px' : '0px' }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-surface-500 dark:text-surface-400">
                    {formatDate(day.date)}
                  </p>
                  <p className="text-[10px] font-medium text-surface-600 dark:text-surface-300">
                    {formatCurrency(day.amount)}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Transactions */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="mb-3 text-sm font-semibold text-surface-600 dark:text-surface-400 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> {t('wdrvwork.earnings.recentTitle')}
          </h3>

          {earnings?.transactions && earnings.transactions.length > 0 ? (
            <div className="space-y-3">
              {earnings.transactions.slice(0, 10).map((transaction, index) => (
                <motion.div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-xl bg-surface-50 dark:bg-surface-700/50 p-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400">
                      <span className="text-lg">
                        {(() => {
                          const OrderIcon = (ORDER_TYPE_ICONS[transaction.orderType] ||
                            Package) as any;
                          return typeof OrderIcon === 'string' ? (
                            OrderIcon
                          ) : (
                            <OrderIcon className="h-5 w-5" />
                          );
                        })()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
                        {transaction.deliveryAddress}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        {formatDate(transaction.date)} • {formatTime(transaction.date)}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-kiwi-700 dark:text-kiwi-400">
                    +{formatCurrency(transaction.amount)}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Inbox className="h-10 w-10 mx-auto mb-2 text-surface-300 dark:text-surface-600" />
              <p className="text-surface-500 dark:text-surface-400 text-sm">
                {t('wdrvwork.earnings.recentEmpty')}
              </p>
            </div>
          )}
        </motion.div>

        {/* Withdraw Button */}
        <motion.div
          className="mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Link href="/withdraw">
            <motion.button
              className="w-full rounded-2xl bg-kiwi-gradient py-4 text-lg font-semibold text-white shadow-kiwi-lg"
              whileHover={{ scale: 1.02, boxShadow: '0 16px 40px -8px rgba(34, 197, 94, 0.5)' }}
              whileTap={{ scale: 0.98 }}
            >
              {t('wdrvwork.earnings.withdrawCta')}
            </motion.button>
          </Link>
          <p className="text-center text-xs text-surface-500 dark:text-surface-400 mt-2">
            {t('wdrvwork.earnings.withdrawNote')}
          </p>
        </motion.div>
      </main>

      {/* Bottom Navigation */}
      <ScrollToTop className="bottom-24" />
      <BottomNav />
    </main>
  );
}
