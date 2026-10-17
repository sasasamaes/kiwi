// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  api,
  useAuth,
  ConsentCheckbox,
  ConsentLink,
  DeliveryZoneSelect,
  useDeliveryZones,
} from '@kiwi/ui';
import { findDeliveryZone } from '@kiwi/types';

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
  const deliveryZones = useDeliveryZones();

  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
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
  const tripBase = (zoneTrip ?? 500) + weightSurcharge(weightKg);
  // El envío lleva el % de Kiwi encima; el repartidor recibe el viaje base.
  const total = Math.round(tripBase * (1 + feePct / 100));
  const senderDigits = senderPhone.replace(/\D/g, '');
  const recipientDigits = recipientPhone.replace(/\D/g, '');

  const canSubmit =
    senderName.trim().length > 0 &&
    senderDigits.length >= 8 &&
    pickupAddress.trim().length > 0 &&
    deliveryZone.trim().length > 0 &&
    deliveryAddress.trim().length > 0 &&
    recipientName.trim().length > 0 &&
    recipientDigits.length >= 8 &&
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
      const recipientLine = `Destinatario: ${recipientName.trim()} · Tel: ${recipientDigits}`;
      const order = await api.createEncomienda(
        {
          customerName: senderName.trim(),
          customerPhone: senderDigits,
          pickupAddress: pickupAddress.trim(),
          deliveryAddress: deliveryAddress.trim(),
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
      setError(err?.message || 'No se pudo crear la encomienda. Intentá de nuevo.');
    } finally {
      placingRef.current = false;
      setLoading(false);
    }
  }

  if (placed) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl">📦</span>
        <h1 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">
          ¡Encomienda pedida!
        </h1>
        <p className="text-sm text-surface-600 dark:text-surface-300">
          Buscamos un repartidor cerca de {pickupAddress.trim() || 'la recogida'}. Pagás{' '}
          {money(total)} en efectivo al repartidor al entregar.
        </p>
        <Link href="/orders" className="rounded-xl bg-kiwi-600 px-5 py-3 font-semibold text-white">
          Ver mis pedidos
        </Link>
      </main>
    );
  }

  const field =
    'w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-surface-900 outline-none focus:border-kiwi-500 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100';
  const label = 'mb-1 block text-sm font-medium text-surface-600 dark:text-surface-300';

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-kiwi-50 via-white to-gold-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950">
      <div className="mx-auto w-full max-w-lg px-4 pb-32 pt-6">
        <header className="mb-6">
          <Link href="/" className="text-sm text-kiwi-700 dark:text-kiwi-300">
            ← Inicio
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-surface-900 dark:text-surface-100">
            📦 Pedir una encomienda
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Un repartidor de Kiwi recoge y lleva tu paquete. Sin comercio de por medio.
          </p>
        </header>

        <section className="space-y-4">
          <div>
            <p className="mb-2 font-display text-sm font-bold text-surface-900 dark:text-surface-100">
              1. Recogida
            </p>
            <div className="space-y-3">
              <div>
                <label className={label} htmlFor="sender-name">
                  Tu nombre
                </label>
                <input
                  id="sender-name"
                  className={field}
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="sender-phone">
                  Tu teléfono
                </label>
                <input
                  id="sender-phone"
                  inputMode="tel"
                  className={field}
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                />
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
            </div>
          </div>

          <div>
            <p className="mb-2 font-display text-sm font-bold text-surface-900 dark:text-surface-100">
              2. Entrega
            </p>
            <div className="space-y-3">
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
                />
              </div>
              <div>
                <label className={label} htmlFor="recipient-name">
                  Nombre de quien recibe
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
                  Teléfono de quien recibe
                </label>
                <input
                  id="recipient-phone"
                  inputMode="tel"
                  className={field}
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 font-display text-sm font-bold text-surface-900 dark:text-surface-100">
              3. El paquete
            </p>
            <div className="space-y-3">
              <div>
                <label className={label} htmlFor="package">
                  ¿Qué se envía?
                </label>
                <input
                  id="package"
                  className={field}
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                  placeholder="Ej: caja con documentos"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="size">
                    Tamaño
                  </label>
                  <select
                    id="size"
                    className={field}
                    value={packageSize}
                    onChange={(e) => setPackageSize(e.target.value as 'S' | 'M' | 'L' | '')}
                  >
                    <option value="">Sin especificar</option>
                    <option value="S">Pequeño</option>
                    <option value="M">Mediano</option>
                    <option value="L">Grande</option>
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="weight">
                    Peso (kg)
                  </label>
                  <input
                    id="weight"
                    inputMode="decimal"
                    className={field}
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              {!weightValid && (
                <p className="text-xs text-red-600">El peso debe estar entre 0 y 500 kg.</p>
              )}
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Los primeros {KG_INCLUDED} kg van incluidos. Cada kg extra suma{' '}
                {money(KG_EXTRA_PRICE)}.
              </p>
              <div>
                <label className={label} htmlFor="notes">
                  Indicaciones (opcional)
                </label>
                <textarea
                  id="notes"
                  rows={2}
                  className={field}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900">
          <div className="flex items-center justify-between text-sm text-surface-600 dark:text-surface-300">
            <span>Envío</span>
            <span>{zoneTrip == null ? 'Elegí el barrio' : money(total)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-surface-500 dark:text-surface-400">
            <span>Pago</span>
            <span>Efectivo al repartidor</span>
          </div>
        </section>

        <ConsentCheckbox
          checked={acceptedTerms}
          onChange={(checked) => {
            setAcceptedTerms(checked);
            if (checked) setConsentError(false);
          }}
          error={consentError && !acceptedTerms}
          className="mt-4"
        >
          Acepto los <ConsentLink href="/terms">términos</ConsentLink>, la{' '}
          <ConsentLink href="/privacy">política de privacidad</ConsentLink> y la{' '}
          <ConsentLink href="/refunds">política de reembolsos</ConsentLink>. Autorizo a Kiwi a usar
          mis datos y los de quien recibe para hacer esta entrega, compartiéndolos con el repartidor
          asignado.
        </ConsentCheckbox>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-surface-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-surface-700 dark:bg-surface-900/95">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={submit}
            disabled={loading || !canSubmit}
            className="w-full rounded-xl bg-kiwi-600 py-3.5 font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Pidiendo repartidor…' : `Pedir encomienda · ${money(total)}`}
          </button>
        </div>
      </div>
    </main>
  );
}
