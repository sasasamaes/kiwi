// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bike, Plus, Trash2 } from 'lucide-react';
import { api, useTranslations } from '@kiwi/ui';

interface ContractSummary {
  paid: number;
  weeksElapsed: number;
  expected: number;
  due: number;
}

interface Contract {
  id: string;
  debtId: string | null;
  debtTitle: string | null;
  driverId: string;
  driverName: string;
  weeklyPrice: number;
  deposit: number;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'finished' | 'cancelled';
  notes: string | null;
  createdAt: string;
  summary: ContractSummary;
}

interface ContractDetail extends Contract {
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    note: string | null;
    createdAt: string;
  }>;
}

const crc = (n: number) => `₡${Number(n || 0).toLocaleString('es-CR')}`;
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  finished: 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export default function AdminRentalsPage() {
  const { t } = useTranslations();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [drivers, setDrivers] = useState<Array<{ id: string; fullName: string }>>([]);
  const [debts, setDebts] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Nuevo contrato
  const [showNew, setShowNew] = useState(false);
  const [fDriver, setFDriver] = useState('');
  const [fDebt, setFDebt] = useState('');
  const [fWeekly, setFWeekly] = useState('');
  const [fDeposit, setFDeposit] = useState('');
  const [fStart, setFStart] = useState(new Date().toISOString().split('T')[0]);
  const [fNotes, setFNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Pago
  const [pAmount, setPAmount] = useState('');
  const [pDate, setPDate] = useState(new Date().toISOString().split('T')[0]);
  const [pNote, setPNote] = useState('');
  const [savingPay, setSavingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Calculadora "¿en cuánto alquilarla?"
  const [cMonthly, setCMonthly] = useState('45000');
  const [cInsurance, setCInsurance] = useState('0');
  const [cMarchamo, setCMarchamo] = useState('120000');
  const [cMaint, setCMaint] = useState('15000');
  const [cOther, setCOther] = useState('0');
  const [cMargin, setCMargin] = useState('20');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const st = await api.getRentalsStatus();
      setEnabled(!!st?.enabled);
      if (!st?.enabled) {
        setContracts([]);
        return;
      }
      const res = await api.getRentalContracts();
      const list: Contract[] = Array.isArray(res) ? res : [];
      setContracts(list);
      if (list.length > 0) setSelectedId((prev) => prev ?? list[0].id);
    } catch (e: any) {
      setError(e?.message || t('webadmin2.arent.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        setDetail(await api.getRentalContract(id));
      } catch (e: any) {
        setError(e?.message || t('webadmin2.arent.loadFailed'));
      }
    },
    [t],
  );

  useEffect(() => {
    loadList();
    api
      .getDriversAdminList()
      .then((r: any) => setDrivers(Array.isArray(r) ? r : []))
      .catch(() => setDrivers([]));
    api
      .getDebts()
      .then((r: any) => setDebts(Array.isArray(r) ? r : []))
      .catch(() => setDebts([]));
  }, [loadList]);

  useEffect(() => {
    if (selectedId && enabled) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, enabled, loadDetail]);

  const createContract = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      const res = await api.createRentalContract({
        driverId: fDriver,
        debtId: fDebt || undefined,
        weeklyPrice: Number(fWeekly),
        deposit: fDeposit.trim() ? Number(fDeposit) : 0,
        startDate: fStart,
        notes: fNotes.trim() || undefined,
      });
      setShowNew(false);
      setFDriver('');
      setFDebt('');
      setFWeekly('');
      setFDeposit('');
      setFNotes('');
      await loadList();
      if (res?.id) {
        setSelectedId(res.id);
        await loadDetail(res.id);
      }
    } catch (e: any) {
      setCreateError(e?.message || t('webadmin2.arent.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const closeContract = async (id: string, how: 'finish' | 'cancel') => {
    const msg =
      how === 'finish' ? t('webadmin2.arent.finishConfirm') : t('webadmin2.arent.cancelConfirm');
    if (!window.confirm(msg)) return;
    try {
      if (how === 'finish') await api.finishRentalContract(id);
      else await api.cancelRentalContract(id);
      await loadDetail(id);
      await loadList();
    } catch (e: any) {
      setError(e?.message || t('webadmin2.arent.actionFailed'));
    }
  };

  const addPayment = async () => {
    if (!selectedId) return;
    setPayError(null);
    setSavingPay(true);
    try {
      await api.addRentalPayment(selectedId, {
        amount: Number(pAmount),
        paidAt: pDate || undefined,
        note: pNote.trim() || undefined,
      });
      setPAmount('');
      setPNote('');
      await loadDetail(selectedId);
      await loadList();
    } catch (e: any) {
      setPayError(e?.message || t('webadmin2.arent.addFailed'));
    } finally {
      setSavingPay(false);
    }
  };

  const removePayment = async (paymentId: string, amount: number) => {
    if (!selectedId) return;
    if (
      !window.confirm(
        t('webadmin2.arent.deleteConfirm', { amount: Number(amount).toLocaleString() }),
      )
    )
      return;
    try {
      await api.deleteRentalPayment(selectedId, paymentId);
      await loadDetail(selectedId);
      await loadList();
    } catch (e: any) {
      setPayError(e?.message || t('webadmin2.arent.addFailed'));
    }
  };

  // Calculadora: costos mensuales → precio semanal con margen.
  const monthlyTotal =
    (Number(cMonthly) || 0) +
    (Number(cInsurance) || 0) / 12 +
    (Number(cMarchamo) || 0) / 12 +
    (Number(cMaint) || 0) +
    (Number(cOther) || 0);
  const suggestedWeekly =
    Math.round(((monthlyTotal / 4.33) * (1 + (Number(cMargin) || 0) / 100)) / 100) * 100;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-surface-200 dark:bg-surface-800" />
        <div className="h-48 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800" />
      </div>
    );
  }

  if (error && enabled !== false) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-soft dark:bg-surface-800">
        <p className="mb-4 text-sm text-surface-500">{error}</p>
        <button
          onClick={loadList}
          className="rounded-xl bg-kiwi-700 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (enabled === false) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-soft dark:bg-surface-800">
        <Bike className="h-12 w-12 mx-auto mb-3 text-surface-300" />
        <h1 className="text-lg font-bold text-surface-800 dark:text-surface-100">
          {t('webadmin2.arent.disabled')}
        </h1>
        <p className="mt-2 text-sm text-surface-500">{t('webadmin2.arent.disabledHint')}</p>
      </div>
    );
  }

  const selected = contracts.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-display font-bold text-surface-800 dark:text-surface-100">
            <Bike className="h-5 w-5" /> {t('webadmin2.arent.title')}
          </h1>
          <p className="text-sm text-surface-500">{t('webadmin2.arent.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-kiwi-700 px-4 py-2 text-sm font-semibold text-white hover:bg-kiwi-800"
        >
          <Plus className="h-4 w-4" /> {t('webadmin2.arent.newContract')}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                {t('webadmin2.arent.driverLabel')}
              </span>
              <select
                value={fDriver}
                onChange={(e) => setFDriver(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              >
                <option value="">{t('webadmin2.arent.pickDriver')}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                {t('webadmin2.arent.bikeLabel')}
              </span>
              <select
                value={fDebt}
                onChange={(e) => setFDebt(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              >
                <option value="">{t('webadmin2.arent.noBike')}</option>
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                {t('webadmin2.arent.weeklyLabel')}
              </span>
              <input
                type="number"
                min={1}
                value={fWeekly}
                onChange={(e) => setFWeekly(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                {t('webadmin2.arent.depositLabel')}
              </span>
              <input
                type="number"
                min={0}
                value={fDeposit}
                onChange={(e) => setFDeposit(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                {t('webadmin2.arent.startLabel')}
              </span>
              <input
                type="date"
                value={fStart}
                onChange={(e) => setFStart(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                {t('webadmin2.arent.notesLabel')}
              </span>
              <input
                value={fNotes}
                onChange={(e) => setFNotes(e.target.value)}
                placeholder={t('webadmin2.arent.notesPh')}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
            </label>
          </div>
          {createError && <p className="mt-2 text-xs text-red-600">{createError}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={createContract}
              disabled={creating || !fDriver || !fWeekly}
              className="rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {creating ? '…' : t('webadmin2.arent.create')}
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="rounded-xl px-4 py-2.5 text-sm text-surface-500"
            >
              {t('webadmin2.arent.cancel')}
            </button>
          </div>
        </div>
      )}

      {contracts.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-soft dark:bg-surface-800">
          <Bike className="h-10 w-10 mx-auto mb-2 text-surface-300" />
          <p className="text-sm text-surface-500">{t('webadmin2.arent.empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {contracts.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded-2xl border p-4 text-left shadow-soft ${
                  c.id === selectedId
                    ? 'border-kiwi-600 bg-kiwi-50/60 dark:bg-kiwi-900/20'
                    : 'bg-white border-surface-200/60 dark:bg-surface-800 dark:border-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-surface-800 dark:text-surface-100">
                    {c.driverName}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status] ?? ''}`}
                  >
                    {c.status === 'active'
                      ? t('webadmin2.arent.active')
                      : c.status === 'finished'
                        ? t('webadmin2.arent.finished')
                        : t('webadmin2.arent.cancelled')}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-surface-500">
                  {c.debtTitle ?? ''} · {crc(c.weeklyPrice)}/sem · {fmtDate(c.startDate)}
                </p>
                <div className="mt-2 flex gap-4 text-xs">
                  <span>
                    {t('webadmin2.arent.paid')}: <b className="font-mono">{crc(c.summary.paid)}</b>
                  </span>
                  <span>
                    {t('webadmin2.arent.due')}:{' '}
                    <b
                      className={`font-mono ${c.summary.due > 0 ? 'text-red-600' : 'text-kiwi-700'}`}
                    >
                      {crc(c.summary.due)}
                    </b>
                  </span>
                  <span className="text-surface-500">
                    {t('webadmin2.arent.weeks', { n: c.summary.weeksElapsed })}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
            {!detail || !selected ? (
              <p className="text-sm text-surface-500">—</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-surface-800 dark:text-surface-100">
                      {detail.driverName}
                    </p>
                    <p className="text-xs text-surface-500">
                      {crc(detail.weeklyPrice)}/sem · {fmtDate(detail.startDate)}
                      {detail.endDate ? ` → ${fmtDate(detail.endDate)}` : ''}
                    </p>
                    {detail.notes && (
                      <p className="mt-1 text-xs text-surface-500">{detail.notes}</p>
                    )}
                  </div>
                  {detail.status === 'active' && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => closeContract(detail.id, 'finish')}
                        className="rounded-lg bg-kiwi-700 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {t('webadmin2.arent.finish')}
                      </button>
                      <button
                        onClick={() => closeContract(detail.id, 'cancel')}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600"
                      >
                        {t('webadmin2.arent.cancelContract')}
                      </button>
                    </div>
                  )}
                </div>

                <p className="mb-2 mt-4 text-sm font-semibold text-surface-700 dark:text-surface-200">
                  {t('webadmin2.arent.payments')}
                </p>
                {detail.payments.length === 0 ? (
                  <p className="text-xs text-surface-500">{t('webadmin2.arent.noPayments')}</p>
                ) : (
                  <div className="space-y-2">
                    {detail.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl bg-surface-50 px-3 py-2 text-sm dark:bg-surface-700/50"
                      >
                        <div>
                          <p className="font-mono font-semibold">{crc(p.amount)}</p>
                          <p className="text-xs text-surface-500">
                            {fmtDate(p.paidAt)}
                            {p.note ? ` · ${p.note}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => removePayment(p.id, p.amount)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                          aria-label="Anular pago"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {detail.status === 'active' && (
                  <div className="mt-3 rounded-xl border border-surface-200 p-3 dark:border-surface-700">
                    <p className="mb-2 text-xs font-semibold">{t('webadmin2.arent.addPayment')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={1}
                        value={pAmount}
                        onChange={(e) => setPAmount(e.target.value)}
                        placeholder={t('webadmin2.arent.amountLabel')}
                        className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                      />
                      <input
                        type="date"
                        value={pDate}
                        onChange={(e) => setPDate(e.target.value)}
                        className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                      />
                    </div>
                    <input
                      value={pNote}
                      onChange={(e) => setPNote(e.target.value)}
                      placeholder={t('webadmin2.arent.notePh')}
                      className="mt-2 w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    />
                    {payError && <p className="mt-1 text-xs text-red-600">{payError}</p>}
                    <button
                      onClick={addPayment}
                      disabled={savingPay || !pAmount}
                      className="mt-2 w-full rounded-xl bg-kiwi-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {t('webadmin2.arent.addPayment')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
        <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
          {t('webadmin2.arent.calculator')}
        </p>
        <p className="mb-3 text-xs text-surface-500">{t('webadmin2.arent.calculatorHint')}</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {[
            [t('webadmin2.arent.costMonthly'), cMonthly, setCMonthly],
            [t('webadmin2.arent.costInsurance'), cInsurance, setCInsurance],
            [t('webadmin2.arent.costMarchamo'), cMarchamo, setCMarchamo],
            [t('webadmin2.arent.costMaint'), cMaint, setCMaint],
            [t('webadmin2.arent.costOther'), cOther, setCOther],
            [t('webadmin2.arent.margin'), cMargin, setCMargin],
          ].map(([label, v, set]: any) => (
            <label key={label} className="block">
              <span className="mb-1 block text-[11px] font-medium text-surface-500">{label}</span>
              <input
                type="number"
                min={0}
                value={v}
                onChange={(e) => set(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-sm">
          {t('webadmin2.arent.suggested')}:{' '}
          <b className="font-mono text-lg text-kiwi-700">{crc(suggestedWeekly)}/sem</b>{' '}
          <span className="text-xs text-surface-500">
            (
            {t('webadmin2.arent.perMonth', {
              amount: crc(Math.round((suggestedWeekly * 52) / 12)),
            })}
            )
          </span>
        </p>
        <div className="mt-3 rounded-xl bg-surface-50 p-3 text-xs text-surface-500 dark:bg-surface-700/50">
          <p className="mb-1 font-semibold">{t('webadmin2.arent.refs')}</p>
          <p>• {t('webadmin2.arent.refMotai')}</p>
          <p>• {t('webadmin2.arent.refBike')}</p>
          <p>• {t('webadmin2.arent.refSoa')}</p>
          <p>• {t('webadmin2.arent.refReqs')}</p>
        </div>
      </div>
    </div>
  );
}
