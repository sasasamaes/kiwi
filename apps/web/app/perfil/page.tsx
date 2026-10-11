// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Check } from 'lucide-react';
import { api, useAuth } from '@kiwi/ui';
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

export default function PerfilPage() {
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
    hours: {} as Record<string, DayHours>,
    socials: { instagram: '', facebook: '', tiktok: '', whatsapp: '' },
  });

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
          hours,
          socials: {
            instagram: (profile as any)?.socials?.instagram || '',
            facebook: (profile as any)?.socials?.facebook || '',
            tiktok: (profile as any)?.socials?.tiktok || '',
            whatsapp: (profile as any)?.socials?.whatsapp || '',
          },
        });
        setListed((profile as any)?.isListed !== false);
      } catch {
        if (!cancelled) setFormError('No se pudo cargar el perfil.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
        if (!cancelled) setMpError('No se pudo cargar el estado de cobros con tarjeta.');
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
      if (!form.businessName.trim()) throw new Error('El nombre del negocio es requerido.');
      const phone = normalizePhone(form.phone);
      if (form.phone.trim() !== '' && !/^\d{4}-\d{4}$/.test(phone)) {
        throw new Error('Teléfono inválido (formato 8888-8888).');
      }
      const openingHours: Record<string, { open: string; close: string }> = {};
      for (const d of DAYS) {
        const h = form.hours[d.key];
        if (h) {
          if (!isHHMM(h.open) || !isHHMM(h.close)) {
            throw new Error(`Horario inválido el ${d.label.toLowerCase()} (HH:MM).`);
          }
          openingHours[d.key] = { open: h.open, close: h.close };
        }
      }
      const [updated] = await Promise.all([
        api.updateMerchantProfile({
          businessName: form.businessName.trim(),
          description: form.description.trim() || null,
          address: form.address.trim() || undefined,
          category: form.category,
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
      setFormError(err?.message || 'No se pudo guardar.');
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
      setListedError('No se pudo cambiar la visibilidad. Intentá de nuevo.');
    } finally {
      setListedBusy(false);
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
        setMpInfo('Completá el registro en Onvo y volvé a revisar estado.');
      }
    } catch {
      setMpError('No se pudo activar los cobros con tarjeta. Intentá de nuevo.');
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
        setMpInfo('Completá el registro en Onvo y volvé a revisar estado.');
      }
    } catch {
      setMpError('No se pudo abrir el registro. Intentá de nuevo.');
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
        setMpInfo('Todavía no está activo. Terminá el registro en Onvo e intentá de nuevo.');
      }
    } catch {
      setMpError('No se pudo revisar el estado. Intentá de nuevo.');
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
          <Store className="h-6 w-6" /> Mi negocio
        </h1>
        <p className="text-sm text-surface-500 mb-6">Estos datos los ven los clientes en la app.</p>

        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-5 shadow-soft dark:shadow-dark">
          <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-4">
            Presentación
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
                  Foto de perfil
                </p>
                <p className="text-xs text-surface-500">
                  Aparece en la lista y el menú del cliente.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                Nombre del negocio *
              </label>
              <input
                value={form.businessName}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                placeholder="Restaurante El Sabor"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                Descripción
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Contanos qué ofrecen…"
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                Categoría
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="my-5 border-t border-surface-100 dark:border-surface-700/60" />
          <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-4">
            Contacto
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                  Dirección
                </label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Nicoya, Guanacaste"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-400">
                  Teléfono
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  onBlur={() => setForm((f) => ({ ...f, phone: normalizePhone(f.phone) }))}
                  placeholder="8888-8888"
                  inputMode="tel"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className="my-5 border-t border-surface-100 dark:border-surface-700/60" />
          <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-4">
            Redes sociales
          </p>
          <p className="mb-3 text-sm text-surface-500 dark:text-surface-400">
            Se muestran en tu menú de la app cliente. Acepta link o @usuario.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                { key: 'instagram', label: 'Instagram', placeholder: '@mi_negocio' },
                { key: 'facebook', label: 'Facebook', placeholder: 'link o nombre' },
                { key: 'tiktok', label: 'TikTok', placeholder: '@mi_negocio' },
                { key: 'whatsapp', label: 'WhatsApp', placeholder: '8888-8888' },
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
          <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-4">
            Horario
          </p>
          <div>
            <p className="mb-1.5 text-sm font-medium text-surface-600 dark:text-surface-400">
              Define si aparecés “Abierto”
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
                      {d.label}
                    </span>
                    {h ? (
                      <>
                        <input
                          type="time"
                          value={h.open}
                          onChange={(e) => setDay(d.key, { open: e.target.value })}
                          className="flex-1 min-w-0 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5 text-sm"
                        />
                        <span className="text-surface-400 text-sm">–</span>
                        <input
                          type="time"
                          value={h.close}
                          onChange={(e) => setDay(d.key, { close: e.target.value })}
                          className="flex-1 min-w-0 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setDay(d.key, null)}
                          title="Marcar cerrado"
                          className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Cerrado
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-surface-400">Cerrado</span>
                        <button
                          type="button"
                          onClick={() => setDay(d.key, { open: '08:00', close: '20:00' })}
                          className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-kiwi-700 dark:text-kiwi-300 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/20"
                        >
                          Agregar horario
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
              <Check className="h-4 w-4" /> Guardado
            </p>
          )}
          <button
            onClick={() => void save()}
            disabled={saving}
            className="w-full rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <div className="mt-4 rounded-xl bg-surface-50 dark:bg-surface-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                  Visible en la app cliente
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Ocultalo para probar sin que te vean. Tu QR y tu menú directo siguen funcionando.
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
          <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-4">
            Cobros con tarjeta
          </p>
          {mpLoading ? (
            <p className="text-sm text-surface-500">Cargando estado de cobros…</p>
          ) : mpStatus?.status === 'active' ? (
            <p className="text-sm font-semibold text-kiwi-700 dark:text-kiwi-300">
              Cobros con tarjeta activos ✓
            </p>
          ) : mpStatus?.accountId ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                Registro pendiente
              </p>
              <p className="text-sm text-surface-500">
                Terminá el registro en Onvo para activar los cobros con tarjeta.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => void openRegistration()}
                  disabled={mpBusy}
                  className="flex-1 rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {mpBusy ? 'Abriendo…' : 'Abrir registro'}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshMarketplaceStatus()}
                  disabled={mpBusy}
                  className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3 text-sm font-semibold text-surface-700 dark:text-surface-200 disabled:opacity-60"
                >
                  {mpBusy ? 'Revisando…' : 'Ya lo completé'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-surface-500">
                Aceptá pagos con tarjeta y SINPE directo en tu cuenta IBAN.
              </p>
              <button
                type="button"
                onClick={() => void startOnboarding()}
                disabled={mpBusy}
                className="w-full rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {mpBusy ? 'Activando…' : 'Activar cobros con tarjeta'}
              </button>
            </div>
          )}
          {mpError && <p className="mt-3 text-sm text-red-600">{mpError}</p>}
          {mpInfo && (
            <p className="mt-3 text-sm text-surface-600 dark:text-surface-300">{mpInfo}</p>
          )}
          {mpStatus?.status === 'active' && (
            <div className="mt-5 border-t border-surface-100 dark:border-surface-700/60 pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">
                Cobros liquidados
              </p>
              {mpPaymentsLoading ? (
                <p className="text-sm text-surface-500">Cargando cobros…</p>
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
                <p className="text-sm text-surface-500">Aún no hay cobros liquidados</p>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
