// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { HandCoins, Plus, X, Trash2, Calculator } from 'lucide-react';
import { api, useTranslations } from '@kiwi/ui';

interface DebtSummary {
  total: number;
  downPayment: number;
  paid: number;
  paidTotal: number;
  balance: number;
  pct: number;
  settled: boolean;
  monthly: number;
  monthsLeft: number;
  payoffAt: string | null;
  byKind: Record<string, number>;
  byDriver: Array<{ driverId: string; name: string; total: number }>;
}

interface Debt {
  id: string;
  title: string;
  description?: string | null;
  totalAmount: number;
  monthlyAmount: number;
  downPayment: number;
  startDate: string;
  termMonths?: number | null;
  createdAt: string;
  summary?: DebtSummary;
}

interface DebtDetail extends Debt {
  summary: DebtSummary;
  payments: Array<{
    id: string;
    amount: number;
    kind: string;
    driverId?: string | null;
    driverName?: string | null;
    note?: string | null;
    paidAt: string;
  }>;
}

const crc = (n: number) => `₡${Number(n || 0).toLocaleString('es-CR')}`;
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
const fmtMonth = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' }) : '—';

export default function AdminDebtsPage() {
  const { t } = useTranslations();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DebtDetail | null>(null);
  const [drivers, setDrivers] = useState<Array<{ id: string; fullName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form nueva deuda
  const [showNew, setShowNew] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fTotal, setFTotal] = useState('');
  const [fMonthly, setFMonthly] = useState('');
  const [fDown, setFDown] = useState('');
  const [fStart, setFStart] = useState(new Date().toISOString().split('T')[0]);
  const [fTerm, setFTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form pago
  const [pAmount, setPAmount] = useState('');
  const [pKind, setPKind] = useState<'cuota' | 'aporte' | 'extra'>('cuota');
  const [pDriver, setPDriver] = useState('');
  const [pNote, setPNote] = useState('');
  const [pDate, setPDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Simulador "pagarla más barato"
  const [extra, setExtra] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDebts();
      const list: Debt[] = Array.isArray(res) ? res : [];
      setDebts(list);
      if (list.length > 0) setSelectedId((prev) => prev ?? list[0].id);
    } catch (e: any) {
      setError(e?.message || t('webadmin2.adebts.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const res = await api.getDebt(id);
        setDetail(res);
      } catch (e: any) {
        setError(e?.message || t('webadmin2.adebts.loadFailed'));
      }
    },
    [t],
  );

  useEffect(() => {
    loadList();
    api
      .getDebtDrivers()
      .then(setDrivers)
      .catch(() => setDrivers([]));
  }, [loadList]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const createDebt = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      const res = await api.createDebt({
        title: fTitle.trim(),
        description: fDesc.trim() || undefined,
        totalAmount: Number(fTotal),
        monthlyAmount: Number(fMonthly),
        downPayment: fDown.trim() ? Number(fDown) : 0,
        startDate: fStart,
        termMonths: fTerm.trim() ? Number(fTerm) : undefined,
      });
      setShowNew(false);
      setFTitle('');
      setFDesc('');
      setFTotal('');
      setFMonthly('');
      setFDown('');
      setFTerm('');
      await loadList();
      if (res?.id) {
        setSelectedId(res.id);
        await loadDetail(res.id);
      }
    } catch (e: any) {
      setCreateError(e?.message || t('webadmin2.adebts.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const addPayment = async () => {
    setPayError(null);
    setSaving(true);
    try {
      await api.addDebtPayment(selectedId!, {
        amount: Number(pAmount),
        kind: pKind,
        driverId: pKind === 'aporte' && pDriver ? pDriver : undefined,
        note: pNote.trim() || undefined,
        paidAt: pDate || undefined,
      });
      setPAmount('');
      setPDriver('');
      setPNote('');
      await loadDetail(selectedId!);
      await loadList();
    } catch (e: any) {
      setPayError(e?.message || t('webadmin2.adebts.addFailed'));
    } finally {
      setSaving(false);
    }
  };

  const removePayment = async (paymentId: string, amount: number) => {
    if (
      !window.confirm(
        t('webadmin2.adebts.deleteConfirm', { amount: Number(amount).toLocaleString() }),
      )
    )
      return;
    try {
      await api.deleteDebtPayment(selectedId!, paymentId);
      await loadDetail(selectedId!);
      await loadList();
    } catch (e: any) {
      setPayError(e?.message || t('webadmin2.adebts.deleteFailed'));
    }
  };

  // Simulador: meses con cuota sola vs cuota + extra.
  const sim =
    detail && extra.trim() && Number(extra) > 0
      ? (() => {
          const b = detail.summary.balance;
          const m = detail.summary.monthly;
          const e = Number(extra);
          const base = m > 0 && b > 0 ? Math.ceil(b / m - 1e-9) : 0;
          const fast = m + e > 0 && b > 0 ? Math.ceil(b / (m + e) - 1e-9) : 0;
          const saved = Math.max(0, base - fast);
          const at = new Date();
          const finish = new Date(at.getFullYear(), at.getMonth() + fast, 1).toISOString();
          return { base, fast, saved, finish };
        })()
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            <HandCoins className="h-6 w-6" /> {t('webadmin2.adebts.title')}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {t('webadmin2.adebts.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-kiwi-700 px-4 text-sm font-semibold text-white"
        >
          {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showNew ? t('webadmin2.adebts.cancel') : t('webadmin2.adebts.newDebt')}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-surface-500">{t('webadmin2.adebts.loading')}</p>
      ) : debts.length === 0 && !showNew ? (
        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-8 text-center">
          <HandCoins className="h-10 w-10 mx-auto mb-2 text-surface-300" />
          <p className="text-sm font-medium">{t('webadmin2.adebts.empty')}</p>
          <p className="mt-1 text-xs text-surface-500">{t('webadmin2.adebts.emptyHint')}</p>
        </div>
      ) : (
        <>
          {debts.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {debts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                    d.id === selectedId
                      ? 'bg-kiwi-700 text-white'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                  }`}
                >
                  {d.title}
                </button>
              ))}
            </div>
          )}

          {showNew && (
            <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4 space-y-3">
              <div>
                <label
                  htmlFor="debt-title"
                  className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                >
                  {t('webadmin2.adebts.titleLabel')}
                </label>
                <input
                  id="debt-title"
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  placeholder={t('webadmin2.adebts.titlePh')}
                  className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="debt-desc"
                  className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                >
                  {t('webadmin2.adebts.descLabel')}
                </label>
                <input
                  id="debt-desc"
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  placeholder={t('webadmin2.adebts.descPh')}
                  className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="debt-total"
                    className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                  >
                    {t('webadmin2.adebts.totalLabel')}
                  </label>
                  <input
                    id="debt-total"
                    type="number"
                    min="1"
                    value={fTotal}
                    onChange={(e) => setFTotal(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="debt-monthly"
                    className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                  >
                    {t('webadmin2.adebts.monthlyLabel')}
                  </label>
                  <input
                    id="debt-monthly"
                    type="number"
                    min="1"
                    value={fMonthly}
                    onChange={(e) => setFMonthly(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="debt-down"
                    className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                  >
                    {t('webadmin2.adebts.downLabel')}
                  </label>
                  <input
                    id="debt-down"
                    type="number"
                    min="0"
                    value={fDown}
                    onChange={(e) => setFDown(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="debt-term"
                    className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                  >
                    {t('webadmin2.adebts.termLabel')}
                  </label>
                  <input
                    id="debt-term"
                    type="number"
                    min="1"
                    value={fTerm}
                    onChange={(e) => setFTerm(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="debt-start"
                  className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                >
                  {t('webadmin2.adebts.startLabel')}
                </label>
                <input
                  id="debt-start"
                  type="date"
                  value={fStart}
                  onChange={(e) => setFStart(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                />
              </div>
              {createError && <p className="text-xs text-red-600">{createError}</p>}
              <button
                onClick={createDebt}
                disabled={creating || !fTitle.trim() || !fTotal || !fMonthly || !fStart}
                className="min-h-[44px] w-full rounded-xl bg-kiwi-700 text-sm font-semibold text-white disabled:opacity-40"
              >
                {t('webadmin2.adebts.create')}
              </button>
            </div>
          )}

          {detail && (
            <>
              {/* Resumen */}
              <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold text-surface-800 dark:text-surface-100">
                    {detail.title}
                  </h2>
                  {detail.summary.settled ? (
                    <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-xs font-bold text-green-700 dark:text-green-300">
                      {t('webadmin2.adebts.settled')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 px-3 py-1 text-xs font-bold text-gold-800 dark:text-gold-200">
                      {t('webadmin2.adebts.monthsLeft', { n: detail.summary.monthsLeft })}
                    </span>
                  )}
                </div>
                {detail.description && (
                  <p className="mt-1 text-xs text-surface-500">{detail.description}</p>
                )}
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-700">
                  <div
                    className="h-full rounded-full bg-kiwi-600 transition-all"
                    style={{ width: `${detail.summary.pct}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-xl bg-surface-50 dark:bg-surface-900 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-surface-500">
                      {t('webadmin2.adebts.paid')}
                    </p>
                    <p className="font-bold text-kiwi-700">{crc(detail.summary.paidTotal)}</p>
                    <p className="text-[11px] text-surface-500">
                      {t('webadmin2.adebts.ofTotal', { total: crc(detail.summary.total) })}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-50 dark:bg-surface-900 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-surface-500">
                      {t('webadmin2.adebts.balance')}
                    </p>
                    <p className="font-bold">{crc(detail.summary.balance)}</p>
                    <p className="text-[11px] text-surface-500">{detail.summary.pct}%</p>
                  </div>
                  <div className="rounded-xl bg-surface-50 dark:bg-surface-900 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-surface-500">
                      {t('webadmin2.adebts.monthly')}
                    </p>
                    <p className="font-bold">{crc(detail.summary.monthly)}</p>
                  </div>
                  <div className="rounded-xl bg-surface-50 dark:bg-surface-900 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-surface-500">
                      {t('webadmin2.adebts.payoff')}
                    </p>
                    <p className="font-bold capitalize">{fmtMonth(detail.summary.payoffAt)}</p>
                  </div>
                </div>
                {detail.summary.settled && (
                  <p className="mt-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-xs text-green-800 dark:text-green-200">
                    {t('webadmin2.adebts.profitNote', {
                      paid: crc(detail.summary.paidTotal),
                      total: crc(detail.summary.total),
                    })}
                  </p>
                )}
              </div>

              {/* Aportes por repartidor */}
              <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4">
                <h3 className="mb-2 text-sm font-bold text-surface-800 dark:text-surface-100">
                  {t('webadmin2.adebts.contributors')}
                </h3>
                {detail.summary.byDriver.length === 0 ? (
                  <p className="text-xs text-surface-500">{t('webadmin2.adebts.noContributors')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.summary.byDriver.map((c) => (
                      <li key={c.driverId} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-surface-700 dark:text-surface-200">
                          {c.name}
                        </span>
                        <span className="font-bold text-kiwi-700">{crc(c.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Simulador */}
              {!detail.summary.settled && (
                <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-surface-800 dark:text-surface-100">
                    <Calculator className="h-4 w-4" /> {t('webadmin2.adebts.simulator')}
                  </h3>
                  <p className="mt-0.5 text-xs text-surface-500">
                    {t('webadmin2.adebts.simulatorHint')}
                  </p>
                  <div className="mt-2">
                    <label
                      htmlFor="debt-extra"
                      className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                    >
                      {t('webadmin2.adebts.extraLabel')}
                    </label>
                    <input
                      id="debt-extra"
                      type="number"
                      min="0"
                      value={extra}
                      onChange={(e) => setExtra(e.target.value)}
                      className="min-h-[44px] w-full max-w-xs rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                    />
                  </div>
                  {sim && sim.saved > 0 && (
                    <p className="mt-2 text-xs font-medium text-kiwi-700">
                      {t('webadmin2.adebts.simResult', {
                        date: fmtMonth(sim.finish),
                        n: sim.saved,
                      })}
                    </p>
                  )}
                  {sim && sim.saved <= 0 && (
                    <p className="mt-2 text-xs text-surface-500">{t('webadmin2.adebts.simSame')}</p>
                  )}
                </div>
              )}

              {/* Registrar pago */}
              <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4 space-y-3">
                <h3 className="text-sm font-bold text-surface-800 dark:text-surface-100">
                  {t('webadmin2.adebts.addPayment')}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['cuota', 'aporte', 'extra'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setPKind(k)}
                      className={`min-h-[44px] rounded-xl text-sm font-medium ${
                        pKind === k
                          ? 'bg-kiwi-700 text-white'
                          : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300'
                      }`}
                    >
                      {t(`webadmin2.adebts.kind${k[0].toUpperCase()}${k.slice(1)}` as any)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="pay-amount"
                      className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                    >
                      {t('webadmin2.adebts.amountLabel')}
                    </label>
                    <input
                      id="pay-amount"
                      type="number"
                      min="1"
                      value={pAmount}
                      onChange={(e) => setPAmount(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pay-date"
                      className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                    >
                      {t('webadmin2.adebts.dateLabel')}
                    </label>
                    <input
                      id="pay-date"
                      type="date"
                      value={pDate}
                      onChange={(e) => setPDate(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                    />
                  </div>
                </div>
                {pKind === 'aporte' && (
                  <div>
                    <label
                      htmlFor="pay-driver"
                      className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                    >
                      {t('webadmin2.adebts.driverLabel')}
                    </label>
                    <select
                      id="pay-driver"
                      value={pDriver}
                      onChange={(e) => setPDriver(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                    >
                      <option value="">{t('webadmin2.adebts.driverAny')}</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label
                    htmlFor="pay-note"
                    className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                  >
                    {t('webadmin2.adebts.noteLabel')}
                  </label>
                  <input
                    id="pay-note"
                    value={pNote}
                    onChange={(e) => setPNote(e.target.value)}
                    placeholder={t('webadmin2.adebts.notePh')}
                    className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                  />
                </div>
                {payError && <p className="text-xs text-red-600">{payError}</p>}
                <button
                  onClick={addPayment}
                  disabled={saving || !pAmount || Number(pAmount) <= 0}
                  className="min-h-[44px] w-full rounded-xl bg-kiwi-700 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {t('webadmin2.adebts.addPayment')}
                </button>
              </div>

              {/* Historial */}
              <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4">
                <h3 className="mb-2 text-sm font-bold text-surface-800 dark:text-surface-100">
                  {t('webadmin2.adebts.payments')}
                </h3>
                {detail.payments.length === 0 ? (
                  <p className="text-xs text-surface-500">{t('webadmin2.adebts.noPayments')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <tbody>
                        {detail.payments.map((p) => (
                          <tr
                            key={p.id}
                            className="border-t border-surface-100 dark:border-surface-700 first:border-0"
                          >
                            <td className="py-2.5 pr-2">
                              <p className="font-medium text-surface-800 dark:text-surface-100">
                                {fmtDate(p.paidAt)}
                              </p>
                              <p className="text-[11px] text-surface-500">
                                {t(`webadmin2.adebts.kindName.${p.kind}` as any)}
                                {p.driverName ? ` · ${p.driverName}` : ''}
                                {p.note ? ` · ${p.note}` : ''}
                              </p>
                            </td>
                            <td className="py-2.5 pr-2 text-right font-bold">{crc(p.amount)}</td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => removePayment(p.id, p.amount)}
                                aria-label={t('webadmin2.adebts.deleteConfirm', {
                                  amount: Number(p.amount).toLocaleString(),
                                })}
                                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-surface-400 hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
