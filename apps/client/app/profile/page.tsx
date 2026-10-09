// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, MapPin, Bell, ClipboardList, LogOut } from 'lucide-react';
import { api, useAuth, KiwiLogo } from '@kiwi/ui';
import { BottomNav } from '../components/BottomNav';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [offersOn, setOffersOn] = useState(true);

  useEffect(() => {
    if (!loading && !user) return;
    if (!user) return;
    let cancelled = false;
    api
      .getCustomerProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => undefined);
    api
      .getNotificationTopics()
      .then((topics) => {
        if (cancelled || !Array.isArray(topics)) return;
        const t = topics.find((x) => x.name === 'customer.offers');
        if (t) setOffersOn(t.enabled !== false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  const toggleOffers = async () => {
    const next = !offersOn;
    setOffersOn(next);
    try {
      await api.setTopicPreference('customer.offers', next);
    } catch {
      setOffersOn(!next);
    }
  };

  const signOut = () => {
    logout();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 px-4 py-10">
        <div className="mx-auto max-w-sm rounded-2xl glass p-6 animate-pulse">
          <div className="h-4 w-2/3 bg-surface-200 dark:bg-surface-700 rounded mb-2" />
          <div className="h-3 w-1/2 bg-surface-200 dark:bg-surface-700 rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 px-4 py-10 pb-24">
        <div className="mx-auto max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <KiwiLogo size={40} />
          </div>
          <h1 className="text-xl font-display font-bold mb-1">Mi cuenta</h1>
          <p className="text-sm text-surface-500 mb-6">
            Entrá o creá tu cuenta para pedir más rápido y recibir ofertas
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className="rounded-xl bg-kiwi-600 text-white font-semibold py-3 text-center"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-kiwi-600/30 font-semibold py-3 text-center text-kiwi-700 dark:text-kiwi-300"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 px-4 py-6 pb-24">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-100 dark:bg-kiwi-400/10">
            <User className="h-7 w-7 text-kiwi-700 dark:text-kiwi-300" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold">
              {profile?.fullName || (user as any)?.email || 'Mi cuenta'}
            </h1>
            <p className="text-sm text-surface-500">{(user as any)?.email}</p>
          </div>
        </div>

        <div className="rounded-2xl glass p-5 mb-3 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-surface-400 shrink-0" />
            <span>
              {profile?.defaultAddress || 'Sin dirección guardada'}
              {profile?.citySlug ? ` · ${profile.citySlug}` : ''}
            </span>
          </div>
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-surface-400 shrink-0" />
              Ofertas de comercios
            </span>
            <input
              type="checkbox"
              checked={offersOn}
              onChange={toggleOffers}
              className="h-5 w-5 accent-kiwi-600"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/orders"
            className="flex items-center justify-center gap-2 rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white"
          >
            <ClipboardList className="h-4 w-4" /> Mis pedidos
          </Link>
          <button
            onClick={signOut}
            className="flex items-center justify-center gap-2 rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3 text-sm font-semibold text-surface-600 dark:text-surface-300"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
