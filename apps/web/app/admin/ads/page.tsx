// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { api, useTranslations } from '@kiwi/ui';

export default function AdminAdsPage() {
  const { t } = useTranslations();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      setCampaigns(await api.adminListCampaigns());
    } catch {
      // Ignorado a propósito: si falla la carga, la lista queda vacía.
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const review = async (id: string, approve: boolean) => {
    setMsg(null);
    try {
      await api.reviewCampaign(id, approve);
      setMsg(approve ? t('webadmin2.aads.approved') : t('webadmin2.aads.rejected'));
      void load();
    } catch (err: any) {
      setMsg(err?.message || t('webadmin2.aads.failed'));
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{t('webadmin2.aads.title')}</h1>
      <p className="text-sm text-surface-500 mb-6">{t('webadmin2.aads.subtitle')}</p>
      {msg && <p className="mb-4 rounded-xl bg-kiwi-50 p-3 text-sm">{msg}</p>}
      <ul className="space-y-2 text-sm">
        {campaigns.map((c) => (
          <li
            key={c.id}
            className="rounded-xl border px-3 py-2 flex items-center justify-between gap-2"
          >
            <span>
              {c.merchant?.businessName} · {c.type} · {c.status} · {c.citySlug} ·{' '}
              {t('webadmin2.aads.pricePerDay', { price: Number(c.pricePerDay) })}
            </span>
            <span className="flex gap-2">
              <button
                onClick={() => void review(c.id, true)}
                className="rounded-lg bg-kiwi-600 text-white px-3 py-1"
              >
                {t('webadmin2.aads.approve')}
              </button>
              <button
                onClick={() => void review(c.id, false)}
                className="rounded-lg border px-3 py-1"
              >
                {t('webadmin2.aads.reject')}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
