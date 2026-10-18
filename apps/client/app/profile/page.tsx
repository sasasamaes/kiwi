// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Bell,
  ClipboardList,
  LogOut,
  Pencil,
  X,
  Check,
  Phone,
  Heart,
  Navigation,
} from 'lucide-react';
import { api, useAuth, KiwiLogo, ZonePicker } from '@kiwi/ui';
import { BottomNav } from '../components/BottomNav';
import { AvatarEditor } from '../components/AvatarEditor';
import { InstallAppButton } from '../components/InstallAppButton';

// Acepta +506 7219 9768, 72199768, 7219-9768 → 8888-8888 (igual que registro).
const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/[^\d]/g, '');
  const local = digits.length === 11 && digits.startsWith('506') ? digits.slice(3) : digits;
  return /^\d{8}$/.test(local) ? `${local.slice(0, 4)}-${local.slice(4)}` : raw.trim();
};

/** Mini-mapa para marcar el punto exacto de un lugar (el repartidor ve ese
 * pin). Click = poner/mover, arrastrar el kiwi = afinar. */
function PlaceMapPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const LRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const drawMarker = () => {
    const L = LRef.current;
    const map = mapObj.current;
    if (!L || !map) return;
    if (markerObj.current) {
      markerObj.current.remove();
      markerObj.current = null;
    }
    if (lat == null || lng == null) return;
    const icon = L.divIcon({
      html: '<img src="/kiwi.svg" alt="Punto de entrega" style="width:34px;height:34px;display:block;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);background:#fff;"/>',
      className: 'place-point',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = L.marker([lat, lng], { draggable: true, icon })
      .addTo(map)
      .bindTooltip('Tu punto de entrega — arrastrá para afinar');
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onPickRef.current(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
    });
    markerObj.current = marker;
  };

  // Init una sola vez (el padre lo remonta con key al cambiar de lugar).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod: any = await import('leaflet');
      if (cancelled || mapObj.current || !mapDivRef.current) return;
      const L = mod.default ?? mod;
      LRef.current = L;
      const hasPt = lat != null && lng != null;
      const map = L.map(mapDivRef.current).setView(
        hasPt ? [lat as number, lng as number] : [10.1467, -85.452],
        hasPt ? 16 : 13,
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      map.on('click', (e: any) => {
        onPickRef.current(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      });
      mapObj.current = map;
      setTimeout(() => {
        if (!cancelled && mapObj.current) mapObj.current.invalidateSize();
      }, 150);
      drawMarker();
    })();
    return () => {
      cancelled = true;
      if (mapObj.current) {
        mapObj.current.remove();
        mapObj.current = null;
      }
      markerObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El GPS o otro lugar mueven el pin: recentrar + redibujar.
  useEffect(() => {
    if (!mapObj.current) return;
    if (lat != null && lng != null) {
      mapObj.current.setView([lat, lng], Math.max(mapObj.current.getZoom(), 15));
    }
    drawMarker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div
      ref={mapDivRef}
      className="h-52 w-full overflow-hidden rounded-xl bg-surface-100 dark:bg-surface-800"
    />
  );
}

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
  /** Zona resuelta por el servidor para el GPS del perfil (id+etiqueta). */
  const [gpsResolved, setGpsResolved] = useState<{ id: string; label: string } | null>(null);
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
  /** Zona resuelta por el servidor para el GPS del lugar (id+etiqueta). */
  const [placeResolved, setPlaceResolved] = useState<{ id: string; label: string } | null>(null);
  const [placeSaving, setPlaceSaving] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placeActing, setPlaceActing] = useState<string | null>(null);
  /** Lugar en edición (null = creando uno nuevo). */
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);

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
        // Resolver en el servidor (ids UUID de la DB): el catálogo local usa
        // slugs y el picker no matchea (mostraba "Barrio detectado" genérico).
        api
          .resolveDeliveryZone(coords.lat, coords.lng)
          .then((r) => {
            if (!r.zone) return;
            setGpsResolved({ id: r.zone.id, label: r.zone.label });
            setForm((f) => ({ ...f, deliveryZone: r.zone.id }));
            setGpsZoneAuto(true);
          })
          .catch(() => undefined);
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
        // Resolver en el servidor (ver comentario en useGpsLocation).
        api
          .resolveDeliveryZone(coords.lat, coords.lng)
          .then((r) => {
            if (!r.zone) return;
            setPlaceResolved({ id: r.zone.id, label: r.zone.label });
            setPlaceZone(r.zone.id);
          })
          .catch(() => undefined);
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
      const label = placeLabel.trim();
      const address = placeAddress.trim();
      if (editingPlaceId) {
        await api.updateAddress(editingPlaceId, {
          label,
          address,
          latitude: placeGps ? placeGps.lat : null,
          longitude: placeGps ? placeGps.lng : null,
          ...(placeZone ? { deliveryZone: placeZone } : {}),
        });
      } else {
        await api.createAddress({
          label,
          address,
          ...(placeGps ? { latitude: placeGps.lat, longitude: placeGps.lng } : {}),
          ...(placeZone ? { deliveryZone: placeZone } : {}),
        });
      }
      resetPlaceForm();
      setShowPlaceForm(false);
      await reloadPlaces();
    } catch (e: any) {
      setPlaceError(e?.message || 'No se pudo guardar el lugar');
    } finally {
      setPlaceSaving(false);
    }
  };

  const resetPlaceForm = () => {
    setPlaceLabel('');
    setPlaceAddress('');
    setPlaceZone('');
    setPlaceGps(null);
    setPlaceResolved(null);
    setPlaceError(null);
    setEditingPlaceId(null);
  };

  const startEditPlace = (p: {
    id: string;
    label: string;
    address: string;
    latitude: number | string | null;
    longitude: number | string | null;
    deliveryZone: string | null;
  }) => {
    setEditingPlaceId(p.id);
    setPlaceLabel(p.label);
    setPlaceAddress(p.address);
    setPlaceZone(p.deliveryZone ?? '');
    const la = Number(p.latitude);
    const ln = Number(p.longitude);
    setPlaceGps(
      p.latitude != null && p.longitude != null && Number.isFinite(la) && Number.isFinite(ln)
        ? { lat: la, lng: ln }
        : null,
    );
    setPlaceResolved(null);
    setPlaceError(null);
    setShowPlaceForm(true);
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
              <MapPin className="h-4 w-4 text-surface-500 dark:text-surface-400 shrink-0" />
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
              <Phone className="h-4 w-4 text-surface-500 dark:text-surface-400 shrink-0" />
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm font-semibold disabled:opacity-60"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                {locating ? 'Ubicando…' : gps ? 'Ubicación lista' : 'Usar mi ubicación GPS'}
              </button>
              <ZonePicker
                value={form.deliveryZone}
                detectedLabel={
                  gpsResolved && gpsResolved.id === form.deliveryZone ? gpsResolved.label : null
                }
                onChange={(zoneId) => {
                  setGpsZoneAuto(false);
                  setGpsResolved(null);
                  setForm((f) => ({ ...f, deliveryZone: zoneId }));
                }}
              />
              {gpsZoneAuto && form.deliveryZone && (
                <p className="flex items-center gap-1 text-xs text-kiwi-700 dark:text-kiwi-300">
                  <MapPin className="h-3 w-3" aria-hidden /> Barrio por tu ubicación (podés
                  cambiarlo).
                </p>
              )}
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              {savedTick && (
                <p className="flex items-center gap-1 text-xs text-kiwi-700 dark:text-kiwi-300">
                  <Check className="h-3 w-3" aria-hidden /> Guardado
                </p>
              )}
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
            <p className="flex items-center gap-1 text-xs text-kiwi-700 dark:text-kiwi-300">
              <Check className="h-3 w-3" aria-hidden /> Datos actualizados
            </p>
          )}
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-surface-500 dark:text-surface-400 shrink-0" />
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
              <Heart
                className="h-4 w-4 text-surface-500 dark:text-surface-400 shrink-0"
                aria-hidden
              />
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
            <p className="flex items-center gap-1.5 text-sm font-semibold text-surface-700 dark:text-surface-200">
              <MapPin className="h-4 w-4" aria-hidden /> Mis lugares
            </p>
            <button
              onClick={() => {
                if (showPlaceForm) {
                  resetPlaceForm();
                  setShowPlaceForm(false);
                } else {
                  resetPlaceForm();
                  setShowPlaceForm(true);
                }
              }}
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm font-semibold disabled:opacity-60"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                {placeLocating
                  ? 'Ubicando…'
                  : placeGps
                    ? 'Ubicación lista'
                    : 'Usar mi ubicación GPS'}
              </button>
              <PlaceMapPicker
                key={editingPlaceId ?? 'new'}
                lat={placeGps?.lat ?? null}
                lng={placeGps?.lng ?? null}
                onPick={(la, ln) => {
                  setPlaceGps({ lat: la, lng: ln });
                  // El pin manda: resolver la zona del punto.
                  api
                    .resolveDeliveryZone(la, ln)
                    .then((r) => {
                      if (!r.zone) return;
                      setPlaceResolved({ id: r.zone.id, label: r.zone.label });
                      setPlaceZone(r.zone.id);
                    })
                    .catch(() => undefined);
                }}
              />
              {placeGps ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    📍 {placeGps.lat.toFixed(6)}, {placeGps.lng.toFixed(6)} · arrastrá el kiwi para
                    afinar.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaceGps(null);
                      setPlaceResolved(null);
                    }}
                    className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500"
                  >
                    Quitar punto
                  </button>
                </div>
              ) : (
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Sin punto marcado: tocá el mapa donde llegan los repartidores. Podés quitarlo si
                  el lugar es raro o peligroso.
                </p>
              )}
              <ZonePicker
                value={placeZone}
                detectedLabel={
                  placeResolved && placeResolved.id === placeZone ? placeResolved.label : null
                }
                onChange={(zoneId) => {
                  setPlaceResolved(null);
                  setPlaceZone(zoneId);
                }}
              />
              {placeError && <p className="text-xs text-red-600">{placeError}</p>}
              <button
                onClick={() => void savePlace()}
                disabled={placeSaving}
                className="w-full rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {placeSaving ? 'Guardando…' : editingPlaceId ? 'Guardar cambios' : 'Guardar lugar'}
              </button>
              {editingPlaceId && (
                <button
                  onClick={() => {
                    resetPlaceForm();
                    setShowPlaceForm(false);
                  }}
                  className="w-full rounded-xl px-4 py-2 text-xs font-semibold text-surface-500 dark:text-surface-400"
                >
                  Cancelar edición
                </button>
              )}
            </div>
          )}
          {places.length === 0 ? (
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Todavía no guardaste lugares.
            </p>
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
                    <p className="truncate text-xs text-surface-500">
                      {p.address}
                      {p.latitude != null && p.longitude != null ? ' · 📍' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => startEditPlace(p)}
                    disabled={placeActing === p.id}
                    className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-surface-500 dark:text-surface-400 disabled:opacity-50"
                    title="Editar"
                    aria-label={`Editar ${p.label}`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
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
            <p className="flex items-center gap-1.5 text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3">
              <Heart className="h-4 w-4" aria-hidden /> Comercios que sigo
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
                    className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-surface-500 dark:text-surface-400 hover:text-red-500"
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
