// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  MapPin,
  User,
  Phone,
  Banknote,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Store,
} from 'lucide-react';
import {
  api,
  useAuth,
  ConsentCheckbox,
  ConsentLink,
  DeliveryZoneSelect,
  useDeliveryZones,
  useTranslations,
} from '@kiwi/ui';
import { findDeliveryZone } from '@kiwi/types';
import { BottomNav } from '../components/BottomNav';

const MAX_ESTIMATE = 15000;
const MANDADO_FEE_PCT = 10;

const money = (n: number) => '₡' + Math.round(n).toLocaleString('es-CR');

export default function MandadosPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslations();
  const deliveryZones = useDeliveryZones();

  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [shoppingList, setShoppingList] = useState('');
  const [estimateInput, setEstimateInput] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [deliveryZone, setDeliveryZone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [feePct, setFeePct] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ id: string; total: number } | null>(null);
  /** Feature flag del admin: si está apagado, la función no está disponible. */
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getFeatureFlags()
      .then((f) => {
        if (!cancelled) setAvailable((f as any).mandadosEnabled !== false);
      })
      .catch(() => {
        if (!cancelled) setAvailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      try {
        window.sessionStorage.setItem('kiwi_redirect_after_login', '/mandados');
      } catch {
        // sin storage: el login cae al inicio, no es bloqueante
      }
      window.location.href = '/login';
      return;
    }
    setSenderName((n) => n || (user as any).fullName || '');
    setSenderPhone((p) => p || (user as any).phone || '');
  }, [authLoading, user]);

  useEffect(() => {
    api
      .getPlatformFees()
      .then((f: any) => {
        if (typeof f?.standardPct === 'number') setFeePct(f.standardPct);
      })
      .catch(() => undefined);
  }, []);

  const placingRef = useRef(false);
  const [idemKey, setIdemKey] = useState<string | null>(null);
  // Key única por intento (anti doble-tap con wifi caído). Se genera en un
  // efecto —los effects sí pueden ser impuros— y se renueva tras cada pedido.
  useEffect(() => {
    if (idemKey === null) {
      setIdemKey(
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
    }
  }, [idemKey]);

  const estimate = Math.round(Number(estimateInput) || 0);
  const estimateValid = estimate >= 1 && estimate <= MAX_ESTIMATE;
  const zoneTrip =
    deliveryZones.find((z) => z.id === deliveryZone)?.price ??
    findDeliveryZone(deliveryZone)?.price ??
    null;
  const trip = zoneTrip ?? 500;
  // Fee mandado: 10% sobre (compra + viaje). Mitad bonus repartidor.
  const fee = Math.round(((estimateValid ? estimate : 0) + trip) * (MANDADO_FEE_PCT / 100));
  const bonus = Math.round(fee / 2);
  const driverGets = trip - Math.round(trip * (feePct / 100)) + bonus;
  const total = (estimateValid ? estimate : 0) + trip + fee;
  const senderDigits = senderPhone.replace(/\D/g, '');

  const canSubmit =
    storeName.trim().length > 0 &&
    storeAddress.trim().length > 0 &&
    shoppingList.trim().length > 0 &&
    estimateValid &&
    senderName.trim().length > 0 &&
    senderDigits.length >= 8 &&
    deliveryZone.trim().length > 0 &&
    deliveryAddress.trim().length > 0 &&
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
      const order = await api.createMandado(
        {
          customerName: senderName.trim(),
          customerPhone: senderDigits,
          pickupAddress: storeAddress.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryZone,
          packageDescription: shoppingList.trim(),
          purchaseStore: storeName.trim(),
          purchaseEstimate: estimate,
          specialInstructions: notes.trim() || undefined,
          paymentMethod: 'cash',
        },
        { idempotencyKey: idemKey ?? undefined },
      );
      setPlaced({ id: order?.id ?? '', total: Number(order?.totalAmount ?? total) });
      setIdemKey(null);
    } catch (err: any) {
      setError(err?.message || t('wclimisc.manda.createFailed'));
    } finally {
      placingRef.current = false;
      setLoading(false);
    }
  }

  if (available === false) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-6 pb-28 pt-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300 mx-auto"
        >
          <ShoppingBag className="h-10 w-10" aria-hidden />
        </motion.div>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
          {t('wclimisc.manda.unavailableTitle')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
          {t('wclimisc.manda.unavailableHint')}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-kiwi-700 py-3.5 font-semibold text-white shadow-card transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/50"
        >
          {t('wclimisc.manda.backHome')}
        </Link>
        <BottomNav />
      </main>
    );
  }

  if (placed) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-6 pb-28 pt-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300 mx-auto"
        >
          <CheckCircle2 className="h-10 w-10" aria-hidden />
        </motion.div>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-kiwi-700 dark:text-kiwi-300">
          {t('wclimisc.manda.created')}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
          {t('wclimisc.manda.findingDriver')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
          {t('wclimisc.manda.driverNotice', { total: money(placed.total) })}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {placed.id ? (
            <Link
              href={`/tracking/${placed.id}`}
              className="rounded-full bg-kiwi-700 py-3.5 font-semibold text-white shadow-card transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/50"
            >
              {t('wclimisc.manda.track')}
            </Link>
          ) : null}
          <Link
            href="/orders"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-surface-200 dark:border-surface-700 py-3.5 font-semibold text-surface-700 dark:text-surface-200 transition-colors [@media(hover:hover)]:hover:bg-surface-50 dark:[@media(hover:hover)]:hover:bg-surface-800"
          >
            <ClipboardList className="h-4 w-4" aria-hidden /> {t('wclimisc.manda.myOrders')}
          </Link>
        </div>
        <BottomNav />
      </main>
    );
  }

  const field =
    'w-full rounded-xl border border-surface-200 bg-surface-50 px-3.5 py-3 text-[15px] text-surface-900 outline-none transition-colors placeholder:text-surface-400 focus:border-kiwi-600 focus:bg-white dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100 dark:focus:bg-surface-900';
  const label = 'mb-1.5 block text-[13px] font-semibold text-surface-600 dark:text-surface-300';

  return (
    <main className="min-h-[100dvh] bg-bg-light pb-40 dark:bg-surface-950">
      <div className="mx-auto w-full max-w-lg px-4 pt-6">
        {/* Hero */}
        <header className="mb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-surface-500 transition-colors [@media(hover:hover)]:hover:text-surface-800 dark:text-surface-400 dark:[@media(hover:hover)]:hover:text-surface-200"
          >
            <ChevronRight className="h-4 w-4 rotate-180" aria-hidden /> {t('wclimisc.manda.home')}
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-card">
              <ShoppingBag className="h-7 w-7" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700 dark:text-orange-300">
                {t('wclimisc.manda.eyebrow')}
              </p>
              <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-surface-900 dark:text-surface-100">
                {t('wclimisc.manda.title')}
              </h1>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-surface-500 dark:text-surface-400">
            {t('wclimisc.manda.subtitle')}
          </p>
        </header>

        <div className="space-y-4">
          {/* 1. Tienda */}
          <section className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300">
                <Store className="h-4 w-4" aria-hidden />
              </span>
              {t('wclimisc.manda.storeTitle')}
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className={label} htmlFor="manda-store">
                  {t('wclimisc.manda.storeName')}
                </label>
                <input
                  id="manda-store"
                  className={field}
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder={t('wclimisc.manda.storeNamePh')}
                />
              </div>
              <div>
                <label className={label} htmlFor="manda-store-addr">
                  {t('wclimisc.manda.storeAddress')}
                </label>
                <input
                  id="manda-store-addr"
                  className={field}
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder={t('wclimisc.manda.storeAddressPh')}
                />
              </div>
              <div>
                <label className={label} htmlFor="manda-list">
                  {t('wclimisc.manda.listTitle')}
                </label>
                <textarea
                  id="manda-list"
                  className={`${field} min-h-[72px]`}
                  value={shoppingList}
                  onChange={(e) => setShoppingList(e.target.value)}
                  placeholder={t('wclimisc.manda.listPh')}
                />
              </div>
              <div>
                <label className={label} htmlFor="manda-estimate">
                  {t('wclimisc.manda.estimate')}
                </label>
                <input
                  id="manda-estimate"
                  className={field}
                  inputMode="numeric"
                  value={estimateInput}
                  onChange={(e) => setEstimateInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="5000"
                />
                <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                  {t('wclimisc.manda.estimateHint')}
                </p>
              </div>
            </div>
          </section>

          {/* 2. Entrega */}
          <section className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
                <MapPin className="h-4 w-4" aria-hidden />
              </span>
              {t('wclimisc.manda.deliveryTitle')}
            </h2>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="manda-name">
                    {t('wclimisc.manda.senderName')}
                  </label>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400"
                      aria-hidden
                    />
                    <input
                      id="manda-name"
                      className={`${field} pl-10`}
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={label} htmlFor="manda-phone">
                    {t('wclimisc.manda.senderPhone')}
                  </label>
                  <div className="relative">
                    <Phone
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400"
                      aria-hidden
                    />
                    <input
                      id="manda-phone"
                      className={`${field} pl-10`}
                      inputMode="tel"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DeliveryZoneSelect value={deliveryZone} onChange={setDeliveryZone} />
              <div>
                <label className={label} htmlFor="manda-delivery">
                  {t('wclimisc.manda.deliveryAddress')}
                </label>
                <input
                  id="manda-delivery"
                  className={field}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={t('wclimisc.manda.deliveryPh')}
                />
              </div>
              <div>
                <label className={label} htmlFor="manda-notes">
                  {t('wclimisc.manda.notes')}{' '}
                  <span className="font-normal">{t('wclimisc.manda.optional')}</span>
                </label>
                <textarea
                  id="manda-notes"
                  className={`${field} min-h-[64px]`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* 3. Resumen */}
          <section className="overflow-hidden rounded-2xl bg-kiwi-800 text-white shadow-card">
            <div className="space-y-1.5 p-4 text-sm">
              <h2 className="font-display text-[17px] font-bold">{t('wclimisc.manda.feeTitle')}</h2>
              <div className="flex items-center justify-between text-white/80">
                <span>{t('wclimisc.manda.feePurchase')}</span>
                <span className="tabular-nums">{money(estimateValid ? estimate : 0)}</span>
              </div>
              <div className="flex items-center justify-between text-white/80">
                <span>{t('wclimisc.manda.feeTrip')}</span>
                <span className="tabular-nums">{money(trip)}</span>
              </div>
              <div className="flex items-center justify-between text-white/80">
                <span>{t('wclimisc.manda.feeExtra')}</span>
                <span className="tabular-nums">{money(fee)}</span>
              </div>
              <p className="text-xs text-white/70">{t('wclimisc.manda.feeExtraHint')}</p>
              <div className="flex items-center justify-between text-white/80">
                <span>
                  {t('wclimisc.manda.feeDriverGets', { pct: feePct })} ·{' '}
                  {t('wclimisc.manda.feeDriverBonus', { amount: bonus.toLocaleString('es-CR') })}
                </span>
                <span className="tabular-nums">{money(driverGets)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/15 pt-2">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Banknote className="h-4 w-4" aria-hidden /> {t('wclimisc.manda.cashTotal')}
                </span>
                <span className="font-display text-xl font-bold tabular-nums">{money(total)}</span>
              </div>
              {zoneTrip == null && (
                <p className="text-xs text-white/70">{t('wclimisc.manda.pickHood')}</p>
              )}
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
            {t('wclimisc.manda.consentA')}{' '}
            <ConsentLink href="/terms">{t('wclimisc.manda.consentTerms')}</ConsentLink>
            {t('wclimisc.manda.consentB')}{' '}
            <ConsentLink href="/privacy">{t('wclimisc.manda.consentPrivacy')}</ConsentLink>{' '}
            {t('wclimisc.manda.consentC')}{' '}
            <ConsentLink href="/refunds">{t('wclimisc.manda.consentRefunds')}</ConsentLink>
            {t('wclimisc.manda.consentD')}
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
            className="w-full rounded-full bg-orange-500 py-4 font-display text-[17px] font-bold text-white shadow-card transition-all active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2"
          >
            {loading
              ? t('wclimisc.manda.submitLoading')
              : t('wclimisc.manda.submit', { total: money(total) })}
          </button>
          {!canSubmit && !loading && (
            <p className="mt-1.5 text-center text-[11px] text-surface-400">
              {t('wclimisc.manda.incomplete')}
            </p>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
