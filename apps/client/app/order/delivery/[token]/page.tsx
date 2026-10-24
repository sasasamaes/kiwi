// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Package, MapPin, User, Phone, CheckCircle2, Scale, Store } from 'lucide-react';
import { api, ConsentCheckbox, ConsentLink, useTranslations } from '@kiwi/ui';
import { PinMapPicker } from '../../../../components/PinMapPicker';

const money = (n: number) => '₡' + Math.round(n).toLocaleString('es-CR');

const field =
  'w-full rounded-xl border border-surface-200 bg-surface-50 px-3.5 py-3 text-[15px] text-surface-900 outline-none transition-colors placeholder:text-surface-400 focus:border-kiwi-600 focus:bg-white dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100 dark:focus:bg-surface-900';
const label = 'mb-1.5 block text-[13px] font-semibold text-surface-600 dark:text-surface-300';

export default function DeliveryLinkPage() {
  const params = useParams();
  const { t } = useTranslations();
  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string);

  const [link, setLink] = useState<any | null>(null);
  const [loadingLink, setLoadingLink] = useState(true);
  const [linkError, setLinkError] = useState<'invalid' | 'used' | null>(null);
  const [usedOrderId, setUsedOrderId] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryGps, setDeliveryGps] = useState<{ lat: number; lng: number } | null>(null);
  const [packageDescription, setPackageDescription] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [notes, setNotes] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ id: string } | null>(null);

  // Doble tap o reintento con wifi caído: misma key = mismo pedido.
  const placingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const ensureKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return idempotencyKeyRef.current;
  };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .getDeliveryLink(token)
      .then((r: any) => {
        if (cancelled) return;
        if (r?.consumed && r?.orderId) {
          setLinkError('used');
          setUsedOrderId(r.orderId);
          return;
        }
        setLink(r);
      })
      .catch(() => {
        if (!cancelled) setLinkError('invalid');
      })
      .finally(() => {
        if (!cancelled) setLoadingLink(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const digits = customerPhone.replace(/\D/g, '');
  const weightKg = weightInput === '' ? 0 : Number(weightInput);
  const weightValid = weightInput === '' || (weightKg > 0 && weightKg <= 500);
  const canSubmit =
    link &&
    !linkError &&
    customerName.trim().length > 0 &&
    digits.length >= 8 &&
    deliveryAddress.trim().length > 0 &&
    packageDescription.trim().length > 0 &&
    weightValid &&
    acceptedTerms;

  async function submit() {
    if (!canSubmit || placingRef.current) {
      if (!acceptedTerms) setConsentError(true);
      return;
    }
    placingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const order: any = await api.submitDeliveryLink(
        token,
        {
          customerName: customerName.trim(),
          customerPhone: digits,
          deliveryAddress: deliveryAddress.trim(),
          ...(deliveryGps ? { deliveryLat: deliveryGps.lat, deliveryLng: deliveryGps.lng } : {}),
          packageDescription: packageDescription.trim(),
          ...(weightKg > 0 ? { weightKg } : {}),
          specialInstructions: notes.trim() || undefined,
        },
        { idempotencyKey: ensureKey() },
      );
      const created = order?.order ?? order;
      setPlaced({ id: created?.id ?? '' });
      idempotencyKeyRef.current = null;
    } catch (err: any) {
      setError(err?.message || t('wclimisc.dlink.createFailed'));
    } finally {
      placingRef.current = false;
      setLoading(false);
    }
  }

  if (loadingLink) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center px-6">
        <p className="animate-pulse text-surface-500">{t('wclimisc.dlink.loading')}</p>
      </main>
    );
  }

  if (linkError === 'invalid' || (!link && !linkError)) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <p className="mt-10 text-5xl">🔗</p>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
          {t('wclimisc.dlink.invalidTitle')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
          {t('wclimisc.dlink.invalidHint')}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-kiwi-700 px-6 py-3.5 font-semibold text-white shadow-card"
        >
          {t('wclimisc.dlink.back')}
        </Link>
      </main>
    );
  }

  if (linkError === 'used' || placed) {
    const orderId = placed?.id || usedOrderId || '';
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300"
        >
          <CheckCircle2 className="h-10 w-10" aria-hidden />
        </motion.div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
          {placed ? t('wclimisc.dlink.createdTitle') : t('wclimisc.dlink.usedTitle')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
          {placed ? t('wclimisc.dlink.createdHint') : t('wclimisc.dlink.usedHint')}
        </p>
        {orderId ? (
          <Link
            href={`/tracking/${orderId}`}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-kiwi-700 px-6 py-3.5 font-semibold text-white shadow-card transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/50"
          >
            {t('wclimisc.dlink.trackCta')}
          </Link>
        ) : null}
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-bg-light pb-28 dark:bg-surface-950">
      <div className="mx-auto w-full max-w-lg px-4 pt-6">
        <header className="mb-5">
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-kiwi-700 text-white shadow-card">
              <Store className="h-7 w-7" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-kiwi-700 dark:text-kiwi-300">
                {t('wclimisc.dlink.title')}
              </p>
              <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-surface-900 dark:text-surface-100">
                {link?.merchantName ?? ''}
              </h1>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-surface-500 dark:text-surface-400">
            {t('wclimisc.dlink.subtitle', { merchant: link?.merchantName ?? '' })}
          </p>
          {link?.zoneLabel != null && (
            <p className="mt-2 inline-block rounded-full bg-kiwi-100 px-3 py-1 text-sm font-semibold text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
              {t('wclimisc.dlink.tripLabel', {
                zone: link.zoneLabel,
                price: money(Number(link.price ?? 0)),
              })}
            </p>
          )}
        </header>

        <div className="space-y-4">
          <section className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
                <User className="h-4 w-4" aria-hidden />
              </span>
              {t('wclimisc.dlink.nameLabel')}
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className={label} htmlFor="dlink-name">
                  {t('wclimisc.dlink.nameLabel')}
                </label>
                <input
                  id="dlink-name"
                  className={field}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('wclimisc.dlink.namePh')}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className={label} htmlFor="dlink-phone">
                  {t('wclimisc.dlink.phoneLabel')}
                </label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400"
                    aria-hidden
                  />
                  <input
                    id="dlink-phone"
                    inputMode="tel"
                    className={`${field} pl-10 tabular-nums`}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={t('wclimisc.dlink.phonePh')}
                    autoComplete="tel"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
                <MapPin className="h-4 w-4" aria-hidden />
              </span>
              {t('wclimisc.dlink.addressLabel')}
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className={label} htmlFor="dlink-address">
                  {t('wclimisc.dlink.addressLabel')}
                </label>
                <input
                  id="dlink-address"
                  className={field}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={t('wclimisc.dlink.addressPh')}
                />
              </div>
              <div>
                <span className={label}>{t('wclimisc.dlink.pinTitle')}</span>
                <PinMapPicker
                  lat={deliveryGps?.lat ?? null}
                  lng={deliveryGps?.lng ?? null}
                  tooltip=""
                  onPick={(la, ln) => setDeliveryGps({ lat: la, lng: ln })}
                />
                {deliveryGps && (
                  <button
                    type="button"
                    onClick={() => setDeliveryGps(null)}
                    className="mt-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500"
                  >
                    {t('wclimisc.dlink.removePin')}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
                <Package className="h-4 w-4" aria-hidden />
              </span>
              {t('wclimisc.dlink.packageLabel')}
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className={label} htmlFor="dlink-package">
                  {t('wclimisc.dlink.packageLabel')}
                </label>
                <input
                  id="dlink-package"
                  className={field}
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                  placeholder={t('wclimisc.dlink.packagePh')}
                />
              </div>
              <div>
                <label className={label} htmlFor="dlink-weight">
                  {t('wclimisc.dlink.weightLabel')}
                </label>
                <div className="relative">
                  <Scale
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400"
                    aria-hidden
                  />
                  <input
                    id="dlink-weight"
                    inputMode="decimal"
                    className={`${field} pl-10 tabular-nums`}
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                  />
                </div>
                {!weightValid && <p className="mt-1 text-xs font-medium text-red-600">0–500 kg</p>}
              </div>
              <div>
                <label className={label} htmlFor="dlink-notes">
                  {t('wclimisc.dlink.notesLabel')}
                </label>
                <textarea
                  id="dlink-notes"
                  rows={2}
                  className={`${field} resize-none`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </section>

          <ConsentCheckbox
            checked={acceptedTerms}
            onChange={(checked) => {
              setAcceptedTerms(checked);
              if (checked) setConsentError(false);
            }}
            error={consentError && !acceptedTerms}
          >
            {t('wclimisc.dlink.consentA')}{' '}
            <ConsentLink href="/terms">{t('wclimisc.dlink.consentTerms')}</ConsentLink>
            {t('wclimisc.dlink.consentB')}{' '}
            <ConsentLink href="/privacy">{t('wclimisc.dlink.consentPrivacy')}</ConsentLink>{' '}
            {t('wclimisc.dlink.consentC')}{' '}
            <ConsentLink href="/refunds">{t('wclimisc.dlink.consentRefunds')}</ConsentLink>
            {t('wclimisc.dlink.consentD')}
          </ConsentCheckbox>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-surface-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-surface-700 dark:bg-surface-900/95">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={submit}
            disabled={loading || !canSubmit}
            className="w-full rounded-full bg-kiwi-700 py-4 font-display text-[17px] font-bold text-white shadow-card transition-all active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/50 focus-visible:ring-offset-2"
          >
            {loading ? t('wclimisc.dlink.submitLoading') : t('wclimisc.dlink.submit')}
          </button>
          {!canSubmit && !loading && (
            <p className="mt-1.5 text-center text-[11px] text-surface-400">
              {t('wclimisc.dlink.incomplete')}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
