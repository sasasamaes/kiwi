// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Package,
  MapPin,
  User,
  Phone,
  Navigation,
  Box,
  Scale,
  Banknote,
  ChevronRight,
  Check,
  CheckCircle2,
  ClipboardList,
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
import { PinMapPicker } from '../../components/PinMapPicker';

const KG_INCLUDED = 5;
const KG_EXTRA_PRICE = 500;

/** Espejo del cargo por kilo del servidor (el servidor manda el monto real). */
function weightSurcharge(kg: number): number {
  if (!Number.isFinite(kg) || kg <= KG_INCLUDED) return 0;
  return Math.ceil(kg - KG_INCLUDED) * KG_EXTRA_PRICE;
}

const money = (n: number) => '₡' + Math.round(n).toLocaleString('es-CR');

export default function EncomiendaPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslations();
  const deliveryZones = useDeliveryZones();

  const SIZES: Array<{ id: 'S' | 'M' | 'L'; label: string; hint: string }> = [
    { id: 'S', label: t('wclimisc.enco.sizeS'), hint: t('wclimisc.enco.sizeSHint') },
    { id: 'M', label: t('wclimisc.enco.sizeM'), hint: t('wclimisc.enco.sizeMHint') },
    { id: 'L', label: t('wclimisc.enco.sizeL'), hint: t('wclimisc.enco.sizeLHint') },
  ];

  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupGps, setPickupGps] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupLocating, setPickupLocating] = useState(false);
  const [deliveryGps, setDeliveryGps] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryZone, setDeliveryZone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [packageSize, setPackageSize] = useState<'S' | 'M' | 'L' | ''>('');
  const [weightInput, setWeightInput] = useState('');
  const [notes, setNotes] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [feePct, setFeePct] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ id: string } | null>(null);
  /** Feature flag del admin: si está apagado, la función no está disponible. */
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getFeatureFlags()
      .then((f) => {
        if (!cancelled) setAvailable(f.encomiendaEnabled !== false);
      })
      .catch(() => {
        if (!cancelled) setAvailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Ruta protegida: sin sesión, login y de vuelta acá.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      try {
        window.sessionStorage.setItem('kiwi_redirect_after_login', '/encomienda');
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

  const weightKg = Number(weightInput) || 0;
  const weightValid = weightInput === '' || (weightKg > 0 && weightKg <= 500);
  const zoneTrip =
    deliveryZones.find((z) => z.id === deliveryZone)?.price ??
    findDeliveryZone(deliveryZone)?.price ??
    null;
  const extraKg = weightSurcharge(weightKg);
  const tripBase = (zoneTrip ?? 500) + extraKg;
  // El cliente paga el viaje a valor nominal (sin recargo: el 15% sale del
  // payout del repartidor). El backend cobra el total real.
  const total = tripBase;
  const senderDigits = senderPhone.replace(/\D/g, '');
  const recipientDigits = recipientPhone.replace(/\D/g, '');

  const step1Done =
    senderName.trim().length > 0 && senderDigits.length >= 8 && pickupAddress.trim().length > 0;
  const step2Done =
    deliveryZone.trim().length > 0 &&
    deliveryAddress.trim().length > 0 &&
    recipientName.trim().length > 0 &&
    recipientDigits.length >= 8;
  const step3Done = packageDescription.trim().length > 0 && weightValid;

  const canSubmit = step1Done && step2Done && step3Done && acceptedTerms;

  const usePickupGps = () => {
    if (!('geolocation' in navigator)) return;
    setPickupLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPickupLocating(false);
      },
      () => setPickupLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  async function submit() {
    if (!canSubmit || placingRef.current) {
      if (!acceptedTerms) setConsentError(true);
      return;
    }
    placingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const recipientLine = `Destinatario: ${recipientName.trim()} · Tel: ${recipientDigits}`;
      const order = await api.createEncomienda(
        {
          customerName: senderName.trim(),
          customerPhone: senderDigits,
          pickupAddress: pickupAddress.trim(),
          ...(pickupGps ? { pickupLat: pickupGps.lat, pickupLng: pickupGps.lng } : {}),
          deliveryAddress: deliveryAddress.trim(),
          ...(deliveryGps ? { deliveryLat: deliveryGps.lat, deliveryLng: deliveryGps.lng } : {}),
          deliveryZone,
          packageDescription: packageDescription.trim(),
          ...(packageSize ? { packageSize } : {}),
          ...(weightKg > 0 ? { weightKg } : {}),
          specialInstructions: notes.trim() ? `${recipientLine}\n${notes.trim()}` : recipientLine,
          paymentMethod: 'cash',
        },
        { idempotencyKey: ensureKey() },
      );
      setPlaced({ id: order?.id ?? '' });
      idempotencyKeyRef.current = null;
    } catch (err: any) {
      setError(err?.message || t('wclimisc.enco.createFailed'));
    } finally {
      placingRef.current = false;
      setLoading(false);
    }
  }

  if (available === false) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-6 pb-28 pt-16 text-center">
        <p className="mt-10 text-5xl">📦</p>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
          {t('wclimisc.enco.unavailableTitle')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
          {t('wclimisc.enco.unavailableHint')}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-kiwi-700 py-3.5 font-semibold text-white shadow-card transition-transform active:scale-[0.98]"
        >
          {t('wclimisc.enco.backHome')}
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
          {t('wclimisc.enco.created')}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
          {t('wclimisc.enco.findingDriver')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
          {t('wclimisc.enco.driverNotice', {
            pickup: pickupAddress.trim() || t('wclimisc.enco.pickupFallback'),
            total: money(total),
          })}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {placed.id ? (
            <Link
              href={`/tracking/${placed.id}`}
              className="rounded-full bg-kiwi-700 py-3.5 font-semibold text-white shadow-card transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/50"
            >
              {t('wclimisc.enco.track')}
            </Link>
          ) : null}
          <Link
            href="/orders"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-surface-200 dark:border-surface-700 py-3.5 font-semibold text-surface-700 dark:text-surface-200 transition-colors [@media(hover:hover)]:hover:bg-surface-50 dark:[@media(hover:hover)]:hover:bg-surface-800"
          >
            <ClipboardList className="h-4 w-4" aria-hidden /> {t('wclimisc.enco.myOrders')}
          </Link>
        </div>
        <BottomNav />
      </main>
    );
  }

  const field =
    'w-full rounded-xl border border-surface-200 bg-surface-50 px-3.5 py-3 text-[15px] text-surface-900 outline-none transition-colors placeholder:text-surface-400 focus:border-kiwi-600 focus:bg-white dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100 dark:focus:bg-surface-900';
  const label = 'mb-1.5 block text-[13px] font-semibold text-surface-600 dark:text-surface-300';

  const steps = [
    { n: 1, label: t('wclimisc.enco.stepPickup'), done: step1Done, icon: Navigation },
    { n: 2, label: t('wclimisc.enco.stepDelivery'), done: step2Done, icon: MapPin },
    { n: 3, label: t('wclimisc.enco.stepPackage'), done: step3Done, icon: Box },
  ];

  return (
    <main className="min-h-[100dvh] bg-bg-light pb-40 dark:bg-surface-950">
      <div className="mx-auto w-full max-w-lg px-4 pt-6">
        {/* Hero */}
        <header className="mb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-surface-500 transition-colors [@media(hover:hover)]:hover:text-surface-800 dark:text-surface-400 dark:[@media(hover:hover)]:hover:text-surface-200"
          >
            <ChevronRight className="h-4 w-4 rotate-180" aria-hidden /> {t('wclimisc.enco.home')}
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-kiwi-700 text-white shadow-card">
              <Package className="h-7 w-7" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-kiwi-700 dark:text-kiwi-300">
                {t('wclimisc.enco.eyebrow')}
              </p>
              <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-surface-900 dark:text-surface-100">
                {t('wclimisc.enco.title')}
              </h1>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-surface-500 dark:text-surface-400">
            {t('wclimisc.enco.subtitle')}
          </p>
        </header>

        {/* Stepper */}
        <ol className="mb-5 flex items-center gap-1" aria-label={t('wclimisc.enco.progress')}>
          {steps.map((st, i) => (
            <li key={st.n} className="flex flex-1 items-center gap-1 last:flex-none">
              <div className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                    st.done
                      ? 'bg-kiwi-700 text-white'
                      : 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400'
                  }`}
                  aria-current={undefined}
                >
                  {st.done ? <Check className="h-4 w-4" aria-hidden /> : st.n}
                </span>
                <span
                  className={`text-[11px] font-semibold ${st.done ? 'text-kiwi-700 dark:text-kiwi-300' : 'text-surface-400'}`}
                >
                  {st.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={`mb-5 h-0.5 flex-1 rounded-full ${steps[i + 1].done || st.done ? 'bg-kiwi-600' : 'bg-surface-200 dark:bg-surface-700'}`}
                />
              )}
            </li>
          ))}
        </ol>

        <div className="space-y-4">
          {/* 1. Recogida */}
          <section className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
                <Navigation className="h-4 w-4" aria-hidden />
              </span>
              {t('wclimisc.enco.pickupTitle')}
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className={label} htmlFor="sender-name">
                  {t('wclimisc.enco.senderName')}
                </label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400"
                    aria-hidden
                  />
                  <input
                    id="sender-name"
                    className={`${field} pl-10`}
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              </div>
              <div>
                <label className={label} htmlFor="sender-phone">
                  {t('wclimisc.enco.senderPhone')}
                </label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400"
                    aria-hidden
                  />
                  <input
                    id="sender-phone"
                    inputMode="tel"
                    className={`${field} pl-10 tabular-nums`}
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
              <div>
                <label className={label} htmlFor="pickup">
                  Dirección donde se recoge
                </label>
                <input
                  id="pickup"
                  className={field}
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Ej: Frente al Mercado de Nicoya"
                />
              </div>
              <div>
                <span className={label}>{t('wclimisc.enco.pinTitle')}</span>
                <PinMapPicker
                  lat={pickupGps?.lat ?? null}
                  lng={pickupGps?.lng ?? null}
                  tooltip={t('wclimisc.enco.pinTipPickup')}
                  onPick={(la, ln) => setPickupGps({ lat: la, lng: ln })}
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {pickupGps ? (
                      <>
                        {t('wclimisc.enco.pinSet', {
                          lat: pickupGps.lat.toFixed(6),
                          lng: pickupGps.lng.toFixed(6),
                        })}
                      </>
                    ) : (
                      t('wclimisc.enco.pinHintPickup')
                    )}
                  </p>
                </div>
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={usePickupGps}
                    disabled={pickupLocating}
                    className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 px-3 py-2 text-xs font-semibold disabled:opacity-60"
                  >
                    {pickupLocating
                      ? t('wclimisc.enco.locating')
                      : t('wclimisc.enco.useMyLocation')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickupGps(null)}
                    disabled={!pickupGps}
                    className="rounded-xl border border-surface-200 dark:border-surface-700 px-3 py-2 text-xs font-semibold text-red-500 disabled:opacity-40"
                  >
                    {t('wclimisc.enco.removePin')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Entrega */}
          <section className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
                <MapPin className="h-4 w-4" aria-hidden />
              </span>
              {t('wclimisc.enco.deliveryTitle')}
            </h2>
            <div className="mt-3 space-y-3">
              <DeliveryZoneSelect value={deliveryZone} onChange={setDeliveryZone} />
              <div>
                <label className={label} htmlFor="delivery">
                  Dirección exacta de entrega
                </label>
                <input
                  id="delivery"
                  className={field}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Casa, local, punto de referencia…"
                />
              </div>
              <div>
                <span className={label}>{t('wclimisc.enco.pinTitle')}</span>
                <PinMapPicker
                  lat={deliveryGps?.lat ?? null}
                  lng={deliveryGps?.lng ?? null}
                  tooltip={t('wclimisc.enco.pinTipDelivery')}
                  onPick={(la, ln) => setDeliveryGps({ lat: la, lng: ln })}
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {deliveryGps ? (
                      <>
                        {t('wclimisc.enco.pinSet', {
                          lat: deliveryGps.lat.toFixed(6),
                          lng: deliveryGps.lng.toFixed(6),
                        })}
                      </>
                    ) : (
                      t('wclimisc.enco.pinHintDelivery')
                    )}
                  </p>
                  {deliveryGps && (
                    <button
                      type="button"
                      onClick={() => setDeliveryGps(null)}
                      className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500"
                    >
                      {t('wclimisc.enco.removePin')}
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="recipient-name">
                    {t('wclimisc.enco.recipientName')}
                  </label>
                  <input
                    id="recipient-name"
                    className={field}
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="recipient-phone">
                    {t('wclimisc.enco.recipientPhone')}
                  </label>
                  <input
                    id="recipient-phone"
                    inputMode="tel"
                    className={`${field} tabular-nums`}
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. Paquete */}
          <section className="rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
                <Box className="h-4 w-4" aria-hidden />
              </span>
              {t('wclimisc.enco.packageTitle')}
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className={label} htmlFor="package">
                  {t('wclimisc.enco.packageDesc')}
                </label>
                <input
                  id="package"
                  className={field}
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                  placeholder={t('wclimisc.enco.packagePh')}
                />
              </div>
              <div>
                <span className={label} id="size-label">
                  {t('wclimisc.enco.size')}
                </span>
                <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="size-label">
                  {SIZES.map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      aria-pressed={packageSize === sz.id}
                      onClick={() => setPackageSize(packageSize === sz.id ? '' : sz.id)}
                      className={`rounded-xl border px-2 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/50 active:scale-95 ${
                        packageSize === sz.id
                          ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-400/10'
                          : 'border-surface-200 dark:border-surface-700 [@media(hover:hover)]:hover:border-surface-300'
                      }`}
                    >
                      <span
                        className={`block text-sm font-bold ${packageSize === sz.id ? 'text-kiwi-700 dark:text-kiwi-300' : 'text-surface-800 dark:text-surface-100'}`}
                      >
                        {sz.label}
                      </span>
                      <span className="block text-[10px] leading-tight text-surface-400">
                        {sz.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label} htmlFor="weight">
                  {t('wclimisc.enco.weight')}
                </label>
                <div className="relative">
                  <Scale
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400"
                    aria-hidden
                  />
                  <input
                    id="weight"
                    inputMode="decimal"
                    className={`${field} pl-10 tabular-nums`}
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder={t('wclimisc.enco.weightPh')}
                  />
                </div>
                {!weightValid ? (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {t('wclimisc.enco.weightError')}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                    {t('wclimisc.enco.weightHint', {
                      kg: KG_INCLUDED,
                      price: money(KG_EXTRA_PRICE),
                    })}
                  </p>
                )}
              </div>
              <div>
                <label className={label} htmlFor="notes">
                  {t('wclimisc.enco.notes')}{' '}
                  <span className="font-normal text-surface-400">
                    {t('wclimisc.enco.optional')}
                  </span>
                </label>
                <textarea
                  id="notes"
                  rows={2}
                  className={`${field} resize-none`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Resumen */}
          <section
            className="rounded-2xl bg-kiwi-800 p-4 text-white shadow-card dark:bg-kiwi-900"
            aria-label={t('wclimisc.enco.summary')}
          >
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between text-white/80">
                <span>
                  {t('wclimisc.enco.baseTrip')}
                  {zoneTrip == null ? '' : ` ${t('wclimisc.enco.hoodSuffix')}`}
                </span>
                <span className="tabular-nums">{money((zoneTrip ?? 500) + extraKg)}</span>
              </div>
              {extraKg > 0 && (
                <div className="flex items-center justify-between text-white/80">
                  <span>{t('wclimisc.enco.extraWeight')}</span>
                  <span className="tabular-nums">{money(extraKg)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-white/80">
                <span>{t('wclimisc.enco.driverGets', { pct: feePct })}</span>
                <span className="tabular-nums">
                  {money(tripBase - Math.round(tripBase * (feePct / 100)))}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/15 pt-2">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Banknote className="h-4 w-4" aria-hidden /> {t('wclimisc.enco.cashTotal')}
                </span>
                <span className="font-display text-xl font-bold tabular-nums">
                  {zoneTrip == null ? money(total) : money(total)}
                </span>
              </div>
              {zoneTrip == null && (
                <p className="text-xs text-white/70">{t('wclimisc.enco.pickHood')}</p>
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
            {t('wclimisc.enco.consentA')}{' '}
            <ConsentLink href="/terms">{t('wclimisc.enco.consentTerms')}</ConsentLink>
            {t('wclimisc.enco.consentB')}{' '}
            <ConsentLink href="/privacy">{t('wclimisc.enco.consentPrivacy')}</ConsentLink>{' '}
            {t('wclimisc.enco.consentC')}{' '}
            <ConsentLink href="/refunds">{t('wclimisc.enco.consentRefunds')}</ConsentLink>
            {t('wclimisc.enco.consentD')}
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
            {loading
              ? t('wclimisc.enco.submitLoading')
              : t('wclimisc.enco.submit', { total: money(total) })}
          </button>
          {!canSubmit && !loading && (
            <p className="mt-1.5 text-center text-[11px] text-surface-400">
              {t('wclimisc.enco.incomplete')}
            </p>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
