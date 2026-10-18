// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { api, useTranslations } from '@kiwi/ui';

export default function MerchantAdsPage() {
  const { t } = useTranslations();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [form, setForm] = useState({
    type: 'spotlight',
    title: '',
    imageUrl: '',
    startsAt: '',
    endsAt: '',
  });
  const [offer, setOffer] = useState({ title: '', body: '', imageUrl: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      const [c, b] = await Promise.all([api.getMyCampaigns(), api.getMyBroadcasts()]);
      setCampaigns(c);
      setBroadcasts(b);
    } catch {
      // Ignorado a propósito: si falla la carga, la lista queda vacía.
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.createCampaign({ ...form });
      setMsg(t('webshop2.adsweb.msgCampaign'));
      setForm({ type: 'spotlight', title: '', imageUrl: '', startsAt: '', endsAt: '' });
      void load();
    } catch (err: any) {
      setMsg(err?.message || t('webshop2.adsweb.errCreate'));
    }
  };

  const createOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.createBroadcast({ ...offer });
      setMsg(t('webshop2.adsweb.msgOffer'));
      setOffer({ title: '', body: '', imageUrl: '' });
      void load();
    } catch (err: any) {
      setMsg(err?.message || t('webshop2.adsweb.errCreate'));
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{t('webshop2.adsweb.title')}</h1>
      <p className="text-sm text-surface-500 mb-6">{t('webshop2.adsweb.subtitle')}</p>
      {msg && <p className="mb-4 rounded-xl bg-kiwi-50 p-3 text-sm">{msg}</p>}

      <section className="rounded-2xl border p-5 mb-6">
        <h2 className="font-semibold mb-3">{t('webshop2.adsweb.campaignTitle')}</h2>
        <form onSubmit={createCampaign} className="space-y-2">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="spotlight">{t('webshop2.adsweb.typeSpotlight')}</option>
            <option value="banner">{t('webshop2.adsweb.typeBanner')}</option>
          </select>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('webshop2.adsweb.campaignTitlePh')}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <input
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder={t('webshop2.adsweb.campaignImgPh')}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className="flex-1 rounded-xl border px-3 py-2 text-sm"
              required
            />
            <input
              type="date"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              className="flex-1 rounded-xl border px-3 py-2 text-sm"
              required
            />
          </div>
          <button className="rounded-xl bg-kiwi-600 text-white px-4 py-2 text-sm font-semibold">
            {t('webshop2.adsweb.campaignSubmit')}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border p-5 mb-6">
        <h2 className="font-semibold mb-3">{t('webshop2.adsweb.offerTitle')}</h2>
        <form onSubmit={createOffer} className="space-y-2">
          <input
            value={offer.title}
            onChange={(e) => setOffer({ ...offer, title: e.target.value })}
            placeholder={t('webshop2.adsweb.offerTitlePh')}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
          <input
            value={offer.body}
            onChange={(e) => setOffer({ ...offer, body: e.target.value })}
            placeholder={t('webshop2.adsweb.offerBodyPh')}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
          <input
            value={offer.imageUrl}
            onChange={(e) => setOffer({ ...offer, imageUrl: e.target.value })}
            placeholder={t('webshop2.adsweb.offerImgPh')}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-kiwi-600 text-white px-4 py-2 text-sm font-semibold">
            {t('webshop2.adsweb.offerSubmit')}
          </button>
        </form>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">
          {t('webshop2.adsweb.myCampaigns', { count: campaigns.length })}
        </h2>
        <ul className="space-y-2 text-sm">
          {campaigns.map((c) => (
            <li key={c.id} className="rounded-xl border px-3 py-2 flex justify-between">
              <span>
                {c.type} · {c.status}
              </span>
              <span>
                {String(c.startsAt).slice(0, 10)} → {String(c.endsAt).slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">
          {t('webshop2.adsweb.myOffers', { count: broadcasts.length })}
        </h2>
        <ul className="space-y-2 text-sm">
          {broadcasts.map((b) => (
            <li key={b.id} className="rounded-xl border px-3 py-2 flex justify-between">
              <span>
                {b.title} · {b.status}
              </span>
              <span>{b.citySlug}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
