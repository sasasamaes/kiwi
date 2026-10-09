// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, KiwiLogo, api, ZonePicker } from '@kiwi/ui';
import { findNearestZone } from '@kiwi/types';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    citySlug: 'nicoya',
    defaultAddress: '',
    deliveryZone: '',
  });
  const [offers, setOffers] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsZoneAuto, setGpsZoneAuto] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locDenied, setLocDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!acceptedTerms) {
        setError('Tenés que aceptar los Términos y la Política de Privacidad.');
        setLoading(false);
        return;
      }
      await register({
        email: form.email.trim(),
        password: form.password,
        acceptedTerms,
        fullName: form.fullName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        citySlug: form.citySlug,
        defaultAddress: form.defaultAddress.trim() || undefined,
        deliveryZone: form.deliveryZone || undefined,
        ...(gps ? { latitude: gps.lat, longitude: gps.lng } : {}),
        role: 'customer',
      });
      // Opt-out de ofertas si no quiere (default ON en el server).
      if (!offers) {
        try {
          await api.setTopicPreference('customer.offers', false);
        } catch {
          /* best-effort: el opt-out se puede cambiar después en ajustes */
        }
      }
      const next =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem('kiwi_redirect_after_login')
          : null;
      if (next) window.sessionStorage.removeItem('kiwi_redirect_after_login');
      router.push(next && next.startsWith('/') ? next : '/');
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // GPS → barrio más cercano con su precio. Solo autoselecciona si hay
  // confianza (lejos de límites); si no, el usuario elige a mano.
  useEffect(() => {
    if (!gps) return;
    try {
      const near = findNearestZone(gps.lat, gps.lng);
      if (near?.confident) {
        setForm((f) => (f.deliveryZone ? f : { ...f, deliveryZone: near.zone.id }));
        setGpsZoneAuto(true);
      }
    } catch {
      // sin zona: el picker manual sigue disponible
    }
  }, [gps]);

  const useGpsLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocDenied(true);
      return;
    }
    setLocating(true);
    setLocDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocDenied(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 px-4 py-10">
      <div className="mx-auto max-w-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400 mb-6"
        >
          <span>←</span> Volver al inicio
        </Link>
        <div className="flex justify-center mb-6">
          <KiwiLogo size={40} />
        </div>
        <h1 className="text-xl font-display font-bold text-center mb-1">Crear cuenta</h1>
        <p className="text-sm text-center text-surface-500 mb-6">
          Guardá tu dirección y pedí en 1 tap
        </p>
        <form onSubmit={submit} className="rounded-2xl glass p-6 space-y-3">
          <input
            value={form.fullName}
            onChange={set('fullName')}
            placeholder="Tu nombre"
            className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
          />
          <input
            type="email"
            required
            value={form.email}
            onChange={set('email')}
            placeholder="tu@correo.com"
            className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={set('password')}
            placeholder="Contraseña (mín 6)"
            className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
          />
          <input
            value={form.phone}
            onChange={set('phone')}
            placeholder="Teléfono 8888-8888 (opcional)"
            pattern="\d{4}-\d{4}"
            title="Formato 8888-8888"
            className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
          />
          {/* Lanzamiento en Nicoya: ciudad fija (Liberia es a futuro) */}
          <input
            value={form.defaultAddress}
            onChange={set('defaultAddress')}
            placeholder="Dirección de entrega (opcional)"
            className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={useGpsLocation}
            disabled={locating}
            className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
              gps
                ? 'bg-kiwi-100 dark:bg-kiwi-400/10 text-kiwi-700 dark:text-kiwi-300'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-200'
            }`}
          >
            {locating
              ? 'Ubicando…'
              : gps
                ? '✓ Ubicación lista para tu entrega'
                : '📍 Usar mi ubicación GPS'}
          </button>
          {locDenied && !gps && (
            <p className="text-xs text-surface-500">
              No pudimos usar el GPS; podés escribir tu dirección arriba.
            </p>
          )}
          <ZonePicker
            value={form.deliveryZone}
            onChange={(zoneId) => {
              setGpsZoneAuto(false);
              setForm((f) => ({ ...f, deliveryZone: zoneId }));
            }}
          />
          {gpsZoneAuto && form.deliveryZone && (
            <p className="text-xs text-kiwi-700 dark:text-kiwi-300">
              📍 Elegimos tu barrio por tu ubicación (podés cambiarlo).
            </p>
          )}
          <label className="flex items-start gap-2 text-xs text-surface-500">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Acepto los{' '}
              <a href="/terms" className="underline">
                Términos
              </a>{' '}
              y la{' '}
              <a href="/privacy" className="underline">
                Política de Privacidad
              </a>
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-surface-500">
            <input
              type="checkbox"
              checked={offers}
              onChange={(e) => setOffers(e.target.checked)}
              className="mt-0.5"
            />
            Quiero recibir ofertas de comercios de mi ciudad (podés apagarlo cuando quieras)
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={loading}
            className="w-full rounded-xl bg-kiwi-600 text-white font-semibold py-3 disabled:opacity-60"
          >
            {loading ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="text-sm text-center mt-4">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="font-semibold text-kiwi-700">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
