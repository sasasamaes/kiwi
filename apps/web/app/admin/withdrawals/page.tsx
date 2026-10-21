// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  RefreshCw,
  Check,
  X,
  ClipboardList,
  Coins,
  Smartphone,
  Calendar,
  Star,
} from 'lucide-react';
import { api, Skeleton, useTranslations } from '@kiwi/ui';

interface Withdrawal {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  sinpePhone?: string;
  sinpeName?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  processedAt?: string;
  rejectionReason?: string;
  transactionId?: string;
  createdAt: string;
  driver: {
    id: string;
    userId: string;
    fullName: string;
    vehicleType: string;
    rating: number;
    user: {
      id: string;
      email: string;
      phone: string;
    };
  };
}

const STATUS_ICON: Record<string, any> = {
  pending: Clock,
  processing: RefreshCw,
  completed: Check,
  failed: X,
  rejected: X,
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
};

export default function AdminWithdrawalsPage() {
  const { t } = useTranslations();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [transactionId, setTransactionId] = useState('');
  // Planilla semanal mar–lun
  const [payrollWeek, setPayrollWeek] = useState<string | null>(null);
  const [payroll, setPayroll] = useState<any>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollMsg, setPayrollMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [balances, setBalances] = useState<any[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [zeroingId, setZeroingId] = useState<string | null>(null);
  const [balancesMsg, setBalancesMsg] = useState<string | null>(null);
  // Recibo del retiro seleccionado
  const [receipt, setReceipt] = useState<any>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const STATUS_LABEL: Record<string, string> = {
    pending: t('webadmin1.awith.status.pending'),
    processing: t('webadmin1.awith.status.processing'),
    completed: t('webadmin1.awith.status.completed'),
    failed: t('webadmin1.awith.status.failed'),
    rejected: t('webadmin1.awith.status.rejected'),
  };

  const FILTER_TABS = [
    { id: 'all', label: t('webadmin1.awith.tabs.all'), icon: ClipboardList },
    { id: 'pending', label: t('webadmin1.awith.tabs.pending'), icon: Clock },
    { id: 'processing', label: t('webadmin1.awith.tabs.processing'), icon: RefreshCw },
    { id: 'completed', label: t('webadmin1.awith.tabs.completed'), icon: Check },
    { id: 'rejected', label: t('webadmin1.awith.tabs.rejected'), icon: X },
  ];

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // For now, we'll fetch pending withdrawals (admin endpoint)
      // In a real app, you'd have an endpoint to get all withdrawals
      const data = await api.getPendingWithdrawals();
      setWithdrawals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
      setError(err instanceof Error ? err.message : t('webadmin1.awith.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchPayroll = useCallback(
    async (week?: string | null) => {
      try {
        setPayrollLoading(true);
        setPayrollMsg(null);
        const data = await api.getPayroll(week ?? undefined);
        setPayroll(data ?? null);
        if (data?.weekStart && !week) {
          setPayrollWeek(new Date(data.weekStart).toISOString().slice(0, 10));
        }
      } catch {
        setPayrollMsg(t('webadmin1.awith.payrollLoadError'));
      } finally {
        setPayrollLoading(false);
      }
    },
    [t],
  );

  const fetchBalances = useCallback(async () => {
    try {
      setBalancesLoading(true);
      setBalancesMsg(null);
      const data = await api.getUnsettledBalances();
      setBalances(Array.isArray(data) ? data : []);
    } catch {
      setBalancesMsg(t('webadmin1.awith.balancesLoadError'));
    } finally {
      setBalancesLoading(false);
    }
  }, [t]);

  const handleZeroOut = async (driverId: string, fullName: string) => {
    if (!window.confirm(t('webadmin1.awith.zeroOutConfirm', { name: fullName }))) return;
    try {
      setZeroingId(driverId);
      await api.zeroOutDriver(driverId, t('webadmin1.awith.zeroOutReason'));
      setBalancesMsg(t('webadmin1.awith.zeroedOk', { name: fullName }));
      void fetchBalances();
      void fetchPayroll(payrollWeek);
    } catch (e: any) {
      setBalancesMsg(e?.message || t('webadmin1.awith.zeroOutError'));
    } finally {
      setZeroingId(null);
    }
  };

  const shiftWeek = (days: number) => {
    const base = payrollWeek ? new Date(`${payrollWeek}T12:00:00Z`) : new Date();
    const next = new Date(base.getTime() + days * 24 * 3600 * 1000);
    const iso = next.toISOString().slice(0, 10);
    setPayrollWeek(iso);
    void fetchPayroll(iso);
  };

  const handleGeneratePayroll = async () => {
    try {
      setGenerating(true);
      setPayrollMsg(null);
      const res: any = await api.generatePayroll(payrollWeek ?? undefined);
      const n = Array.isArray(res?.created) ? res.created.length : 0;
      const m = Array.isArray(res?.skipped) ? res.skipped.length : 0;
      setPayrollMsg(
        m > 0
          ? t('webadmin1.awith.payrollPartial', { n, m })
          : t('webadmin1.awith.payrollCreated', { n }),
      );
      void fetchPayroll(payrollWeek);
      fetchWithdrawals();
    } catch {
      setPayrollMsg(t('webadmin1.awith.payrollGenError'));
    } finally {
      setGenerating(false);
    }
  };

  const fetchReceipt = useCallback(async (id: string) => {
    try {
      setReceiptLoading(true);
      setReceipt(null);
      const data = await api.getWithdrawalReceipt(id);
      setReceipt(data ?? null);
    } catch {
      setReceipt({ error: true });
    } finally {
      setReceiptLoading(false);
    }
  }, []);

  const printReceipt = (r: any) => {
    const rows = (r?.trips ?? [])
      .map(
        (tr: any) =>
          `<tr><td>${new Date(tr.deliveredAt).toLocaleString('es-CR')}</td><td>${tr.merchant ?? ''}</td><td style="text-align:right">₡${Number(tr.trip ?? 0).toLocaleString('es-CR')}</td><td style="text-align:right">₡${Number(tr.payout ?? 0).toLocaleString('es-CR')}</td></tr>`,
      )
      .join('');
    const w = window.open('', '_blank', 'width=560');
    if (!w) return;
    w.document.write(
      `<html><head><title>Recibo ${r?.id ?? ''}</title><style>body{font-family:sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border-bottom:1px solid #ddd;padding:6px 4px;font-size:13px;text-align:left}tfoot td{font-weight:bold}</style></head><body><h2>Kiwi · Recibo de pago</h2><p>${r?.driver?.fullName ?? ''} · ${r?.driver?.phone ?? ''}</p><table><thead><tr><th>Fecha</th><th>Comercio</th><th>Viaje</th><th>Ganancia</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">Viajes: ${r?.tripCount ?? 0}</td><td>₡${Number(r?.tripsTotal ?? 0).toLocaleString('es-CR')}</td></tr><tr><td colspan="3">Monto pagado</td><td>₡${Number(r?.amount ?? 0).toLocaleString('es-CR')}</td></tr></tfoot></table></body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  useEffect(() => {
    void fetchPayroll(null);
    void fetchBalances();
  }, [fetchPayroll, fetchBalances]);

  useEffect(() => {
    if (selectedWithdrawal) void fetchReceipt(selectedWithdrawal.id);
    else setReceipt(null);
  }, [selectedWithdrawal, fetchReceipt]);

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(true);
      await api.approveWithdrawal(id, transactionId || undefined);
      setSelectedWithdrawal(null);
      setTransactionId('');
      fetchWithdrawals();
    } catch (err) {
      console.error('Failed to approve withdrawal:', err);
      alert(t('webadmin1.awith.approveError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      alert(t('webadmin1.awith.needReason'));
      return;
    }

    try {
      setActionLoading(true);
      await api.rejectWithdrawal(id, rejectReason);
      setSelectedWithdrawal(null);
      setShowRejectModal(false);
      setRejectReason('');
      fetchWithdrawals();
    } catch (err) {
      console.error('Failed to reject withdrawal:', err);
      alert(t('webadmin1.awith.rejectError'));
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString()}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    return STATUS_LABEL[status] ?? status;
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLOR[status] ?? 'bg-surface-100 text-surface-700';
  };

  const getStatusIcon = (status: string) => {
    return STATUS_ICON[status] ?? '❓';
  };

  // Filter withdrawals
  const filteredWithdrawals = withdrawals.filter(
    (w) => activeFilter === 'all' || w.status === activeFilter,
  );

  // Calculate totals
  const totalPending = withdrawals
    .filter((w) => w.status === 'pending')
    .reduce((sum, w) => sum + w.amount, 0);
  const totalProcessing = withdrawals
    .filter((w) => w.status === 'processing')
    .reduce((sum, w) => sum + w.amount, 0);

  if (loading && withdrawals.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            😕
          </motion.div>
          <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            {t('webadmin1.awith.loadTitle')}
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mb-6">{error}</p>
          <motion.button
            onClick={fetchWithdrawals}
            className="px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className="h-4 w-4 inline" /> {t('webadmin1.awith.retry')}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            <Coins className="h-6 w-6 inline" /> {t('webadmin1.awith.title')}
          </h1>
          <p className="text-surface-500 dark:text-surface-400">
            {t('webadmin1.awith.pendingCount', {
              n: withdrawals.filter((w) => w.status === 'pending').length,
            })}
          </p>
        </div>
        <motion.button
          onClick={fetchWithdrawals}
          className="px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw className="h-4 w-4 inline" /> {t('webadmin1.awith.refresh')}
        </motion.button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          className="rounded-2xl bg-yellow-50 dark:bg-yellow-900/30 p-4 shadow-soft dark:shadow-dark border border-yellow-200 dark:border-yellow-800"
          whileHover={{ y: -2 }}
        >
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            {t('webadmin1.awith.stats.pending')}
          </p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
            {formatCurrency(totalPending)}
          </p>
        </motion.div>
        <motion.div
          className="rounded-2xl bg-blue-50 dark:bg-blue-900/30 p-4 shadow-soft dark:shadow-dark border border-blue-200 dark:border-blue-800"
          whileHover={{ y: -2 }}
        >
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {t('webadmin1.awith.stats.processing')}
          </p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {formatCurrency(totalProcessing)}
          </p>
        </motion.div>
      </div>

      {/* Planilla semanal mar–lun (pago martes) */}
      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display font-bold text-surface-800 dark:text-surface-100">
              {t('webadmin1.awith.payrollTitle')}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {payroll?.weekStart && payroll?.weekEnd
                ? t('webadmin1.awith.payrollWeek', {
                    from: new Date(payroll.weekStart).toLocaleDateString('es-CR', {
                      day: 'numeric',
                      month: 'short',
                    }),
                    to: new Date(payroll.weekEnd).toLocaleDateString('es-CR', {
                      day: 'numeric',
                      month: 'short',
                    }),
                  })
                : '…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftWeek(-7)}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200"
            >
              {t('webadmin1.awith.payrollPrev')}
            </button>
            <button
              onClick={() => {
                setPayrollWeek(null);
                void fetchPayroll(null);
              }}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200"
            >
              {t('webadmin1.awith.payrollCurrent')}
            </button>
            <button
              onClick={() => shiftWeek(7)}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200"
            >
              {t('webadmin1.awith.payrollNext')}
            </button>
          </div>
        </div>

        {payrollMsg && (
          <p className="mt-2 text-sm font-medium text-kiwi-700 dark:text-kiwi-300">{payrollMsg}</p>
        )}

        <div className="mt-3 space-y-2">
          {payrollLoading ? (
            <p className="text-sm text-surface-500">…</p>
          ) : !payroll || (payroll.drivers ?? []).length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('webadmin1.awith.payrollEmpty')}
            </p>
          ) : (
            (payroll.drivers ?? []).map((d: any) => (
              <div
                key={d.driverId}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface-50 dark:bg-surface-700/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-surface-800 dark:text-surface-100">
                    {d.fullName || d.driverId.slice(0, 8)}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {t('webadmin1.awith.payrollTrips', { n: d.tripCount })} · ₡
                    {Number(d.totalPayout ?? 0).toLocaleString()}
                  </p>
                </div>
                {d.existingWithdrawal ? (
                  <span className="shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/50 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                    {t('webadmin1.awith.payrollExisting')} · {d.existingWithdrawal.status}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 px-3 py-1 text-xs font-medium text-kiwi-700 dark:text-kiwi-300">
                    {t('webadmin1.awith.payrollTotal', {
                      amount: Number(d.totalPayout ?? 0).toLocaleString(),
                    })}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        <button
          onClick={handleGeneratePayroll}
          disabled={generating || !(payroll?.drivers ?? []).some((d: any) => !d.existingWithdrawal)}
          className="mt-3 w-full rounded-xl bg-kiwi-700 py-3 text-sm font-bold text-white hover:bg-kiwi-800 disabled:opacity-50"
        >
          {generating
            ? t('webadmin1.awith.payrollGenerating')
            : t('webadmin1.awith.payrollGenerate')}
        </button>
      </motion.div>

      {/* Saldos sin liquidar (limpieza pre-lanzamiento) */}
      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="font-display font-bold text-surface-800 dark:text-surface-100">
          {t('webadmin1.awith.balancesTitle')}
        </p>
        <p className="text-xs text-surface-500 dark:text-surface-400">
          {t('webadmin1.awith.balancesHint')}
        </p>
        {balancesMsg && (
          <p className="mt-2 text-sm font-medium text-kiwi-700 dark:text-kiwi-300">{balancesMsg}</p>
        )}
        <div className="mt-3 space-y-2">
          {balancesLoading ? (
            <p className="text-sm text-surface-500">…</p>
          ) : balances.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('webadmin1.awith.balancesEmpty')}
            </p>
          ) : (
            balances.map((b: any) => (
              <div
                key={b.driverId}
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-50 dark:bg-surface-700/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-surface-800 dark:text-surface-100">
                    {b.fullName || b.driverId.slice(0, 8)}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {t('webadmin1.awith.balancesTrips', { n: b.tripCount ?? 0 })} · ₡
                    {Number(b.totalPayout ?? 0).toLocaleString()}
                    {(b.pendingCount ?? 0) > 0 &&
                      ` · ${t('webadmin1.awith.balancesPending', { n: b.pendingCount })}`}
                  </p>
                </div>
                <button
                  onClick={() =>
                    void handleZeroOut(b.driverId, b.fullName || b.driverId.slice(0, 8))
                  }
                  disabled={zeroingId === b.driverId || (b.pendingCount ?? 0) > 0}
                  className="shrink-0 rounded-lg bg-surface-200 dark:bg-surface-600 px-3 py-2 text-xs font-semibold text-surface-700 dark:text-surface-200 hover:bg-surface-300 dark:hover:bg-surface-500 disabled:opacity-50"
                >
                  {zeroingId === b.driverId
                    ? t('webadmin1.awith.zeroing')
                    : t('webadmin1.awith.zeroOut')}
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTER_TABS.map((tab) => {
          const TabIcon = tab.icon as any;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeFilter === tab.id
                  ? 'bg-kiwi-700 text-white'
                  : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <TabIcon className="mr-1 h-4 w-4 inline" />
              {tab.label}
            </motion.button>
          );
        })}
      </div>

      {/* Withdrawals List */}
      {filteredWithdrawals.length === 0 ? (
        <motion.div className="text-center py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <span className="text-5xl mb-4 block">📭</span>
          <p className="text-surface-500 dark:text-surface-400">{t('webadmin1.awith.empty')}</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {filteredWithdrawals.map((withdrawal, index) => {
            const StatusIcon = getStatusIcon(withdrawal.status) as any;

            return (
              <motion.div
                key={withdrawal.id}
                className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 cursor-pointer hover:shadow-medium dark:hover:shadow-dark transition-all"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedWithdrawal(withdrawal)}
                whileHover={{ y: -2 }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-900/50 text-2xl">
                      {withdrawal.paymentMethod === 'sinpe' ? (
                        <Smartphone className="h-6 w-6" />
                      ) : (
                        '🏦'
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-surface-800 dark:text-surface-100">
                        {withdrawal.driver.fullName}
                      </p>
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {withdrawal.driver.user.email}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(withdrawal.status)}`}
                  >
                    {typeof StatusIcon === 'string' ? (
                      <span>{StatusIcon}</span>
                    ) : (
                      <StatusIcon className="h-4 w-4 inline" />
                    )}{' '}
                    {getStatusLabel(withdrawal.status)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-surface-500 dark:text-surface-400">
                    <span>
                      <Calendar className="h-4 w-4 inline" /> {formatDate(withdrawal.createdAt)}
                    </span>
                    <span>
                      {withdrawal.paymentMethod === 'sinpe' ? (
                        <>
                          <Smartphone className="h-4 w-4 inline" />{' '}
                          {t('webadmin1.awith.methodSinpe')}
                        </>
                      ) : (
                        t('webadmin1.awith.methodBank')
                      )}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-kiwi-700 dark:text-kiwi-400">
                    {formatCurrency(withdrawal.amount)}
                  </span>
                </div>

                {/* Quick Actions for Pending */}
                {withdrawal.status === 'pending' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
                    <button
                      className="flex-1 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWithdrawal(withdrawal);
                        setShowRejectModal(true);
                      }}
                    >
                      <X className="h-4 w-4 inline" /> {t('webadmin1.awith.reject')}
                    </button>
                    <button
                      className="flex-1 py-2 text-sm font-medium bg-kiwi-700 text-white rounded-lg hover:bg-kiwi-800 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(withdrawal.id);
                      }}
                    >
                      <Check className="h-4 w-4 inline" /> {t('webadmin1.awith.approve')}
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Withdrawal Detail Modal */}
      <AnimatePresence>
        {selectedWithdrawal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedWithdrawal(null)}
          >
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 p-6 z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                    <Coins className="h-5 w-5 inline" /> {t('webadmin1.awith.detailTitle')}
                  </h3>
                  <button
                    onClick={() => setSelectedWithdrawal(null)}
                    className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Amount */}
                <div className="text-center py-4">
                  <p className="text-4xl font-bold text-kiwi-700 dark:text-kiwi-400">
                    {formatCurrency(selectedWithdrawal.amount)}
                  </p>
                  <span
                    className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedWithdrawal.status)}`}
                  >
                    {(() => {
                      const ModalStatusIcon = getStatusIcon(selectedWithdrawal.status) as any;
                      return typeof ModalStatusIcon === 'string' ? (
                        <span>{ModalStatusIcon}</span>
                      ) : (
                        <ModalStatusIcon className="h-4 w-4 inline" />
                      );
                    })()}{' '}
                    {getStatusLabel(selectedWithdrawal.status)}
                  </span>
                </div>

                {/* Driver Info */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                  <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">
                    {t('webadmin1.awith.driver')}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400 font-bold">
                      {selectedWithdrawal.driver.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-surface-800 dark:text-surface-100">
                        {selectedWithdrawal.driver.fullName}
                      </p>
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {selectedWithdrawal.driver.user.email} • <Star className="h-4 w-4 inline" />{' '}
                        {selectedWithdrawal.driver.rating}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                  <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">
                    {selectedWithdrawal.paymentMethod === 'sinpe' ? (
                      <>
                        <Smartphone className="h-4 w-4 inline" /> {t('webadmin1.awith.sinpeData')}
                      </>
                    ) : (
                      t('webadmin1.awith.bankData')
                    )}
                  </p>
                  {selectedWithdrawal.paymentMethod === 'sinpe' ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-surface-500 dark:text-surface-400">
                          {t('webadmin1.awith.phone')}
                        </span>
                        <span className="font-medium text-surface-800 dark:text-surface-100">
                          {selectedWithdrawal.sinpePhone || t('webadmin1.awith.notSpecified')}
                        </span>
                      </div>
                      {selectedWithdrawal.sinpeName && (
                        <div className="flex justify-between">
                          <span className="text-surface-500 dark:text-surface-400">
                            {t('webadmin1.awith.name')}
                          </span>
                          <span className="font-medium text-surface-800 dark:text-surface-100">
                            {selectedWithdrawal.sinpeName}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-surface-500 dark:text-surface-400">
                          {t('webadmin1.awith.bank')}
                        </span>
                        <span className="font-medium text-surface-800 dark:text-surface-100">
                          {selectedWithdrawal.bankName || t('webadmin1.awith.notSpecified')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-500 dark:text-surface-400">
                          {t('webadmin1.awith.account')}
                        </span>
                        <span className="font-medium text-surface-800 dark:text-surface-100 font-mono">
                          {selectedWithdrawal.accountNumber || t('webadmin1.awith.notSpecified')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-500 dark:text-surface-400">
                          {t('webadmin1.awith.holder')}
                        </span>
                        <span className="font-medium text-surface-800 dark:text-surface-100">
                          {selectedWithdrawal.accountHolder || t('webadmin1.awith.notSpecified')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recibo: viajes pagados */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      {t('webadmin1.awith.receiptTitle')}
                    </p>
                    {receipt && !receipt.error && (receipt.trips ?? []).length > 0 && (
                      <button
                        onClick={() => printReceipt(receipt)}
                        className="text-xs font-semibold text-kiwi-700 dark:text-kiwi-300 hover:underline"
                      >
                        {t('webadmin1.awith.receiptPrint')}
                      </button>
                    )}
                  </div>
                  {receiptLoading ? (
                    <p className="text-sm text-surface-500">…</p>
                  ) : !receipt || receipt.error || (receipt.trips ?? []).length === 0 ? (
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      {t('webadmin1.awith.receiptEmpty')}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {(receipt.trips ?? []).slice(0, 30).map((tr: any) => (
                        <div
                          key={tr.orderId}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="min-w-0 truncate text-surface-700 dark:text-surface-200">
                            {tr.deliveredAt
                              ? new Date(tr.deliveredAt).toLocaleDateString('es-CR', {
                                  day: 'numeric',
                                  month: 'short',
                                })
                              : ''}{' '}
                            · {tr.merchant ?? tr.orderId.slice(0, 8)}
                          </span>
                          <span className="shrink-0 font-medium text-surface-800 dark:text-surface-100">
                            ₡{Number(tr.payout ?? 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t border-surface-200 dark:border-surface-600 pt-2 text-sm font-bold">
                        <span>
                          {t('webadmin1.awith.receiptTrips', { n: receipt.tripCount ?? 0 })}
                        </span>
                        <span className="text-kiwi-700 dark:text-kiwi-300">
                          ₡{Number(receipt.tripsTotal ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-surface-500 dark:text-surface-400">
                          {t('webadmin1.awith.receiptAmount')}
                        </span>
                        <span className="font-bold text-surface-800 dark:text-surface-100">
                          ₡{Number(receipt.amount ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Transaction ID (if processing/completed) */}
                {(selectedWithdrawal.status === 'processing' ||
                  selectedWithdrawal.status === 'completed') && (
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">
                      {t('webadmin1.awith.txId')}
                    </p>
                    <p className="font-mono text-surface-800 dark:text-surface-100">
                      {selectedWithdrawal.transactionId || t('webadmin1.awith.notRecorded')}
                    </p>
                  </div>
                )}

                {/* Rejection Reason (if rejected) */}
                {selectedWithdrawal.status === 'rejected' && selectedWithdrawal.rejectionReason && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                      {t('webadmin1.awith.rejectReasonLabel')}
                    </p>
                    <p className="text-red-700 dark:text-red-300">
                      {selectedWithdrawal.rejectionReason}
                    </p>
                  </div>
                )}

                {/* Dates */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-surface-500 dark:text-surface-400">
                        {t('webadmin1.awith.requested')}
                      </span>
                      <span className="text-surface-800 dark:text-surface-100">
                        {formatDate(selectedWithdrawal.createdAt)}
                      </span>
                    </div>
                    {selectedWithdrawal.processedAt && (
                      <div className="flex justify-between">
                        <span className="text-surface-500 dark:text-surface-400">
                          {t('webadmin1.awith.processed')}
                        </span>
                        <span className="text-surface-800 dark:text-surface-100">
                          {formatDate(selectedWithdrawal.processedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {selectedWithdrawal.status === 'pending' && (
                  <div className="space-y-3 pt-4 border-t border-surface-200 dark:border-surface-700">
                    <div>
                      <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1">
                        {t('webadmin1.awith.txIdOptional')}
                      </label>
                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder={t('webadmin1.awith.txPh')}
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 transition-all"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        className="flex-1 py-3 px-4 text-sm font-medium border-2 border-red-500 text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading}
                      >
                        <X className="h-4 w-4 inline" /> {t('webadmin1.awith.reject')}
                      </button>
                      <button
                        className="flex-1 py-3 px-4 text-sm font-medium bg-kiwi-700 text-white rounded-xl hover:bg-kiwi-800 transition-colors"
                        onClick={() => handleApprove(selectedWithdrawal.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          t('webadmin1.awith.processing')
                        ) : (
                          <>
                            <Check className="h-4 w-4 inline" /> {t('webadmin1.awith.approve')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Reason Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl max-w-md w-full shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
                  <X className="h-5 w-5 inline" /> {t('webadmin1.awith.rejectTitle')}
                </h3>
                <p className="text-surface-500 dark:text-surface-400 mb-4">
                  {t('webadmin1.awith.rejectHint')}
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('webadmin1.awith.rejectPh')}
                  className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none h-24"
                />
                <div className="flex gap-3 mt-4">
                  <button
                    className="flex-1 py-3 px-4 text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason('');
                    }}
                  >
                    {t('webadmin1.awith.cancel')}
                  </button>
                  <button
                    className="flex-1 py-3 px-4 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                    onClick={() => selectedWithdrawal && handleReject(selectedWithdrawal.id)}
                    disabled={actionLoading || !rejectReason.trim()}
                  >
                    {actionLoading ? t('webadmin1.awith.processing') : t('webadmin1.awith.reject')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
