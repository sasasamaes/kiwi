// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Check } from 'lucide-react';
import { api, useAuth, useTranslations, addStreetsAndSatellite } from '@kiwi/ui';
import { MerchantNav } from '../../components/MerchantNav';
import { MerchantLogoEditor } from '../../components/MerchantLogoEditor';

const CATEGORIES = [
  { id: 'restaurante', label: 'Restaurante' },
  { id: 'soda', label: 'Soda' },
  { id: 'pizzeria', label: 'Pizzería' },
  { id: 'cafe_brunch', label: 'Café & Brunch' },
  { id: 'panaderia', label: 'Panadería' },
  { id: 'mariscos', label: 'Mariscos' },
  { id: 'comida_rapida', label: 'Comida rápida' },
  { id: 'saludable', label: 'Saludable' },
  { id: 'cocina_casera', label: 'Cocina casera' },
  { id: 'bar', label: 'Bar' },
  { id: 'otro', label: 'Otro' },
];

const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

type DayHours = { open: string; close: string } | null;

// Acepta +506 7219 9768, 72199768, 7219-9768 → 8888-8888 (igual que el backend).
const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/[^\d]/g, '');
  const local = digits.length === 11 && digits.startsWith('506') ? digits.slice(3) : digits;
  return /^\d{8}$/.test(local) ? `${local.slice(0, 4)}-${local.slice(4)}` : raw.trim();
};

const isHHMM = (v: string) => /^\d{2}:\d{2}$/.test(v);

const CAT_KEY: Record<string, string> = {
  restaurante: 'catRestaurante',
  soda: 'catSoda',
  pizzeria: 'catPizzeria',
  cafe_brunch: 'catCafe',
  panaderia: 'catPanaderia',
  mariscos: 'catMariscos',
  comida_rapida: 'catRapida',
  saludable: 'catSaludable',
  cocina_casera: 'catCasera',
  bar: 'catBar',
  otro: 'catOtro',
};

const dayKey = (key: string) => `day${key.charAt(0).toUpperCase()}${key.slice(1)}`;

export default function PerfilPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const { user, loading: authLoading, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mpStatus, setMpStatus] = useState<{
    accountId: string | null;
    status: string | null;
  } | null>(null);
  const [mpLoading, setMpLoading] = useState(true);
  const [mpBusy, setMpBusy] = useState(false);
  const [listed, setListed] = useState(true);
  const [listedBusy, setListedBusy] = useState(false);
  const [listedError, setListedError] = useState<string | null>(null);
  const [cashEnabled, setCashEnabled] = useState(true);
  const [sinpeEnabled, setSinpeEnabled] = useState(true);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpInfo, setMpInfo] = useState<string | null>(null);
  const [mpPayments, setMpPayments] = useState<Array<{
    id: string;
    amount: number;
    status: string;
  }> | null>(null);
  const [mpPaymentsLoading, setMpPaymentsLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    description: '',
    address: '',
    phone: '',
    category: 'restaurante',
    logoUrl: '' as string | null,
    latitude: '' as number | string,
    longitude: '' as number | string,
    hours: {} as Record<string, DayHours>,
    socials: { instagram: '', facebook: '', tiktok: '', whatsapp: '' },
  });
  // Mini-mapa de ubicación del local (client-only).
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const LRef = useRef<any>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [profile, me] = await Promise.all([
          api.getMerchantProfile().catch(() => null),
          api.getMe().catch(() => null),
        ]);
        if (cancelled || !profile) return;
        const hours: Record<string, DayHours> = {};
        for (const d of DAYS) {
          const h = (profile as any)?.openingHours?.[d.key];
          hours[d.key] =
            h && isHHMM(h.open) && isHHMM(h.close) ? { open: h.open, close: h.close } : null;
        }
        setForm({
          businessName: (profile as any)?.businessName || '',
          description: (profile as any)?.description || '',
          address: (profile as any)?.address || '',
          phone: (me as any)?.phone || '',
          category: (profile as any)?.category || 'restaurante',
          logoUrl: (profile as any)?.logoUrl || null,
          latitude: (profile as any)?.latitude ?? '',
          longitude: (profile as any)?.longitude ?? '',
          hours,
          socials: {
            instagram: (profile as any)?.socials?.instagram || '',
            facebook: (profile as any)?.socials?.facebook || '',
            tiktok: (profile as any)?.socials?.tiktok || '',
            whatsapp: (profile as any)?.socials?.whatsapp || '',
          },
        });
        setListed((profile as any)?.isListed !== false);
        setCashEnabled((profile as any)?.cashEnabled !== false);
        setSinpeEnabled((profile as any)?.sinpeEnabled !== false);
      } catch {
        if (!cancelled) setFormError(t('webshop2.perfil.errLoad'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Mini-mapa: init una vez cargado el perfil; el punto se redibuja con el form.
  useEffect(() => {
    if (loading || mapObj.current || !mapDivRef.current) return;
    let cancelled = false;
    (async () => {
      const mod: any = await import('leaflet');
      if (cancelled || mapObj.current || !mapDivRef.current) return;
      const L = mod.default ?? mod;
      LRef.current = L;
      const lat = Number(form.latitude);
      const lng = Number(form.longitude);
      const hasPt =
        form.latitude !== '' &&
        form.longitude !== '' &&
        Number.isFinite(lat) &&
        Number.isFinite(lng);
      const map = L.map(mapDivRef.current).setView(
        hasPt ? [lat, lng] : [10.1467, -85.452],
        hasPt ? 16 : 13,
      );
      addStreetsAndSatellite(map, L);
      map.on('click', (e: any) => {
        setForm((f) => ({
          ...f,
          latitude: e.latlng.lat.toFixed(6),
          longitude: e.latlng.lng.toFixed(6),
        }));
      });
      mapObj.current = map;
      drawMarker();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Redibuja el kiwi cuando cambia el punto (incluye al quitarlo).
  useEffect(() => {
    if (mapObj.current) drawMarker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.latitude, form.longitude]);

  const drawMarker = () => {
    const L = LRef.current;
    const map = mapObj.current;
    if (!L || !map) return;
    if (markerObj.current) {
      markerObj.current.remove();
      markerObj.current = null;
    }
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (
      form.latitude === '' ||
      form.longitude === '' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return;
    }
    const icon = L.divIcon({
      html: `<img src="/kiwi.svg" alt="${t('webshop2.perfil.markerAlt')}" style="width:34px;height:34px;display:block;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);background:#fff;"/>`,
      className: 'merchant-point',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = L.marker([lat, lng], { draggable: true, icon })
      .addTo(map)
      .bindTooltip(t('webshop2.perfil.markerTooltip'));
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      setForm((f) => ({ ...f, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }));
    });
    markerObj.current = marker;
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setFormError(t('webshop2.perfil.errNoGeo'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setFormError(null);
      },
      () => setFormError(t('webshop2.perfil.errGeo')),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setMpLoading(true);
      setMpError(null);
      try {
        const st = await api.getMarketplaceStatus();
        if (!cancelled) setMpStatus(st);
      } catch {
        if (!cancelled) setMpError(t('webshop2.perfil.errMpStatus'));
      } finally {
        if (!cancelled) setMpLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || mpStatus?.status !== 'active') return;
    let cancelled = false;
    (async () => {
      setMpPaymentsLoading(true);
      try {
        const payments = await api.listMarketplacePayments();
        if (!cancelled) setMpPayments(Array.isArray(payments) ? payments : []);
      } catch {
        if (!cancelled) setMpPayments([]);
      } finally {
        if (!cancelled) setMpPaymentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, mpStatus?.status]);

  const setDay = (key: string, patch: Partial<{ open: string; close: string }> | null) => {
    setForm((f) => {
      if (patch === null) return { ...f, hours: { ...f.hours, [key]: null } };
      const prev = f.hours[key] ?? { open: '08:00', close: '20:00' };
      return { ...f, hours: { ...f.hours, [key]: { ...prev, ...patch } } };
    });
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      if (!form.businessName.trim()) throw new Error(t('webshop2.perfil.errName'));
      const phone = normalizePhone(form.phone);
      if (form.phone.trim() !== '' && !/^\d{4}-\d{4}$/.test(phone)) {
        throw new Error(t('webshop2.perfil.errPhone'));
      }
      const openingHours: Record<string, { open: string; close: string }> = {};
      for (const d of DAYS) {
        const h = form.hours[d.key];
        if (h) {
          if (!isHHMM(h.open) || !isHHMM(h.close)) {
            throw new Error(
              t('webshop2.perfil.errHours', {
                day: t(`webshop2.perfil.${dayKey(d.key)}`).toLowerCase(),
              }),
            );
          }
          // Tope operativo Kiwi (8:00–20:00): sin repartidores fuera de ese
          // rango, el horario del local no puede excederlo.
          if (h.open < '08:00' || h.close > '20:00') {
            throw new Error(
              t('webshop2.perfil.errRange', {
                day: t(`webshop2.perfil.${dayKey(d.key)}`).toLowerCase(),
                range: `${h.open}–${h.close}`,
              }),
            );
          }
          if (h.close <= h.open) {
            throw new Error(
              t('webshop2.perfil.errClose', {
                day: t(`webshop2.perfil.${dayKey(d.key)}`).toLowerCase(),
              }),
            );
          }
          openingHours[d.key] = { open: h.open, close: h.close };
        }
      }
      const latRaw = form.latitude === '' ? null : Number(form.latitude);
      const lngRaw = form.longitude === '' ? null : Number(form.longitude);
      if ((latRaw == null) !== (lngRaw == null)) {
        throw new Error(t('webshop2.perfil.errLocationHalf'));
      }
      if (latRaw != null && (!Number.isFinite(latRaw) || !Number.isFinite(lngRaw as number))) {
        throw new Error(t('webshop2.perfil.errLocationBad'));
      }
      const [updated] = await Promise.all([
        api.updateMerchantProfile({
          businessName: form.businessName.trim(),
          description: form.description.trim() || null,
          address: form.address.trim() || undefined,
          category: form.category,
          latitude: latRaw,
          longitude: lngRaw,
          openingHours,
          logoUrl: form.logoUrl || null,
          socials: {
            instagram: form.socials.instagram.trim(),
            facebook: form.socials.facebook.trim(),
            tiktok: form.socials.tiktok.trim(),
            whatsapp: form.socials.whatsapp.trim(),
          },
        }),
        api.updateMe({ phone: phone || null }),
      ]);
      updateUser({ merchantProfile: updated } as any);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 3000);
    } catch (err: any) {
      setFormError(err?.message || t('webshop2.perfil.errSave'));
    } finally {
      setSaving(false);
    }
  };

  const toggleListed = async () => {
    const next = !listed;
    setListed(next);
    setListedError(null);
    setListedBusy(true);
    try {
      await api.setMyVisibility(next);
    } catch {
      setListed(!next);
      setListedError(t('webshop2.perfil.errVisibility'));
    } finally {
      setListedBusy(false);
    }
  };

  const togglePaymentMethod = async (field: 'cash' | 'sinpe', next: boolean) => {
    const setter = field === 'cash' ? setCashEnabled : setSinpeEnabled;
    setter(next);
    setPayError(null);
    setPayBusy(true);
    try {
      await api.setMerchantPaymentMethods(
        field === 'cash' ? { cashEnabled: next } : { sinpeEnabled: next },
      );
    } catch {
      setter(!next);
      setPayError(t('webshop2.perfil.errPayMethod'));
    } finally {
      setPayBusy(false);
    }
  };

  const startOnboarding = async () => {
    setMpBusy(true);
    setMpError(null);
    setMpInfo(null);
    try {
      const out = await api.startMarketplaceOnboarding();
      setMpStatus({ accountId: out.accountId, status: out.status });
      if (out.onboardingUrl) {
        window.open(out.onboardingUrl, '_blank', 'noopener,noreferrer');
        setMpInfo(t('webshop2.perfil.mpDoneInfo'));
      }
    } catch {
      setMpError(t('webshop2.perfil.errMpActivate'));
    } finally {
      setMpBusy(false);
    }
  };

  const openRegistration = async () => {
    setMpBusy(true);
    setMpError(null);
    setMpInfo(null);
    try {
      const out = await api.regenerateMarketplaceLink();
      if (out.status) setMpStatus({ accountId: out.accountId, status: out.status });
      if (out.onboardingUrl) {
        window.open(out.onboardingUrl, '_blank', 'noopener,noreferrer');
        setMpInfo(t('webshop2.perfil.mpDoneInfo'));
      }
    } catch {
      setMpError(t('webshop2.perfil.errMpOpen'));
    } finally {
      setMpBusy(false);
    }
  };

  const refreshMarketplaceStatus = async () => {
    setMpBusy(true);
    setMpError(null);
    setMpInfo(null);
    try {
      const st = await api.getMarketplaceStatus();
      setMpStatus(st);
      if (st?.status !== 'active') {
        setMpInfo(t('webshop2.perfil.mpNotActive'));
      }
    } catch {
      setMpError(t('webshop2.perfil.errMpRefresh'));
    } finally {
      setMpBusy(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <MerchantNav />
        <main className="mx-auto max-w-2xl space-y-3 p-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
            />
          ))}
        </main>
      </>
    );
  }

  const inputCls =
    'w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20 transition-all';

  return (
    <>
      <MerchantNav
        isConnected={undefined}
        businessName={(user as any)?.merchantProfile?.businessName}
      />
      <main className="mx-auto max-w-2xl p-6 pb-20">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-1">
          <Store className="h-6 w-6" /> {t('webshop2.perfil.title')}
        </h1>
        <p className="text-sm text-surface-500 mb-6">{t('webshop2.perfil.subtitle')}</p>

        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-5 shadow-soft dark:shadow-dark">
          <p className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-4">
            {t('webshop2.perfil.sectionProfile')}
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <MerchantLogoEditor
                logoUrl={form.logoUrl}
                businessName={form.businessName}
                onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
              />
              <div>
                <p className="font-semibold text-surface-800 dark:text-surface-100">
                  {t('webshop2.perfil.profilePhoto')}
                </p>
                <p className="text-xs text-surface-500">{t('webshop2.perfil.profilePhotoHint')}</p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                {t('webshop2.perfil.businessName')}
              </label>
              <input
                value={form.businessName}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                placeholder={t('webshop2.perfil.businessNamePh')}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                {t('webshop2.perfil.description')}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('webshop2.perfil.descriptionPh')}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                {t('webshop2.perfil.category')}
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t(`webshop2.perfil.${CAT_KEY[c.id]}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="my-5 border-t border-surface-100 dark:border-surface-700/60" />
          <p className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-4">
            {t('webshop2.perfil.sectionContact')}
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                  {t('webshop2.perfil.address')}
                </label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder={t('webshop2.perfil.addressPh')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                  {t('webshop2.perfil.phone')}
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  onBlur={() => setForm((f) => ({ ...f, phone: normalizePhone(f.phone) }))}
                  placeholder={t('webshop2.perfil.phonePh')}
                  inputMode="tel"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className="my-5 border-t border-surface-100 dark:border-surface-700/60" />
          <p className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-4">
            {t('webshop2.perfil.sectionLocation')}
          </p>
          <p className="mb-3 text-sm text-surface-500 dark:text-surface-400">
            {t('webshop2.perfil.locationHint')}
          </p>
          <div
            ref={mapDivRef}
            className="h-64 w-full overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              className="rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-xs font-medium"
            >
              {t('webshop2.perfil.useLocation')}
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, latitude: '', longitude: '' }))}
              disabled={form.latitude === '' && form.longitude === ''}
              className="rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              {t('webshop2.perfil.removePoint')}
            </button>
          </div>

          <div className="my-5 border-t border-surface-100 dark:border-surface-700/60" />
          <p className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-4">
            {t('webshop2.perfil.sectionSocial')}
          </p>
          <p className="mb-3 text-sm text-surface-500 dark:text-surface-400">
            {t('webshop2.perfil.socialHint')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                {
                  key: 'instagram',
                  label: t('webshop2.perfil.socialInstagram'),
                  placeholder: t('webshop2.perfil.socialInstagramPh'),
                },
                {
                  key: 'facebook',
                  label: t('webshop2.perfil.socialFacebook'),
                  placeholder: t('webshop2.perfil.socialFacebookPh'),
                },
                {
                  key: 'tiktok',
                  label: t('webshop2.perfil.socialTiktok'),
                  placeholder: t('webshop2.perfil.socialTiktokPh'),
                },
                {
                  key: 'whatsapp',
                  label: t('webshop2.perfil.socialWhatsapp'),
                  placeholder: t('webshop2.perfil.socialWhatsappPh'),
                },
              ] as const
            ).map((s) => (
              <div key={s.key}>
                <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                  {s.label}
                </label>
                <input
                  value={form.socials[s.key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, socials: { ...f.socials, [s.key]: e.target.value } }))
                  }
                  placeholder={s.placeholder}
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          <div className="my-5 border-t border-surface-100 dark:border-surface-700/60" />
          <p className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-4">
            {t('webshop2.perfil.sectionHours')}
          </p>
          <div>
            <p className="mb-1.5 text-sm font-medium text-surface-600 dark:text-surface-400">
              {t('webshop2.perfil.hoursHint')}
            </p>
            <div className="space-y-2">
              {DAYS.map((d) => {
                const h = form.hours[d.key];
                return (
                  <div
                    key={d.key}
                    className="flex items-center gap-2 rounded-xl bg-surface-50 dark:bg-surface-900 px-3 py-2"
                  >
                    <span className="w-20 shrink-0 text-sm font-medium text-surface-700 dark:text-surface-300">
                      {t(`webshop2.perfil.${dayKey(d.key)}`)}
                    </span>
                    {h ? (
                      <>
                        <input
                          type="time"
                          min="08:00"
                          max="20:00"
                          value={h.open}
                          onChange={(e) => setDay(d.key, { open: e.target.value })}
                          className="flex-1 min-w-0 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5 text-sm"
                        />
                        <span className="text-surface-500 dark:text-surface-400 text-sm">–</span>
                        <input
                          type="time"
                          min="08:00"
                          max="20:00"
                          value={h.close}
                          onChange={(e) => setDay(d.key, { close: e.target.value })}
                          className="flex-1 min-w-0 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setDay(d.key, null)}
                          title={t('webshop2.perfil.markClosed')}
                          className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          {t('webshop2.perfil.closed')}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-surface-500 dark:text-surface-400">
                          {t('webshop2.perfil.closed')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDay(d.key, { open: '08:00', close: '20:00' })}
                          className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-kiwi-700 dark:text-kiwi-300 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/20"
                        >
                          {t('webshop2.perfil.addHours')}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {savedTick && (
            <p className="text-sm text-kiwi-700 dark:text-kiwi-300 flex items-center gap-1">
              <Check className="h-4 w-4" /> {t('webshop2.perfil.saved')}
            </p>
          )}
          <button
            onClick={() => void save()}
            disabled={saving}
            className="w-full rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? t('webshop2.perfil.saving') : t('webshop2.perfil.save')}
          </button>
          <div className="mt-4 rounded-xl bg-surface-50 dark:bg-surface-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                  {t('webshop2.perfil.visibleTitle')}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('webshop2.perfil.visibleHint')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={listed}
                onClick={() => void toggleListed()}
                disabled={listedBusy}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${listed ? 'bg-kiwi-600' : 'bg-surface-300 dark:bg-surface-600'}`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${listed ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
            </div>
            {listedError && <p className="mt-2 text-sm text-red-600">{listedError}</p>}
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-5 shadow-soft dark:shadow-dark">
          <p className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-4">
            {t('webshop2.perfil.sectionPay')}
          </p>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
                {t('webshop2.perfil.cash')}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {t('webshop2.perfil.cashHint')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cashEnabled}
              onClick={() => void togglePaymentMethod('cash', !cashEnabled)}
              disabled={payBusy}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                cashEnabled ? 'bg-kiwi-600' : 'bg-surface-300 dark:bg-surface-600'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                  cashEnabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-surface-100 dark:border-white/5 pt-3">
            <div>
              <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
                {t('webshop2.perfil.sinpe')}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {mpStatus?.status === 'active'
                  ? t('webshop2.perfil.sinpeOn')
                  : t('webshop2.perfil.sinpeOff')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sinpeEnabled && mpStatus?.status === 'active'}
              onClick={() => void togglePaymentMethod('sinpe', !sinpeEnabled)}
              disabled={payBusy || mpStatus?.status !== 'active'}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                sinpeEnabled && mpStatus?.status === 'active'
                  ? 'bg-kiwi-600'
                  : 'bg-surface-300 dark:bg-surface-600'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                  sinpeEnabled && mpStatus?.status === 'active' ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {payError && <p className="mt-2 text-sm text-red-600">{payError}</p>}
        </div>

        <div className="mt-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-5 shadow-soft dark:shadow-dark">
          <p className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-4">
            {t('webshop2.perfil.sectionCard')}
          </p>
          {mpLoading ? (
            <p className="text-sm text-surface-500">{t('webshop2.perfil.cardLoading')}</p>
          ) : mpStatus?.status === 'active' ? (
            <p className="text-sm font-semibold text-kiwi-700 dark:text-kiwi-300">
              {t('webshop2.perfil.cardActive')}
            </p>
          ) : mpStatus?.accountId ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                {t('webshop2.perfil.cardPending')}
              </p>
              <p className="text-sm text-surface-500">{t('webshop2.perfil.cardPendingHint')}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => void openRegistration()}
                  disabled={mpBusy}
                  className="flex-1 rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {mpBusy ? t('webshop2.perfil.cardOpening') : t('webshop2.perfil.cardOpen')}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshMarketplaceStatus()}
                  disabled={mpBusy}
                  className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3 text-sm font-semibold text-surface-700 dark:text-surface-200 disabled:opacity-60"
                >
                  {mpBusy ? t('webshop2.perfil.cardChecking') : t('webshop2.perfil.cardDone')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-surface-500">{t('webshop2.perfil.cardActivateHint')}</p>
              <button
                type="button"
                onClick={() => void startOnboarding()}
                disabled={mpBusy}
                className="w-full rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {mpBusy ? t('webshop2.perfil.cardActivating') : t('webshop2.perfil.cardActivate')}
              </button>
            </div>
          )}
          {mpError && <p className="mt-3 text-sm text-red-600">{mpError}</p>}
          {mpInfo && (
            <p className="mt-3 text-sm text-surface-600 dark:text-surface-300">{mpInfo}</p>
          )}
          {mpStatus?.status === 'active' && (
            <div className="mt-5 border-t border-surface-100 dark:border-surface-700/60 pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3">
                {t('webshop2.perfil.cardSettled')}
              </p>
              {mpPaymentsLoading ? (
                <p className="text-sm text-surface-500">
                  {t('webshop2.perfil.cardSettledLoading')}
                </p>
              ) : mpPayments && mpPayments.length > 0 ? (
                <ul className="space-y-2">
                  {mpPayments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-surface-50 dark:bg-surface-900 px-3 py-2"
                    >
                      <span className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                        {new Intl.NumberFormat('es-CR', {
                          style: 'currency',
                          currency: 'CRC',
                          maximumFractionDigits: 0,
                        }).format(Number(p.amount) || 0)}
                      </span>
                      <span className="shrink-0 rounded-full bg-surface-100 dark:bg-surface-700 px-2.5 py-1 text-xs font-semibold text-surface-600 dark:text-surface-200">
                        {p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-surface-500">{t('webshop2.perfil.cardSettledEmpty')}</p>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
