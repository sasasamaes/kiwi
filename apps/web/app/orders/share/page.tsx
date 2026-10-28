// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, Share2, Link2, Ban } from 'lucide-react';
import { api, useAuth, useDeliveryZones, useTranslations, ZonePicker } from '@kiwi/ui';

type PayMethod = 'cash' | 'credit' | 'weekly';

export default function ShareDeliveryPage() {
  const { t } = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const deliveryZones = useDeliveryZones();

  const [zoneId, setZoneId] = useState('');
  const [method, setMethod] = useState<PayMethod>('cash');
  // Quién paga el viaje: el comercio (rebaja crédito) o el cliente por SINPE
  // directo al comercio (no toca crédito, el link nace en efectivo).
  const [paidBy, setPaidBy] = useState<'merchant' | 'customer'>('merchant');
  const [sinpeNumber, setSinpeNumber] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; price: number | null; label: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [links, setLinks] = useState<any[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);

  const weeklyBillingEnabled = (user as any)?.merchantProfile?.weeklyBillingEnabled === true;

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  useEffect(() => {
    if (!user) return;
    api
      .getMyDeliveryLinks()
      .then((r: any) => setLinks(Array.isArray(r?.links) ? r.links : []))
      .catch(() => setLinks([]));
    api
      .getMerchantProfile()
      .then((p: any) => setSinpeNumber((p as any)?.sinpeNumber ?? null))
      .catch(() => setSinpeNumber(null));
  }, [user]);

  if (!authLoading && !user) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <p className="text-surface-500">{t('webshop2.sharelink.loginRequired')}</p>
        <Link
          href="/login"
          className="mt-4 rounded-xl bg-kiwi-700 px-5 py-2.5 text-sm font-bold text-white"
        >
          {t('webshop2.sharelink.loginCta')}
        </Link>
      </main>
    );
  }

  const zone = deliveryZones.find((z: any) => z.id === zoneId) ?? null;
  const zonePrice = zone != null ? Number((zone as any).price ?? 0) : null;

  const methods: Array<{ id: PayMethod; label: string; on: boolean; hint?: string }> = [
    { id: 'cash', label: t('webshop2.sharelink.payCash'), on: true },
    { id: 'credit', label: t('webshop2.sharelink.payCredit'), on: true },
    {
      id: 'weekly',
      label: t('webshop2.sharelink.payWeekly'),
      on: weeklyBillingEnabled,
      hint: weeklyBillingEnabled ? undefined : t('webshop2.sharelink.weeklyLocked'),
    },
  ];

  const create = async () => {
    if (!zoneId || creating) return;
    setCreating(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.createDeliveryLink({
        deliveryZone: zoneId,
        paymentMethod:
          paidBy === 'customer' ? 'cash' : method === 'weekly' ? 'weekly_invoice' : method,
        paidBy,
      });
      setResult({
        url: String(res?.url ?? ''),
        price: Number(res?.zone?.price ?? zonePrice ?? 0),
        label: String(res?.zone?.label ?? (zone as any)?.label ?? ''),
      });
      const mine = await api.getMyDeliveryLinks().catch(() => null);
      if (mine) setLinks(Array.isArray(mine?.links) ? mine.links : []);
    } catch (e: any) {
      setError(e?.message || t('webshop2.sharelink.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const shareOrCopy = async (url: string) => {
    const text = t('webshop2.sharelink.shareText', { url });
    try {
      if (canNativeShare) {
        await navigator.share({ title: t('webshop2.sharelink.shareTitle'), text, url });
        return;
      }
      throw new Error('no-native-share');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        window.prompt(t('webshop2.sharelink.copyPrompt'), text);
      }
    }
  };

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await api.cancelDeliveryLink(id);
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, status: 'cancelled' } : l)));
    } catch (e: any) {
      setError(e?.message || t('webshop2.sharelink.revokeFailed'));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-bg-light pb-28 dark:bg-surface-950">
      <div className="mx-auto w-full max-w-lg px-4 pt-6">
        <header className="mb-5">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-sm font-medium text-surface-500 [@media(hover:hover)]:hover:text-surface-800 dark:text-surface-400"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> {t('webshop2.sharelink.back')}
          </Link>
          <h1 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-tight text-surface-900 dark:text-surface-100">
            {t('webshop2.sharelink.title')}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-surface-500 dark:text-surface-400">
            {t('webshop2.sharelink.subtitle')}
          </p>
        </header>

        <section className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800">
          <h2 className="font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
            {t('webshop2.sharelink.stepZone')}
          </h2>
          <div className="mt-3">
            <ZonePicker value={zoneId} onChange={setZoneId} />
          </div>
          {zonePrice != null && zoneId && (
            <p className="mt-2 text-sm font-semibold text-kiwi-700 dark:text-kiwi-300">
              {t('webshop2.sharelink.priceIs', { price: zonePrice.toLocaleString('es-CR') })}
            </p>
          )}

          <h2 className="mt-5 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
            ¿Quién paga el viaje?
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Quién paga">
            {(
              [
                { id: 'merchant', label: 'Lo pago yo (crédito)' },
                { id: 'customer', label: 'Lo paga el cliente (SINPE)' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={paidBy === p.id}
                onClick={() => setPaidBy(p.id)}
                className={`rounded-xl border px-2 py-2.5 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/50 ${
                  paidBy === p.id
                    ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30'
                    : 'border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {paidBy === 'customer' && (
            <p className="mt-2 rounded-xl bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 px-3 py-2 text-xs text-gold-800 dark:text-gold-200">
              El cliente te paga directo a tu SINPE ({sinpeNumber ?? 'ponelo en Mi Perfil'})
              {zonePrice != null ? ` · Monto: ₡${zonePrice.toLocaleString('es-CR')}` : ''}. No se
              toca tu crédito.
            </p>
          )}

          <h2 className="mt-5 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
            {t('webshop2.sharelink.stepPay')}
          </h2>
          <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
            {t('webshop2.sharelink.payHint')}
          </p>
          {paidBy === 'customer' ? (
            <p className="mt-2 rounded-xl bg-surface-50 dark:bg-surface-800 px-3 py-2.5 text-sm text-surface-600 dark:text-surface-300">
              Efectivo: el cliente te paga el viaje directo a tu SINPE.
            </p>
          ) : (
            <div
              className="mt-2 grid grid-cols-3 gap-2"
              role="group"
              aria-label={t('webshop2.sharelink.stepPay')}
            >
              {methods
                .filter((m) => m.on || m.id === 'weekly')
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={method === m.id}
                    disabled={m.id === 'weekly' && !m.on}
                    onClick={() => setMethod(m.id)}
                    title={m.hint}
                    className={`rounded-xl border px-2 py-2.5 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/50 disabled:opacity-40 ${
                      method === m.id
                        ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30'
                        : 'border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800'
                    }`}
                  >
                    {m.label}
                    {m.hint && (
                      <span className="block text-[10px] font-normal text-surface-400">
                        {m.hint}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={create}
            disabled={!zoneId || creating}
            className="mt-4 w-full rounded-full bg-kiwi-700 py-3.5 font-display text-[17px] font-bold text-white shadow-card transition-all active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/50 focus-visible:ring-offset-2"
          >
            {creating ? t('webshop2.sharelink.creating') : t('webshop2.sharelink.create')}
          </button>

          {result && (
            <div className="mt-3 rounded-xl bg-kiwi-50 p-4 dark:bg-kiwi-900/20">
              <p className="text-sm font-semibold text-kiwi-800 dark:text-kiwi-200">
                {t('webshop2.sharelink.ready', {
                  price: Number(result.price || 0).toLocaleString('es-CR'),
                })}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-surface-600 dark:text-surface-300">
                {result.url}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => shareOrCopy(result.url)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-bold text-white"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden /> {t('webshop2.sharelink.copied')}
                    </>
                  ) : canNativeShare ? (
                    <>
                      <Share2 className="h-4 w-4" aria-hidden /> {t('webshop2.sharelink.share')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden /> {t('webshop2.sharelink.copy')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>

        {links.length > 0 && (
          <section className="mt-4 rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800">
            <h2 className="font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              {t('webshop2.sharelink.myLinks')}
            </h2>
            <ul className="mt-2 space-y-2">
              {links.map((l: any) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-surface-50 px-3 py-2 text-sm dark:bg-surface-700/50"
                >
                  <span className="min-w-0 flex-1 truncate text-surface-600 dark:text-surface-300">
                    {l.status === 'pending'
                      ? t('webshop2.sharelink.statusPending')
                      : l.status === 'consumed'
                        ? t('webshop2.sharelink.statusUsed')
                        : t('webshop2.sharelink.statusCancelled')}
                  </span>
                  {l.status === 'pending' ? (
                    <button
                      type="button"
                      disabled={revoking === l.id}
                      onClick={() => revoke(l.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40"
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden /> {t('webshop2.sharelink.revoke')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-1 text-xs text-surface-400">
              <Link2 className="h-3.5 w-3.5" aria-hidden /> {t('webshop2.sharelink.linksHint')}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
