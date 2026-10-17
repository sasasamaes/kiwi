// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Bell, ClipboardList, LogOut, Pencil, X, Check, Phone } from 'lucide-react';
import { api, useAuth, KiwiLogo, ZonePicker } from '@kiwi/ui';
import { findNearestZone } from '@kiwi/types';
import { BottomNav } from '../components/BottomNav';
import { AvatarEditor } from '../components/AvatarEditor';
import { InstallAppButton } from '../components/InstallAppButton';

// Acepta +506 7219 9768, 72199768, 7219-9768 → 8888-8888 (igual que registro).
const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/[^\d]/g, '');
  const local = digits.length === 11 && digits.startsWith('506') ? digits.slice(3) : digits;
  return /^\d{8}$/.test(local) ? `${local.slice(0, 4)}-${local.slice(4)}` : raw.trim();
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout, updateUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [offersOn, setOffersOn] = useState(true);
  const [followsOn, setFollowsOn] = useState(true);
  const [follows, setFollows] = useState<
    Array<{
      id: string;
      businessName: string;
      logoUrl: string | null;
      address: string;
      isHomeCook: boolean;
    }>
  >([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    defaultAddress: '',
    deliveryZone: '',
  });
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsZoneAuto, setGpsZoneAuto] = useState(false);
  const [locating, setLocating] = useState(false);
  // Libreta de lugares (Casa, Casa de mamá…).
  const [places, setPlaces] = useState<
    Array<{
      id: string;
      label: string;
      address: string;
      latitude: number | string | null;
      longitude: number | string | null;
      deliveryZone: string | null;
      isDefault: boolean;
    }>
  >([]);
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [placeLabel, setPlaceLabel] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeZone, setPlaceZone] = useState('');
  const [placeGps, setPlaceGps] = useState<{ lat: number; lng: number } | null>(null);
  const [placeLocating, setPlaceLocating] = useState(false);
  const [placeSaving, setPlaceSaving] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placeActing, setPlaceActing] = useState<string | null>(null);

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
        const f = topics.find((x) => x.name === 'customer.follows');
        if (f) setFollowsOn(f.enabled !== false);
      })
      .catch(() => undefined);
    api
      .getMyFollows()
      .then((list) => {
        if (!cancelled) setFollows(Array.isArray(list) ? list : []);
      })
      .catch(() => undefined);
    api
      .getMyAddresses()
      .then((list) => {
        if (!cancelled) setPlaces(Array.isArray(list) ? list : []);
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

  const toggleFollows = async () => {
    const next = !followsOn;
    setFollowsOn(next);
    try {
      await api.setTopicPreference('customer.follows', next);
    } catch {
      setFollowsOn(!next);
    }
  };

  const removeFollow = async (merchantId: string) => {
    const prev = follows;
    setFollows((list) => list.filter((f) => f.id !== merchantId));
    try {
      await api.unfollowMerchant(merchantId);
    } catch {
      setFollows(prev);
    }
  };

  const signOut = () => {
    logout();
    router.push('/');
  };

  const startEditing = () => {
    setForm({
      fullName: profile?.fullName || '',
      phone: (user as any)?.phone || '',
      defaultAddress: profile?.defaultAddress || '',
      deliveryZone: profile?.deliveryZone || '',
    });
    setGps(null);
    setGpsZoneAuto(false);
    setFormError(null);
    setSavedTick(false);
    setEditing(true);
  };

  const useGpsLocation = () => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(coords);
        setLocating(false);
        try {
          const near = findNearestZone(coords.lat, coords.lng);
          if (near?.confident) {
            setForm((f) => ({ ...f, deliveryZone: near.zone.id }));
            setGpsZoneAuto(true);
          }
        } catch {
          // sin zona: el picker manual sigue disponible
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const reloadPlaces = async () => {
    try {
      const list = await api.getMyAddresses();
      setPlaces(Array.isArray(list) ? list : []);
    } catch {
      // best-effort
    }
  };

  const usePlaceGps = () => {
    if (!('geolocation' in navigator)) return;
    setPlaceLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPlaceGps(coords);
        setPlaceLocating(false);
        try {
          const near = findNearestZone(coords.lat, coords.lng);
          if (near?.confident) setPlaceZone(near.zone.id);
        } catch {
          // sin zona: el picker manual sigue disponible
        }
      },
      () => setPlaceLocating(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const savePlace = async () => {
    if (!placeLabel.trim() || !placeAddress.trim()) {
      setPlaceError('Poné nombre y dirección del lugar');
      return;
    }
    setPlaceSaving(true);
    setPlaceError(null);
    try {
      await api.createAddress({
        label: placeLabel.trim(),
        address: placeAddress.trim(),
        ...(placeGps ? { latitude: placeGps.lat, longitude: placeGps.lng } : {}),
        ...(placeZone ? { deliveryZone: placeZone } : {}),
      });
      setPlaceLabel('');
      setPlaceAddress('');
      setPlaceZone('');
      setPlaceGps(null);
      setShowPlaceForm(false);
      await reloadPlaces();
    } catch (e: any) {
      setPlaceError(e?.message || 'No se pudo guardar el lugar');
    } finally {
      setPlaceSaving(false);
    }
  };

  const removePlace = async (id: string) => {
    if (!window.confirm('¿Borrar este lugar?')) return;
    setPlaceActing(id);
    try {
      await api.deleteAddress(id);
      await reloadPlaces();
    } catch {
      // best-effort
    } finally {
      setPlaceActing(null);
    }
  };

  const defaultPlace = async (id: string) => {
    setPlaceActing(id);
    try {
      await api.setDefaultAddress(id);
      await reloadPlaces();
      const p = await api.getCustomerProfile().catch(() => null);
      if (p) setProfile(p);
    } catch {
      // best-effort
    } finally {
      setPlaceActing(null);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const phone = normalizePhone(form.phone);
      if (form.phone.trim() !== '' && !/^\d{4}-\d{4}$/.test(phone)) {
        throw new Error('Teléfono inválido (formato 8888-8888)');
      }
      const [updated] = await Promise.all([
        api.updateCustomerProfile({
          fullName: form.fullName.trim() || null,
          defaultAddress: form.defaultAddress.trim() || null,
          deliveryZone: form.deliveryZone || null,
          ...(gps ? { latitude: gps.lat, longitude: gps.lng } : {}),
        }),
        api.updateMe({ phone: phone || null }),
      ]);
      setProfile(updated);
      updateUser({ phone: phone || undefined } as any);
      setEditing(false);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 3000);
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 px-4 py-10">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6 animate-pulse">
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
          <AvatarEditor
            avatarUrl={profile?.avatarUrl}
            onChange={(url) => setProfile((p: any) => (p ? { ...p, avatarUrl: url } : p))}
          />
          <div>
            <h1 className="text-xl font-display font-bold">
              {profile?.fullName || (user as any)?.email || 'Mi cuenta'}
            </h1>
            <p className="text-sm text-surface-500">{(user as any)?.email}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-5 mb-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <MapPin className="h-4 w-4 text-surface-400 shrink-0" />
              <span className="truncate">
                {profile?.defaultAddress || 'Sin dirección guardada'}
                {profile?.citySlug ? ` · ${profile.citySlug}` : ''}
              </span>
            </div>
            {!editing && (
              <button
                onClick={startEditing}
                className="flex shrink-0 items-center gap-1 rounded-full bg-surface-100 dark:bg-surface-700 px-3 py-1.5 text-xs font-semibold text-surface-600 dark:text-surface-300"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
          </div>
          {(user as any)?.phone && !editing && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-surface-400 shrink-0" />
              <span>{(user as any).phone}</span>
            </div>
          )}
          {editing && (
            <div className="space-y-3 pt-1">
              <input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Tu nombre"
                className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                onBlur={() => setForm((f) => ({ ...f, phone: normalizePhone(f.phone) }))}
                placeholder="Teléfono 8888-8888"
                inputMode="tel"
                className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
              />
              <input
                value={form.defaultAddress}
                onChange={(e) => setForm((f) => ({ ...f, defaultAddress: e.target.value }))}
                placeholder="Dirección de entrega"
                className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={useGpsLocation}
                disabled={locating}
                className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {locating ? 'Ubicando…' : gps ? '✓ Ubicación lista' : '📍 Usar mi ubicación GPS'}
              </button>
              <ZonePicker
                value={form.deliveryZone}
                onChange={(zoneId) => {
                  setGpsZoneAuto(false);
                  setForm((f) => ({ ...f, deliveryZone: zoneId }));
                }}
              />
              {gpsZoneAuto && form.deliveryZone && (
                <p className="text-xs text-kiwi-700 dark:text-kiwi-300">
                  📍 Barrio por tu ubicación (podés cambiarlo).
                </p>
              )}
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              {savedTick && <p className="text-xs text-kiwi-700 dark:text-kiwi-300">✓ Guardado</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => void saveProfile()}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Check className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="flex items-center justify-center gap-1 rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3 text-sm font-semibold"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          {savedTick && !editing && (
            <p className="text-xs text-kiwi-700 dark:text-kiwi-300">✓ Datos actualizados</p>
          )}
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
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="flex items-center gap-3">
              <span className="text-surface-400 shrink-0">🧡</span>
              Avisos de comercios que sigo
            </span>
            <input
              type="checkbox"
              checked={followsOn}
              onChange={toggleFollows}
              className="h-5 w-5 accent-kiwi-600"
            />
          </label>
        </div>

        {/* Mis lugares (Casa, Casa de mamá…): para elegir dónde entregar */}
        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-5 mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-200">
              📍 Mis lugares
            </p>
            <button
              onClick={() => setShowPlaceForm((v) => !v)}
              className="rounded-full bg-surface-100 dark:bg-surface-700 px-3 py-1.5 text-xs font-semibold text-surface-600 dark:text-surface-300"
            >
              {showPlaceForm ? 'Cerrar' : '+ Agregar'}
            </button>
          </div>
          <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">
            Guardá tus direcciones (casa, trabajo, casa de mamá…) y elegí dónde entregar en cada
            pedido.
          </p>
          {showPlaceForm && (
            <div className="space-y-2 mb-3 rounded-xl bg-surface-50 dark:bg-surface-900 p-3">
              <input
                value={placeLabel}
                onChange={(e) => setPlaceLabel(e.target.value)}
                placeholder="Nombre (ej. Casa de mamá)"
                maxLength={40}
                className="w-full rounded-xl bg-white dark:bg-surface-800 px-4 py-3 text-sm outline-none"
              />
              <input
                value={placeAddress}
                onChange={(e) => setPlaceAddress(e.target.value)}
                placeholder="Dirección"
                maxLength={200}
                className="w-full rounded-xl bg-white dark:bg-surface-800 px-4 py-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={usePlaceGps}
                disabled={placeLocating}
                className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {placeLocating
                  ? 'Ubicando…'
                  : placeGps
                    ? '✓ Ubicación lista'
                    : '📍 Usar mi ubicación GPS'}
              </button>
              <ZonePicker value={placeZone} onChange={setPlaceZone} />
              {placeError && <p className="text-xs text-red-600">{placeError}</p>}
              <button
                onClick={() => void savePlace()}
                disabled={placeSaving}
                className="w-full rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {placeSaving ? 'Guardando…' : 'Guardar lugar'}
              </button>
            </div>
          )}
          {places.length === 0 ? (
            <p className="text-xs text-surface-400">Todavía no guardaste lugares.</p>
          ) : (
            <div className="space-y-2">
              {places.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl bg-surface-50 dark:bg-surface-900 px-3 py-2.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-900/40 text-sm font-bold text-kiwi-700 dark:text-kiwi-300">
                    {p.label.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                      {p.label}
                      {p.isDefault && (
                        <span className="ml-2 rounded-full bg-kiwi-600/10 px-2 py-0.5 text-[10px] text-kiwi-700 dark:text-kiwi-300">
                          Principal
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-surface-500">{p.address}</p>
                  </div>
                  {!p.isDefault && (
                    <button
                      onClick={() => void defaultPlace(p.id)}
                      disabled={placeActing === p.id}
                      className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-kiwi-700 dark:text-kiwi-300 disabled:opacity-50"
                      title="Marcar como principal"
                    >
                      Principal
                    </button>
                  )}
                  <button
                    onClick={() => void removePlace(p.id)}
                    disabled={placeActing === p.id}
                    className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500 disabled:opacity-50"
                    title="Borrar"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {follows.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-5 mb-3">
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3">
              🧡 Comercios que sigo
            </p>
            <div className="space-y-2">
              {follows.map((f) => (
                <div key={f.id} className="flex items-center gap-3">
                  <Link
                    href={`/menu/${f.id}`}
                    className="flex flex-1 items-center gap-3 min-w-0 rounded-xl px-2 py-1.5 hover:bg-surface-100 dark:hover:bg-surface-700"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/40 font-bold text-orange-700 dark:text-orange-300 overflow-hidden">
                      {f.businessName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-surface-800 dark:text-surface-100">
                        {f.businessName}
                      </span>
                      <span className="block truncate text-xs text-surface-500">{f.address}</span>
                    </span>
                  </Link>
                  <button
                    onClick={() => void removeFollow(f.id)}
                    aria-label={`Dejar de seguir a ${f.businessName}`}
                    className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-surface-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <InstallAppButton />
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
