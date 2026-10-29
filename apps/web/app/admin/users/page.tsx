// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Check, Loader2 } from 'lucide-react';
import { api, useAuth, KiwiLoader, useTranslations, addStreetsAndSatellite } from '@kiwi/ui';

interface AdminUser {
  id: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  loginLocked?: boolean;
  createdAt: string;
  merchantProfile?: {
    id?: string;
    businessName: string;
    address?: string | null;
    description?: string | null;
    logoUrl?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    kycStatus: string;
    cardPaymentsEnabled?: boolean;
    weeklyBillingEnabled?: boolean;
    testOrdersEnabled?: boolean;
    testOrdersUntil?: string | null;
    parentMerchantId?: string | null;
    transfersEnabled?: boolean;
    transferPriceOverride?: number | string | null;
    branches?: Array<{ id: string; businessName: string }>;
    isHomeCook?: boolean;
    pushCredits?: number;
    _count?: { orders: number };
  } | null;
  driverProfile?: {
    fullName: string;
    rating: number | string;
    totalTrips: number;
    kycStatus: string;
    status: string;
  } | null;
}

const kycOf = (u: AdminUser) =>
  u.driverProfile?.kycStatus ?? u.merchantProfile?.kycStatus ?? 'none';

const coordStr = (v: number | string | null | undefined) =>
  v == null || v === '' ? '' : String(v);

/** Editor del punto GPS de retiro de un comercio (admin). Tocás el mapa donde
 * llegan los repartidores, guardás y el punto sale en el mapa general de zonas
 * (y lo heredan los pedidos nuevos como pickup por defecto). */
function MerchantLocationEditor({
  userId,
  businessName,
  address,
  initialLat,
  initialLng,
  onSaved,
}: {
  userId: string;
  businessName: string;
  address?: string | null;
  initialLat: string;
  initialLng: string;
  onSaved: (mp: { latitude: number | null; longitude: number | null }) => void;
}) {
  const { t } = useTranslations();
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const LRef = useRef<any>(null);

  const drawMarker = () => {
    const L = LRef.current;
    const map = mapObj.current;
    if (!L || !map) return;
    if (markerObj.current) {
      markerObj.current.remove();
      markerObj.current = null;
    }
    const la = Number(lat);
    const ln = Number(lng);
    if (lat === '' || lng === '' || !Number.isFinite(la) || !Number.isFinite(ln)) return;
    const icon = L.divIcon({
      html: `<img src="/kiwi.svg" alt="${t('webadmin1.ausers.loc.markerAlt')}" style="width:34px;height:34px;display:block;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);background:#fff;"/>`,
      className: 'merchant-point',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = L.marker([la, ln], { draggable: true, icon })
      .addTo(map)
      .bindTooltip(t('webadmin1.ausers.loc.markerTip', { name: businessName }));
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      setLat(p.lat.toFixed(6));
      setLng(p.lng.toFixed(6));
    });
    markerObj.current = marker;
  };

  // Init una vez (el padre lo remonta por comercio con key={userId}).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod: any = await import('leaflet');
      if (cancelled || mapObj.current || !mapDivRef.current) return;
      const L = mod.default ?? mod;
      LRef.current = L;
      const la = Number(lat);
      const ln = Number(lng);
      const hasPt = lat !== '' && lng !== '' && Number.isFinite(la) && Number.isFinite(ln);
      const map = L.map(mapDivRef.current).setView(
        hasPt ? [la, ln] : [10.1467, -85.452],
        hasPt ? 16 : 13,
      );
      addStreetsAndSatellite(map, L);
      map.on('click', (e: any) => {
        setLat(e.latlng.lat.toFixed(6));
        setLng(e.latlng.lng.toFixed(6));
      });
      mapObj.current = map;
      // El modal anima al abrir: recalibrar tamaño tras el primer paint.
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

  // Redibuja el kiwi cuando cambia el punto (incluye al quitarlo).
  useEffect(() => {
    if (mapObj.current) drawMarker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  const hasPt = lat !== '' && lng !== '';

  const save = async () => {
    const latRaw = lat.trim() === '' ? null : Number(lat);
    const lngRaw = lng.trim() === '' ? null : Number(lng);
    if (
      (latRaw == null) !== (lngRaw == null) ||
      (latRaw != null && (!Number.isFinite(latRaw) || !Number.isFinite(lngRaw!)))
    ) {
      setMsg({ ok: false, text: t('webadmin1.ausers.loc.needPoint') });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api.setMerchantLocation(userId, {
        latitude: latRaw,
        longitude: lngRaw,
      });
      const mp = updated?.merchantProfile ?? { latitude: latRaw, longitude: lngRaw };
      onSaved({ latitude: mp.latitude ?? null, longitude: mp.longitude ?? null });
      setMsg({ ok: true, text: t('webadmin1.ausers.loc.saved') });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || t('webadmin1.ausers.loc.saveError') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
      <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
        {t('webadmin1.ausers.loc.title')}
      </p>
      <p className="text-xs text-surface-500">{t('webadmin1.ausers.loc.hint')}</p>
      {!!address && (
        <p className="mt-1 text-xs text-surface-500">
          {t('webadmin1.ausers.loc.address', { address })}
        </p>
      )}
      <div
        ref={mapDivRef}
        className="mt-2 h-56 w-full overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700"
      />
      <p className="mt-2 text-xs text-surface-500">
        {hasPt ? (
          <>{t('webadmin1.ausers.loc.pointSet', { lat, lng })}</>
        ) : (
          t('webadmin1.ausers.loc.noPoint')
        )}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setLat('');
            setLng('');
          }}
          disabled={!hasPt}
          className="rounded-lg border border-surface-200 dark:border-surface-600 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          {t('webadmin1.ausers.loc.remove')}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="flex-1 py-1.5 px-3 text-xs font-medium rounded-lg bg-kiwi-700 text-white hover:bg-kiwi-800 transition-colors disabled:opacity-50"
        >
          {saving ? t('webadmin1.ausers.loc.saving') : t('webadmin1.ausers.loc.save')}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs font-medium ${msg.ok ? 'text-kiwi-700' : 'text-red-500'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

/** Setup rápido del comercio (admin): foto de perfil + info básica para
 * dejarlo configurado sin depender de que el comercio lo haga solo. */
function MerchantQuickSetup({
  user,
  onSaved,
}: {
  user: AdminUser;
  onSaved: (mp: {
    businessName: string;
    address: string | null;
    description: string | null;
    logoUrl: string | null;
    phone: string | null;
  }) => void;
}) {
  const { t } = useTranslations();
  const mp = user.merchantProfile!;
  const [name, setName] = useState(mp.businessName ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [address, setAddress] = useState(mp.address ?? '');
  const [desc, setDesc] = useState(mp.description ?? '');
  const [logo, setLogo] = useState<string | null>(mp.logoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!name.trim()) {
      setMsg({ ok: false, text: t('webadmin1.ausers.setup.saveError') });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api.updateMerchantProfileAdmin(user.id, {
        businessName: name.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
        description: desc.trim() || null,
        logoUrl: logo,
      });
      const nmp = updated?.merchantProfile ?? {};
      const nphone: string | null = updated?.phone ?? (phone.trim() ? phone.trim() : null);
      onSaved({
        businessName: nmp.businessName ?? name.trim(),
        address: nmp.address ?? null,
        description: nmp.description ?? null,
        logoUrl: nmp.logoUrl ?? null,
        phone: nphone || null,
      });
      setMsg({ ok: true, text: t('webadmin1.ausers.setup.saved') });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || t('webadmin1.ausers.setup.saveError') });
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setMsg(null);
    try {
      const { url } = await api.uploadMerchantLogoFor(user.id, file);
      setLogo(url);
      onSaved({
        businessName: name.trim() || mp.businessName,
        address: address.trim() || null,
        description: desc.trim() || null,
        logoUrl: url,
        phone: phone.trim() || null,
      });
      setMsg({ ok: true, text: t('webadmin1.ausers.setup.logoSaved') });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || t('webadmin1.ausers.setup.logoError') });
    } finally {
      setUploading(false);
    }
  };

  const isHttp = logo ? /^https:\/\//i.test(logo) : false;
  const isEmoji = logo ? logo.length <= 8 && /[^ -~]/.test(logo) : false;

  return (
    <div className="mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
      <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
        {t('webadmin1.ausers.setup.title')}
      </p>
      <p className="text-xs text-surface-500">{t('webadmin1.ausers.setup.hint')}</p>

      <div className="mt-3 flex items-start gap-3">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={t('webadmin1.ausers.setup.changeLogo')}
            title={t('webadmin1.ausers.setup.changeLogo')}
            className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-kiwi-100 dark:bg-kiwi-900/50 text-2xl font-bold text-kiwi-700 dark:text-kiwi-300 disabled:opacity-60"
          >
            {isHttp ? (
              // NOTE: <img> intencional — logo dinámico de Cloudinary.
              <img src={logo as string} alt={name || 'Logo'} className="h-16 w-16 object-cover" />
            ) : isEmoji ? (
              <span className="text-4xl leading-none">{logo}</span>
            ) : (
              (name || 'M').charAt(0).toUpperCase()
            )}
            <span className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-kiwi-700 text-white text-[10px]">
              📷
            </span>
          </button>
          {uploading && (
            <p className="mt-1 text-[11px] text-surface-500">
              {t('webadmin1.ausers.setup.uploadingLogo')}
            </p>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <label className="text-xs text-surface-500">{t('webadmin1.ausers.setup.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
          <div>
            <label className="text-xs text-surface-500">{t('webadmin1.ausers.setup.phone')}</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="8888-8888"
              className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
        </div>
      </div>

      <div className="mt-2">
        <label className="text-xs text-surface-500">{t('webadmin1.ausers.setup.address')}</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
        />
      </div>
      <div className="mt-2">
        <label className="text-xs text-surface-500">
          {t('webadmin1.ausers.setup.description')}
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t('webadmin1.ausers.setup.descPh')}
          rows={2}
          className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
        />
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setLogo(null)}
          disabled={!logo || saving}
          className="rounded-lg border border-surface-200 dark:border-surface-600 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          {t('webadmin1.ausers.setup.removeLogo')}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || uploading}
          className="flex-1 py-1.5 px-3 text-xs font-medium rounded-lg bg-kiwi-700 text-white hover:bg-kiwi-800 transition-colors disabled:opacity-50"
        >
          {saving ? t('webadmin1.ausers.saving') : t('webadmin1.ausers.setup.save')}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs font-medium ${msg.ok ? 'text-kiwi-700' : 'text-red-500'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export default function UsersPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<'all' | 'driver' | 'merchant' | 'admin'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [pushAmount, setPushAmount] = useState('4');
  const [grantingPush, setGrantingPush] = useState(false);
  // Comercios para el selector "Sede de" (colgar bajo matriz).
  const [allMerchants, setAllMerchants] = useState<Array<{ id: string; businessName: string }>>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = (u: AdminUser) =>
    u.driverProfile?.fullName ||
    u.merchantProfile?.businessName ||
    u.email ||
    t('webadmin1.ausers.fallbackName');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const load = useCallback(
    async (role: string, q: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getUsersAdmin({
          role: role === 'all' ? undefined : role,
          search: q.trim() || undefined,
          take: 50,
        });
        setUsers(Array.isArray(res?.users) ? res.users : []);
        setTotal(Number(res?.total ?? 0));
      } catch (e: any) {
        setError(e?.message || t('webadmin1.ausers.loadError'));
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!user) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(filter, search), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [user, filter, search, load]);

  useEffect(() => {
    if (!user) return;
    api
      .getMerchantsAdmin()
      .then((res: any) => setAllMerchants(Array.isArray(res) ? res : []))
      .catch(() => setAllMerchants([]));
  }, [user]);

  const openUser = (u: AdminUser) => {
    setSelectedUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setPwMessage(null);
    setChainMsg(null);
    setPushAmount('4');
    setTransferPrice(
      u.merchantProfile?.transferPriceOverride != null
        ? String(u.merchantProfile.transferPriceOverride)
        : '',
    );
  };

  const grantPushCredits = async (u: AdminUser) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    const amount = Math.floor(Number(pushAmount));
    if (!Number.isFinite(amount) || amount < 1 || amount > 100) {
      setPwMessage({ ok: false, text: t('webadmin1.ausers.invalidAmount') });
      return;
    }
    setGrantingPush(true);
    setPwMessage(null);
    try {
      const res = await api.grantMerchantPushCredits(merchantId, amount);
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? { ...x, merchantProfile: { ...x.merchantProfile, pushCredits: res.pushCredits } }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
      setPwMessage({
        ok: true,
        text: t('webadmin1.ausers.granted', { n: res.pushCredits }),
      });
    } catch (e: any) {
      setPwMessage({ ok: false, text: e?.message || t('webadmin1.ausers.grantError') });
    } finally {
      setGrantingPush(false);
    }
  };

  const changePassword = async (u: AdminUser) => {
    if (newPassword.length < 6) {
      setPwMessage({ ok: false, text: t('webadmin1.ausers.pwMin') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ ok: false, text: t('webadmin1.ausers.pwMismatch') });
      return;
    }
    setPwSaving(true);
    setPwMessage(null);
    try {
      await api.setUserPassword(u.id, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setPwMessage({ ok: true, text: t('webadmin1.ausers.pwUpdated') });
    } catch (e: any) {
      setPwMessage({ ok: false, text: e?.message || t('webadmin1.ausers.pwError') });
    } finally {
      setPwSaving(false);
    }
  };

  const unlockLogin = async (u: AdminUser) => {
    setUnlocking(true);
    setPwMessage(null);
    try {
      const res = await api.unlockUserLogin(u.id);
      const patch = (x: AdminUser) => (x.id === u.id ? { ...x, loginLocked: false } : x);
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
      setPwMessage({
        ok: true,
        text: res?.wasLocked ? t('webadmin1.ausers.unlocked') : t('webadmin1.ausers.wasNotLocked'),
      });
    } catch (e: any) {
      setPwMessage({ ok: false, text: e?.message || t('webadmin1.ausers.unlockError') });
    } finally {
      setUnlocking(false);
    }
  };

  const toggleStatus = async (u: AdminUser) => {
    if (u.id === user?.id && u.status === 'active') {
      setError(t('webadmin1.ausers.cannotDeactivateSelf'));
      return;
    }
    setToggling(true);
    try {
      const updated = await api.setUserStatus(u.id, u.status === 'active' ? 'inactive' : 'active');
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: updated.status } : x)));
      setSelectedUser((prev) => (prev?.id === u.id ? { ...prev, status: updated.status } : prev));
    } catch (e: any) {
      setError(e?.message || t('webadmin1.ausers.statusError'));
    } finally {
      setToggling(false);
    }
  };

  const toggleCardPayments = async (u: AdminUser) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    const enabled = !(u.merchantProfile?.cardPaymentsEnabled === true);
    setToggling(true);
    try {
      await api.setMerchantCardPayments(merchantId, enabled);
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? { ...x, merchantProfile: { ...x.merchantProfile, cardPaymentsEnabled: enabled } }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
    } catch (e: any) {
      setError(e?.message || t('webadmin1.ausers.cardError'));
    } finally {
      setToggling(false);
    }
  };

  const toggleHomeCook = async (u: AdminUser) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    const enabled = !(u.merchantProfile?.isHomeCook === true);
    setToggling(true);
    try {
      await api.setMerchantHomeCook(merchantId, enabled);
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? { ...x, merchantProfile: { ...x.merchantProfile, isHomeCook: enabled } }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
    } catch (e: any) {
      setError(e?.message || t('webadmin1.ausers.homeCookError'));
    } finally {
      setToggling(false);
    }
  };

  const toggleWeeklyBilling = async (u: AdminUser) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    const enabled = !(u.merchantProfile?.weeklyBillingEnabled === true);
    setToggling(true);
    try {
      await api.setMerchantWeeklyBilling(merchantId, enabled);
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? { ...x, merchantProfile: { ...x.merchantProfile, weeklyBillingEnabled: enabled } }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
    } catch (e: any) {
      setError(e?.message || t('webadmin1.ausers.weeklyBillingError'));
    } finally {
      setToggling(false);
    }
  };

  // Modo prueba por comercio (admin, tiempo limitado en horas).
  const [testHours, setTestHours] = useState('24');
  const toggleTestOrders = async (u: AdminUser) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    const enabled = !(u.merchantProfile?.testOrdersEnabled === true);
    const hours = Math.round(Number(testHours));
    setToggling(true);
    try {
      const updated = await api.setMerchantTestOrders(
        merchantId,
        enabled,
        Number.isFinite(hours) ? hours : 24,
      );
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? {
              ...x,
              merchantProfile: {
                ...x.merchantProfile,
                testOrdersEnabled: updated?.testOrdersEnabled === true,
                testOrdersUntil: updated?.testOrdersUntil ?? null,
              },
            }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar el modo prueba');
    } finally {
      setToggling(false);
    }
  };

  // Sedes: colgar bajo matriz + toggle de traslados (admin, por comercio).
  const [chainMsg, setChainMsg] = useState<string | null>(null);
  const [transferPrice, setTransferPrice] = useState('');
  const saveTransferPrice = async (u: AdminUser) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    const raw = transferPrice.trim();
    // Vacío = automático (punto a punto). Con valor = pactado en colones.
    const price = raw === '' ? null : Math.round(Number(raw));
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 500000)) {
      setChainMsg('Precio inválido (0–500000 colones, o vacío para automático).');
      return;
    }
    setToggling(true);
    setChainMsg(null);
    try {
      await api.setMerchantTransferPrice(merchantId, price);
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? { ...x, merchantProfile: { ...x.merchantProfile, transferPriceOverride: price } }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
      setChainMsg(
        price === null
          ? '✓ Precio automático (punto a punto).'
          : `✓ Precio pactado: ₡${price.toLocaleString('es-CR')} por traslado.`,
      );
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el precio');
    } finally {
      setToggling(false);
    }
  };
  const setParent = async (u: AdminUser, parentId: string | null) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    setToggling(true);
    setChainMsg(null);
    try {
      await api.setMerchantParent(merchantId, parentId);
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? { ...x, merchantProfile: { ...x.merchantProfile, parentMerchantId: parentId } }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
      const parentName = parentId
        ? (allMerchants.find((m) => m.id === parentId)?.businessName ?? 'la matriz')
        : null;
      setChainMsg(
        parentName ? `✓ Ahora es sede de ${parentName}.` : '✓ Ahora es matriz (sin padre).',
      );
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar la sede');
    } finally {
      setToggling(false);
    }
  };

  const toggleTransfers = async (u: AdminUser) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    const enabled = !(u.merchantProfile?.transfersEnabled === true);
    setToggling(true);
    setChainMsg(null);
    try {
      await api.setMerchantTransfers(merchantId, enabled);
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? { ...x, merchantProfile: { ...x.merchantProfile, transfersEnabled: enabled } }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
      setChainMsg(
        enabled
          ? '✓ Traslados activados para este comercio.'
          : '✓ Traslados apagados para este comercio.',
      );
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar traslados');
    } finally {
      setToggling(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'driver':
        return { label: t('webadmin1.ausers.role.driver'), color: 'bg-kiwi-100 text-kiwi-700' };
      case 'merchant':
        return { label: t('webadmin1.ausers.role.merchant'), color: 'bg-blue-100 text-blue-700' };
      case 'admin':
        return { label: t('webadmin1.ausers.role.admin'), color: 'bg-purple-100 text-purple-700' };
      case 'customer':
        return {
          label: t('webadmin1.ausers.role.customer'),
          color: 'bg-surface-100 text-surface-700',
        };
      default:
        return { label: role, color: 'bg-surface-100 text-surface-700' };
    }
  };

  const getStatusLabel = (status: string) => {
    return status === 'active'
      ? { label: t('webadmin1.ausers.status.active'), color: 'bg-green-100 text-green-700' }
      : { label: t('webadmin1.ausers.status.inactive'), color: 'bg-surface-100 text-surface-500' };
  };

  const getKycLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: t('webadmin1.ausers.kyc.approved'), color: 'bg-green-100 text-green-700' };
      case 'pending':
        return {
          label: t('webadmin1.ausers.kyc.pending'),
          color: 'bg-yellow-100 text-yellow-700',
        };
      case 'rejected':
        return { label: t('webadmin1.ausers.kyc.rejected'), color: 'bg-red-100 text-red-700' };
      default:
        return { label: t('webadmin1.ausers.kyc.none'), color: 'bg-surface-100 text-surface-500' };
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <KiwiLoader size={56} />
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
                {t('webadmin1.ausers.title')}
              </h1>
              <p className="text-surface-500 dark:text-surface-400">
                {t('webadmin1.ausers.totalCount', { total })}
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: t('webadmin1.ausers.tabs.all') },
                { value: 'driver', label: t('webadmin1.ausers.tabs.drivers') },
                { value: 'merchant', label: t('webadmin1.ausers.tabs.merchants') },
                { value: 'admin', label: t('webadmin1.ausers.tabs.admins') },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value as any)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    filter === tab.value
                      ? 'bg-kiwi-700 text-white'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder={t('webadmin1.ausers.searchPh')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>

          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      {t('webadmin1.ausers.col.user')}
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      {t('webadmin1.ausers.col.role')}
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      {t('webadmin1.ausers.col.status')}
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      {t('webadmin1.ausers.col.kyc')}
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      {t('webadmin1.ausers.col.activity')}
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      {t('webadmin1.ausers.col.registered')}
                    </th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      {t('webadmin1.ausers.col.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-sm text-surface-500 dark:text-surface-400"
                      >
                        {t('webadmin1.ausers.loading')}
                      </td>
                    </tr>
                  ) : (
                    users.map((u, index) => {
                      const roleInfo = getRoleLabel(u.role);
                      const statusInfo = getStatusLabel(u.status);
                      const kycInfo = getKycLabel(kycOf(u));
                      return (
                        <motion.tr
                          key={u.id}
                          className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(index * 0.03, 0.5) }}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-kiwi-100 dark:bg-kiwi-900/30 flex items-center justify-center text-kiwi-700 dark:text-kiwi-400 font-semibold">
                                {displayName(u).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-surface-800 dark:text-surface-200">
                                  {displayName(u)}
                                </p>
                                <p className="text-sm text-surface-500 dark:text-surface-400">
                                  {u.email || u.phone || '—'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}
                            >
                              {roleInfo.label}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${kycInfo.color}`}
                            >
                              {kycInfo.label}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-surface-800 dark:text-surface-200">
                              {u.role === 'driver'
                                ? t('webadmin1.ausers.trips', {
                                    n: u.driverProfile?.totalTrips ?? 0,
                                  })
                                : u.role === 'merchant'
                                  ? t('webadmin1.ausers.orders', {
                                      n: u.merchantProfile?._count?.orders ?? 0,
                                    })
                                  : '—'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-surface-500 dark:text-surface-400">
                              {new Date(u.createdAt).toLocaleDateString('es-CR')}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openUser(u)}
                                className="px-3 py-1.5 text-xs font-medium text-surface-500 hover:text-kiwi-700 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/30 rounded-lg transition-colors"
                              >
                                {t('webadmin1.ausers.view')}
                              </button>
                              <button
                                onClick={() => toggleStatus(u)}
                                disabled={toggling}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                                  u.status === 'active'
                                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                                    : 'text-kiwi-700 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/30'
                                }`}
                              >
                                {u.status === 'active'
                                  ? t('webadmin1.ausers.deactivate')
                                  : t('webadmin1.ausers.activate')}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {!loading && users.length === 0 && !error && (
            <p className="text-center text-sm text-surface-500 dark:text-surface-400">
              {t('webadmin1.ausers.empty')}
            </p>
          )}
        </div>

        <AnimatePresence>
          {selectedUser && (
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
            >
              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90dvh] overflow-y-auto"
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 50 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                    {t('webadmin1.ausers.detailTitle')}
                  </h3>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-6">
                    {selectedUser.merchantProfile?.logoUrl &&
                    /^https:\/\//i.test(selectedUser.merchantProfile.logoUrl) ? (
                      // NOTE: <img> intencional — logo dinámico de Cloudinary.
                      <img
                        src={selectedUser.merchantProfile.logoUrl}
                        alt={displayName(selectedUser)}
                        className="w-16 h-16 rounded-full object-cover ring-2 ring-kiwi-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-kiwi-100 dark:bg-kiwi-900/30 flex items-center justify-center text-2xl text-kiwi-700 dark:text-kiwi-400 font-bold">
                        {selectedUser.merchantProfile?.logoUrl ||
                          displayName(selectedUser).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-surface-800 dark:text-surface-100">
                        {displayName(selectedUser)}
                      </h4>
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {selectedUser.email || selectedUser.phone || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {t('webadmin1.ausers.detailRole')}
                      </p>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {getRoleLabel(selectedUser.role).label}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {t('webadmin1.ausers.detailStatus')}
                      </p>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {selectedUser.status === 'active'
                          ? t('webadmin1.ausers.status.active')
                          : t('webadmin1.ausers.status.inactive')}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {t('webadmin1.ausers.detailKyc')}
                      </p>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {getKycLabel(kycOf(selectedUser)).label}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {t('webadmin1.ausers.detailRegistered')}
                      </p>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {new Date(selectedUser.createdAt).toLocaleDateString('es-CR')}
                      </p>
                    </div>
                  </div>

                  {selectedUser.role === 'driver' && (
                    <div className="p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30">
                      <div className="flex justify-between items-center">
                        <span className="text-surface-600 dark:text-surface-400">
                          {t('webadmin1.ausers.rating')}
                        </span>
                        <span className="font-semibold text-kiwi-700 dark:text-kiwi-400">
                          <Star className="h-4 w-4 inline" />{' '}
                          {Number(selectedUser.driverProfile?.rating ?? 5).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-surface-600 dark:text-surface-400">
                          {t('webadmin1.ausers.tripsDone')}
                        </span>
                        <span className="font-semibold text-surface-800 dark:text-surface-200">
                          {selectedUser.driverProfile?.totalTrips ?? 0}
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedUser.role === 'merchant' && (
                    <div className="p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30">
                      <MerchantQuickSetup
                        key={`setup-${selectedUser.id}`}
                        user={selectedUser}
                        onSaved={(saved) => {
                          const patch = (x: AdminUser) =>
                            x.id === selectedUser.id && x.merchantProfile
                              ? {
                                  ...x,
                                  phone: saved.phone ?? x.phone,
                                  merchantProfile: {
                                    ...x.merchantProfile,
                                    businessName: saved.businessName,
                                    address: saved.address,
                                    description: saved.description,
                                    logoUrl: saved.logoUrl,
                                  },
                                }
                              : x;
                          setUsers((prev) => prev.map(patch));
                          setSelectedUser((prev) =>
                            prev?.id === selectedUser.id ? patch(prev) : prev,
                          );
                        }}
                      />
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
                        <div>
                          <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                            {t('webadmin1.ausers.cardTitle')}
                          </p>
                          <p className="text-xs text-surface-500">
                            {t('webadmin1.ausers.cardHint')}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleCardPayments(selectedUser)}
                          disabled={toggling}
                          role="switch"
                          aria-checked={selectedUser.merchantProfile?.cardPaymentsEnabled === true}
                          className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${
                            selectedUser.merchantProfile?.cardPaymentsEnabled === true
                              ? 'bg-kiwi-600'
                              : 'bg-surface-300 dark:bg-surface-600'
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                              selectedUser.merchantProfile?.cardPaymentsEnabled === true
                                ? 'translate-x-6'
                                : ''
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
                        <div>
                          <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                            {t('webadmin1.ausers.weeklyBillingTitle')}
                          </p>
                          <p className="text-xs text-surface-500">
                            {t('webadmin1.ausers.weeklyBillingHint')}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleWeeklyBilling(selectedUser)}
                          disabled={toggling}
                          role="switch"
                          aria-checked={selectedUser.merchantProfile?.weeklyBillingEnabled === true}
                          aria-label={t('webadmin1.ausers.weeklyBillingTitle')}
                          className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${
                            selectedUser.merchantProfile?.weeklyBillingEnabled === true
                              ? 'bg-kiwi-600'
                              : 'bg-surface-300 dark:bg-surface-600'
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                              selectedUser.merchantProfile?.weeklyBillingEnabled === true
                                ? 'translate-x-6'
                                : ''
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
                        <div>
                          <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                            🧪 Pedidos de prueba
                          </p>
                          <p className="text-xs text-surface-500">
                            Demos sin gastar crédito, solo pilotos. Se apaga solo al vencer.
                            {selectedUser.merchantProfile?.testOrdersEnabled === true &&
                            selectedUser.merchantProfile?.testOrdersUntil
                              ? ` Vence ${new Date(selectedUser.merchantProfile.testOrdersUntil).toLocaleString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`
                              : ''}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-xs text-surface-500" htmlFor="test-hours">
                              Horas:
                            </label>
                            <select
                              id="test-hours"
                              value={testHours}
                              onChange={(e) => setTestHours(e.target.value)}
                              disabled={selectedUser.merchantProfile?.testOrdersEnabled === true}
                              className="rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 px-2 py-1.5 text-xs disabled:opacity-50"
                            >
                              <option value="1">1 hora</option>
                              <option value="8">8 horas</option>
                              <option value="24">24 horas</option>
                              <option value="72">3 días</option>
                              <option value="168">7 días</option>
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleTestOrders(selectedUser)}
                          disabled={toggling}
                          role="switch"
                          aria-checked={selectedUser.merchantProfile?.testOrdersEnabled === true}
                          aria-label="Modo prueba del comercio"
                          className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${
                            selectedUser.merchantProfile?.testOrdersEnabled === true
                              ? 'bg-gold-500'
                              : 'bg-surface-300 dark:bg-surface-600'
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                              selectedUser.merchantProfile?.testOrdersEnabled === true
                                ? 'translate-x-6'
                                : ''
                            }`}
                          />
                        </button>
                      </div>
                      <div className="mt-2">
                        {(() => {
                          const mp = selectedUser.merchantProfile;
                          const parentName = mp?.parentMerchantId
                            ? (allMerchants.find((m) => m.id === mp.parentMerchantId)
                                ?.businessName ?? 'otra sede')
                            : null;
                          const kids = mp?.branches ?? [];
                          return (
                            <p className="mb-2 rounded-xl bg-surface-100 dark:bg-surface-700/50 px-3 py-2 text-xs text-surface-600 dark:text-surface-300">
                              ⛓️{' '}
                              {parentName
                                ? `Esta sede pertenece a la matriz ${parentName}.`
                                : 'Es matriz (sin padre).'}
                              {kids.length > 0
                                ? ` Sedes bajo este comercio: ${kids.map((k) => k.businessName).join(', ')}.`
                                : ''}
                            </p>
                          );
                        })()}
                        <label
                          htmlFor="parent-merchant"
                          className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
                        >
                          🏪 Esta sede pertenece a la matriz:
                        </label>
                        <select
                          id="parent-merchant"
                          value={selectedUser.merchantProfile?.parentMerchantId ?? ''}
                          disabled={toggling}
                          onChange={(e) => void setParent(selectedUser, e.target.value || null)}
                          className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 text-sm disabled:opacity-50"
                        >
                          <option value="">— Es matriz (sin padre) —</option>
                          {allMerchants
                            .filter(
                              (m) =>
                                m.id !== selectedUser.merchantProfile?.id &&
                                !(selectedUser.merchantProfile?.branches ?? []).some(
                                  (b) => b.id === m.id,
                                ),
                            )
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.businessName}
                              </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                          Las propias sedes no salen: elegirlas daría ciclo. Para invertir el orden,
                          poné primero ambas como matriz.
                        </p>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
                        <div>
                          <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                            🚚 Traslados entre sedes
                          </p>
                          <p className="text-xs text-surface-500">
                            Pide repartidor para llevar producto a otra sede de la cadena. Solo
                            origen/destino de la misma matriz.
                          </p>
                        </div>
                        <button
                          onClick={() => toggleTransfers(selectedUser)}
                          disabled={toggling}
                          role="switch"
                          aria-checked={selectedUser.merchantProfile?.transfersEnabled === true}
                          aria-label="Traslados entre sedes"
                          className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${
                            selectedUser.merchantProfile?.transfersEnabled === true
                              ? 'bg-kiwi-600'
                              : 'bg-surface-300 dark:bg-surface-600'
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                              selectedUser.merchantProfile?.transfersEnabled === true
                                ? 'translate-x-6'
                                : ''
                            }`}
                          />
                        </button>
                      </div>
                      {chainMsg && (
                        <p className="mt-2 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800 px-3 py-2 text-xs font-medium text-kiwi-700 dark:text-kiwi-300">
                          {chainMsg}
                        </p>
                      )}
                      <div className="mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
                        <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                          💰 Precio pactado del traslado
                        </p>
                        <p className="text-xs text-surface-500">
                          Vacío = automático punto a punto. Con valor, ese precio manda (en la
                          matriz aplica a sus sedes).
                        </p>
                        <div className="mt-2 flex gap-2">
                          <input
                            value={transferPrice}
                            onChange={(e) => setTransferPrice(e.target.value)}
                            inputMode="numeric"
                            placeholder="Ej. 2500"
                            className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => void saveTransferPrice(selectedUser)}
                            disabled={toggling}
                            className="shrink-0 rounded-xl bg-kiwi-700 px-4 text-sm font-bold text-white disabled:opacity-50"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
                        <div>
                          <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                            {t('webadmin1.ausers.homeCookTitle')}
                          </p>
                          <p className="text-xs text-surface-500">
                            {t('webadmin1.ausers.homeCookHint')}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleHomeCook(selectedUser)}
                          disabled={toggling}
                          role="switch"
                          aria-checked={selectedUser.merchantProfile?.isHomeCook === true}
                          aria-label={t('webadmin1.ausers.homeCookAria')}
                          className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${
                            selectedUser.merchantProfile?.isHomeCook === true
                              ? 'bg-orange-500'
                              : 'bg-surface-300 dark:bg-surface-600'
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                              selectedUser.merchantProfile?.isHomeCook === true
                                ? 'translate-x-6'
                                : ''
                            }`}
                          />
                        </button>
                      </div>
                      <div className="mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
                        <div className="flex justify-between items-center gap-2">
                          <div>
                            <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                              {t('webadmin1.ausers.pushTitle')}
                            </p>
                            <p className="text-xs text-surface-500">
                              {t('webadmin1.ausers.pushHint', {
                                n: selectedUser.merchantProfile?.pushCredits ?? 0,
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={pushAmount}
                            onChange={(e) => setPushAmount(e.target.value)}
                            aria-label={t('webadmin1.ausers.pushAria')}
                            className="w-20 px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                          />
                          <button
                            onClick={() => grantPushCredits(selectedUser)}
                            disabled={grantingPush}
                            className="flex-1 py-2 px-4 text-sm font-medium rounded-lg bg-kiwi-700 text-white hover:bg-kiwi-800 transition-colors disabled:opacity-50"
                          >
                            {grantingPush
                              ? t('webadmin1.ausers.granting')
                              : t('webadmin1.ausers.grantPush')}
                          </button>
                        </div>
                      </div>
                      <MerchantLocationEditor
                        key={selectedUser.id}
                        userId={selectedUser.id}
                        businessName={
                          selectedUser.merchantProfile?.businessName ??
                          t('webadmin1.ausers.role.merchant')
                        }
                        address={selectedUser.merchantProfile?.address}
                        initialLat={coordStr(selectedUser.merchantProfile?.latitude)}
                        initialLng={coordStr(selectedUser.merchantProfile?.longitude)}
                        onSaved={(mp) => {
                          const patch = (x: AdminUser) =>
                            x.id === selectedUser.id && x.merchantProfile
                              ? {
                                  ...x,
                                  merchantProfile: {
                                    ...x.merchantProfile,
                                    latitude: mp.latitude,
                                    longitude: mp.longitude,
                                  },
                                }
                              : x;
                          setUsers((prev) => prev.map(patch));
                          setSelectedUser((prev) =>
                            prev?.id === selectedUser.id ? patch(prev) : prev,
                          );
                        }}
                      />
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                          {t('webadmin1.ausers.lockTitle')}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {selectedUser.loginLocked
                            ? t('webadmin1.ausers.lockLocked')
                            : t('webadmin1.ausers.lockOk')}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          selectedUser.loginLocked
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {selectedUser.loginLocked
                          ? t('webadmin1.ausers.locked')
                          : t('webadmin1.ausers.ok')}
                      </span>
                    </div>
                    {selectedUser.loginLocked && (
                      <button
                        onClick={() => unlockLogin(selectedUser)}
                        disabled={unlocking}
                        className="mt-3 w-full py-2 px-4 text-sm font-medium rounded-lg bg-amber-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {unlocking ? t('webadmin1.ausers.unlocking') : t('webadmin1.ausers.unlock')}
                      </button>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-1">
                      {t('webadmin1.ausers.pwTitle')}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">
                      {t('webadmin1.ausers.pwHint')}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t('webadmin1.ausers.pwNew')}
                        autoComplete="new-password"
                        className="px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t('webadmin1.ausers.pwRepeat')}
                        autoComplete="new-password"
                        className="px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                      />
                    </div>
                    {pwMessage && (
                      <p
                        className={`mt-2 text-xs font-medium ${pwMessage.ok ? 'text-kiwi-700 dark:text-kiwi-400' : 'text-red-500'}`}
                      >
                        {pwMessage.text}
                      </p>
                    )}
                    <button
                      onClick={() => changePassword(selectedUser)}
                      disabled={pwSaving}
                      className="mt-3 w-full py-2 px-4 text-sm font-medium rounded-lg bg-surface-800 dark:bg-surface-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {pwSaving ? t('webadmin1.ausers.saving') : t('webadmin1.ausers.pwSet')}
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => toggleStatus(selectedUser)}
                      disabled={toggling}
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                        selectedUser.status === 'active'
                          ? 'bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100'
                          : 'bg-kiwi-700 text-white hover:bg-kiwi-800'
                      }`}
                    >
                      {selectedUser.status === 'active'
                        ? t('webadmin1.ausers.deactivateAccount')
                        : t('webadmin1.ausers.activateAccount')}
                    </button>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="py-2 px-4 text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-lg"
                    >
                      {t('webadmin1.ausers.close')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
