// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Receipt, Plus } from 'lucide-react';
import { api, useTranslations } from '@kiwi/ui';

const fmt = (n: number) => `₡${Math.round(Number(n) || 0).toLocaleString('es-CR')}`;
const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-CR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
const fmtDay = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '—';

interface InvoiceLine {
  paymentId: string;
  orderId: string;
  deliveredAt: string | null;
  pickupAddress: string;
  deliveryAddress: string;
  distanceKm: number | null;
  driverName: string | null;
  amount: number;
}

interface Invoice {
  id: string;
  merchantId: string;
  merchantName: string | null;
  periodStart: string;
  periodEnd: string;
  trips: number;
  amount: number;
  status: 'pending' | 'paid';
  paidAt: string | null;
  lines?: InvoiceLine[];
}

export default function FacturacionPage() {
  const { t } = useTranslations();
  const [merchants, setMerchants] = useState<Array<{ id: string; businessName: string }>>([]);
  const [merchantId, setMerchantId] = useState('');
  const [week, setWeek] = useState('');
  const [preview, setPreview] = useState<{
    merchantName: string | null;
    periodStart: string;
    periodEnd: string;
    trips: number;
    amount: number;
    lines: InvoiceLine[];
  } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadInvoices = useCallback(
    async (mid?: string) => {
      try {
        const res = await api.getMerchantInvoices({
          merchantId: mid || undefined,
          take: 30,
        });
        setInvoices(Array.isArray(res?.items) ? res.items : []);
        setTotal(Number(res?.total ?? 0));
        setPendingCount(Number(res?.summary?.pendingCount ?? 0));
        setPendingAmount(Number(res?.summary?.pendingAmount ?? 0));
      } catch (e: any) {
        setError(e?.message || t('webadmin1.afact.loadError'));
      }
    },
    [t],
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getUsersAdmin({ role: 'merchant', take: 100 }).catch(() => ({ users: [] })),
      loadInvoices(),
    ])
      .then(([usersRes]: any) => {
        const users: any[] = Array.isArray(usersRes?.users) ? usersRes.users : [];
        setMerchants(
          users
            .filter((u) => u.merchantProfile?.id)
            .map((u) => ({
              id: u.merchantProfile.id,
              businessName: u.merchantProfile.businessName ?? '?',
            })),
        );
      })
      .catch((e: any) => setError(e?.message || t('webadmin1.afact.loadError')))
      .finally(() => setLoading(false));
  }, [loadInvoices, t]);

  const doPreview = async () => {
    if (!merchantId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setPreview(await api.previewMerchantInvoice(merchantId, week || undefined));
    } catch (e: any) {
      setError(e?.message || t('webadmin1.afact.loadError'));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const doGenerate = async () => {
    if (!merchantId) return;
    if (!window.confirm(t('webadmin1.afact.confirmGenerate'))) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const inv = await api.generateMerchantInvoice(merchantId, week || undefined);
      setNotice(t('webadmin1.afact.generatedOk'));
      setPreview(null);
      setSelected(inv);
      await loadInvoices(merchantId);
    } catch (e: any) {
      setError(e?.message || t('webadmin1.afact.loadError'));
    } finally {
      setBusy(false);
    }
  };

  const openInvoice = async (id: string) => {
    setBusy(true);
    try {
      setSelected(await api.getMerchantInvoice(id));
    } catch (e: any) {
      setError(e?.message || t('webadmin1.afact.loadError'));
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    if (!selected) return;
    if (!window.confirm(t('webadmin1.afact.confirmPaid'))) return;
    setBusy(true);
    try {
      setSelected(await api.markMerchantInvoicePaid(selected.id));
      await loadInvoices(merchantId || undefined);
    } catch (e: any) {
      setError(e?.message || t('webadmin1.afact.loadError'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-surface-200 dark:bg-surface-800" />
        <div className="h-48 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-display font-bold text-surface-800 dark:text-surface-100">
            <Receipt className="h-5 w-5" /> {t('webadmin1.afact.title')}
          </h1>
          <p className="text-sm text-surface-500">{t('webadmin1.afact.subtitle')}</p>
        </div>
        <button
          onClick={() => loadInvoices(merchantId || undefined)}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
        >
          <RefreshCw className="h-4 w-4" /> {t('webadmin1.afact.refresh')}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl bg-kiwi-50 border border-kiwi-200 px-4 py-3 text-sm text-kiwi-700">
          {notice}
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
        <p className="mb-3 text-sm font-semibold text-surface-700 dark:text-surface-200">
          {t('webadmin1.afact.cutTitle')}
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
              {t('webadmin1.afact.merchantLabel')}
            </span>
            <select
              value={merchantId}
              onChange={(e) => {
                setMerchantId(e.target.value);
                setPreview(null);
                setSelected(null);
                loadInvoices(e.target.value || undefined);
              }}
              className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
            >
              <option value="">{t('webadmin1.afact.pickMerchant')}</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.businessName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
              {t('webadmin1.afact.weekLabel')}
            </span>
            <input
              type="date"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              onClick={doPreview}
              disabled={busy || !merchantId}
              className="flex-1 rounded-xl border border-surface-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {t('webadmin1.afact.preview')}
            </button>
            <button
              onClick={doGenerate}
              disabled={busy || !merchantId}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {t('webadmin1.afact.generate')}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-surface-500">{t('webadmin1.afact.weekHint')}</p>

        {preview && (
          <div className="mt-4 rounded-xl bg-surface-50 p-4 dark:bg-surface-700/50">
            <p className="text-sm font-semibold">
              {preview.merchantName} · {fmtDay(preview.periodStart as any)} →{' '}
              {fmtDay(preview.periodEnd as any)}
            </p>
            <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">
              {t('webadmin1.afact.previewLine', {
                trips: preview.trips,
                amount: fmt(preview.amount),
              })}
            </p>
            {preview.trips === 0 && (
              <p className="mt-1 text-xs text-surface-500">{t('webadmin1.afact.empty')}</p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
          <p className="text-xs text-surface-500">{t('webadmin1.afact.pendingCount')}</p>
          <p className="mt-1 text-2xl font-bold">{pendingCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
          <p className="text-xs text-surface-500">{t('webadmin1.afact.pendingAmount')}</p>
          <p className="mt-1 text-2xl font-bold text-kiwi-700">{fmt(pendingAmount)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
          <p className="text-xs text-surface-500">{t('webadmin1.afact.receiptsCount')}</p>
          <p className="mt-1 text-2xl font-bold">{total}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
        <p className="mb-3 text-sm font-semibold text-surface-700 dark:text-surface-200">
          {t('webadmin1.afact.receiptsTitle')}
        </p>
        {invoices.length === 0 ? (
          <p className="text-sm text-surface-500">{t('webadmin1.afact.emptyInvoices')}</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => openInvoice(inv.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left ${
                  selected?.id === inv.id
                    ? 'border-kiwi-600 bg-kiwi-50/60 dark:bg-kiwi-900/20'
                    : 'border-surface-200/60 dark:border-white/[0.06]'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {inv.merchantName} · {fmtDay(inv.periodStart)} → {fmtDay(inv.periodEnd)}
                  </p>
                  <p className="text-xs text-surface-500">
                    {t('webadmin1.afact.invoiceLine', {
                      trips: inv.trips,
                      amount: fmt(inv.amount),
                    })}{' '}
                    ·{' '}
                    <span
                      className={
                        inv.status === 'paid'
                          ? 'text-kiwi-700 font-semibold'
                          : 'text-gold-600 font-semibold'
                      }
                    >
                      {inv.status === 'paid'
                        ? t('webadmin1.afact.paid')
                        : t('webadmin1.afact.pending')}
                      {inv.status === 'paid' && inv.paidAt ? ` · ${fmtDateTime(inv.paidAt)}` : ''}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 font-mono font-bold">{fmt(inv.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-surface-800 dark:text-surface-100">
                {t('webadmin1.afact.receiptTitle')} · {selected.merchantName}
              </p>
              <p className="text-xs text-surface-500">
                {fmtDay(selected.periodStart)} → {fmtDay(selected.periodEnd)} ·{' '}
                {t('webadmin1.afact.invoiceLine', {
                  trips: selected.trips,
                  amount: fmt(selected.amount),
                })}
              </p>
            </div>
            {selected.status === 'pending' ? (
              <button
                onClick={markPaid}
                disabled={busy}
                className="shrink-0 rounded-xl bg-kiwi-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {t('webadmin1.afact.markPaid')}
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-kiwi-100 px-3 py-1 text-xs font-semibold text-kiwi-700">
                {t('webadmin1.afact.paid')}
                {selected.paidAt ? ` · ${fmtDateTime(selected.paidAt)}` : ''}
              </span>
            )}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-700">
                  <th className="px-2 py-2 font-medium">{t('webadmin1.afact.colDate')}</th>
                  <th className="px-2 py-2 font-medium">{t('webadmin1.afact.colRoute')}</th>
                  <th className="px-2 py-2 font-medium">{t('webadmin1.afact.colDriver')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('webadmin1.afact.colKm')}</th>
                  <th className="px-2 py-2 text-right font-medium">
                    {t('webadmin1.afact.colAmount')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(selected.lines ?? []).map((l) => (
                  <tr
                    key={l.paymentId}
                    className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                  >
                    <td className="px-2 py-2 text-xs">{fmtDateTime(l.deliveredAt)}</td>
                    <td className="px-2 py-2 text-xs">
                      {l.pickupAddress} → {l.deliveryAddress}
                    </td>
                    <td className="px-2 py-2 text-xs">{l.driverName ?? '—'}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {l.distanceKm != null ? Number(l.distanceKm).toFixed(1) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-semibold">
                      {fmt(l.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
