// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, KiwiLogo, api, ZonePicker, useInviteReferral, WaitlistNotice } from '@kiwi/ui';
import { findNearestZone } from '@kiwi/types';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <ClientRegisterForm />
    </Suspense>
  );
}

function ClientRegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  // Link del correo del admin (?email=&invitation=) + referido (?referral=).
  const {
    invitedEmail,
    invitationToken,
    inviteState,
    referral,
    setReferral,
    referralOffer,
    referralValid,
    referralChecking,
  } = useInviteReferral('customer');
  const [form, setForm] = useState({
    fullName: '',
    email: invitedEmail,
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
  const [waitlist, setWaitlist] = useState<{ city: string; message: string } | null>(null);

  // El email del link de invitación llega después del primer render.
  useEffect(() => {
    if (invitedEmail) setForm((f) => (f.email ? f : { ...f, email: invitedEmail }));
  }, [invitedEmail]);

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
      const res = await register({
        email: form.email.trim(),
        password: form.password,
        acceptedTerms,
        fullName: form.fullName.trim() || undefined,
        phone: normalizePhone(form.phone) || undefined,
        citySlug: form.citySlug,
        defaultAddress: form.defaultAddress.trim() || undefined,
        deliveryZone: form.deliveryZone || undefined,
        ...(gps ? { latitude: gps.lat, longitude: gps.lng } : {}),
        ...(invitationToken ? { invitationToken } : {}),
        ...(referral.trim() ? { referralCode: referral.trim() } : {}),
        role: 'customer',
      });
      if ((res as any)?.outsideCoverage) {
        setWaitlist((res as any).outsideCoverage);
        setLoading(false);
        return;
      }
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

  // Acepta +506 7219 9768, 72199768, 7219-9768 y lo deja en 8888-8888.
  // Se formatea al salir del campo (no mientras escribe, para no pelear
  // con el teclado) y de nuevo al enviar. El backend normaliza igual.
  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/[^\d]/g, '');
    const local = digits.length === 11 && digits.startsWith('506') ? digits.slice(3) : digits;
    return /^\d{8}$/.test(local) ? `${local.slice(0, 4)}-${local.slice(4)}` : raw.trim();
  };

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
        {waitlist ? (
          <WaitlistNotice
            city={waitlist.city}
            message={waitlist.message}
            actionLabel="Ir a la app"
            onContinue={() => {
              const next =
                typeof window !== 'undefined'
                  ? window.sessionStorage.getItem('kiwi_redirect_after_login')
                  : null;
              if (next) window.sessionStorage.removeItem('kiwi_redirect_after_login');
              router.push(next && next.startsWith('/') ? next : '/');
            }}
          />
        ) : (
          <>
            {inviteState && (
              <div
                role="status"
                className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
                  inviteState === 'valid'
                    ? 'border-kiwi-200 bg-kiwi-50 text-kiwi-700'
                    : 'border-amber-300 bg-amber-50 text-amber-800'
                }`}
              >
                {inviteState === 'valid'
                  ? '🥝 Te invitaron a pedir con Kiwi — completá el registro con este correo.'
                  : 'Ese link de invitación venció o no es válido. Podés registrarte igual.'}
              </div>
            )}
            <form
              onSubmit={submit}
              className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6 space-y-3"
            >
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
                onBlur={() => setForm((f) => ({ ...f, phone: normalizePhone(f.phone) }))}
                placeholder="Teléfono 8888-8888 (opcional)"
                title="Acepta +506, espacios y guiones: lo dejamos en 8888-8888"
                className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
              />
              {/* Ciudad: hoy operamos en Nicoya; si sos de otro lado te avisamos al llegar */}
              <input
                value={form.citySlug}
                onChange={set('citySlug')}
                placeholder="Ciudad (ej. Nicoya)"
                title="Hoy operamos en Nicoya. Si sos de otro lado, te avisamos cuando lleguemos."
                className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
              />
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
              <input
                value={referral}
                onChange={(e) =>
                  setReferral(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 20),
                  )
                }
                placeholder="Código de referido (opcional)"
                autoComplete="off"
                className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none uppercase"
              />
              {referral.trim() !== '' && (
                <div className="text-xs" role="status">
                  {referralChecking ? (
                    <span className="text-surface-500">Verificando código…</span>
                  ) : referralValid && referralOffer ? (
                    <span className="font-medium text-kiwi-700 dark:text-kiwi-300">
                      🎟️ {referralOffer.title}
                      {referralOffer.detail ? ` — ${referralOffer.detail}` : ''}
                    </span>
                  ) : referralValid ? (
                    <span className="font-medium text-kiwi-700 dark:text-kiwi-300">
                      🎟️ Código válido
                    </span>
                  ) : (
                    <span className="text-amber-600">Ese código no existe o venció.</span>
                  )}
                </div>
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
          </>
        )}
      </div>
    </div>
  );
}
