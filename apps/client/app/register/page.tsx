// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, KiwiLogo, api } from '@kiwi/ui';

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
  });
  const [offers, setOffers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        citySlug: form.citySlug,
        defaultAddress: form.defaultAddress.trim() || undefined,
        role: 'customer',
      });
      // Opt-out de ofertas si no quiere (default ON en el server).
      if (!offers) {
        try {
          await api.setTopicPreference('customer.offers', false);
        } catch {}
      }
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 px-4 py-10">
      <div className="mx-auto max-w-sm">
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
            className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
          />
          <div className="flex gap-2">
            {['nicoya', 'liberia'].map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm((f) => ({ ...f, citySlug: c }))}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm capitalize ${form.citySlug === c ? 'bg-kiwi-600 text-white font-semibold' : 'bg-surface-100 dark:bg-surface-800'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={form.defaultAddress}
            onChange={set('defaultAddress')}
            placeholder="Dirección de entrega (opcional)"
            className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
          />
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
