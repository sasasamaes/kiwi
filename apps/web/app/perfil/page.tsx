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
  const [form, setForm] = useState({
    businessName: '',
    description: '',
    address: '',
    phone: '',
    category: 'restaurante',
    logoUrl: '' as string | null,
    hours: {} as Record<string, DayHours>,
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
        });
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

        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-5 shadow-soft dark:shadow-dark space-y-4">
          <div className="flex items-center gap-4">
            <MerchantLogoEditor
              logoUrl={form.logoUrl}
              businessName={form.businessName}
              onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
            />
            <div>
              <p className="font-semibold text-surface-800 dark:text-surface-100">Foto de perfil</p>
              <p className="text-xs text-surface-500">Aparece en la lista y el menú del cliente.</p>
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

          <div>
            <p className="mb-1.5 text-sm font-medium text-surface-600 dark:text-surface-400">
              Horario (define si aparecés “Abierto”)
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
        </div>
      </main>
    </>
  );
}
