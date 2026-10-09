// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { api } from '@kiwi/ui';

export default function MerchantAdsPage() {
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
    } catch {}
  };
  useEffect(() => {
    void load();
  }, []);

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.createCampaign({ ...form });
      setMsg('Campaña creada: queda pendiente de aprobación. Se cobra al aprobar.');
      setForm({ type: 'spotlight', title: '', imageUrl: '', startsAt: '', endsAt: '' });
      void load();
    } catch (err: any) {
      setMsg(err?.message || 'No se pudo crear');
    }
  };

  const createOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.createBroadcast({ ...offer });
      setMsg('Oferta creada: queda pendiente. Máximo 1/día.');
      setOffer({ title: '', body: '', imageUrl: '' });
      void load();
    } catch (err: any) {
      setMsg(err?.message || 'No se pudo crear');
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Publicidad</h1>
      <p className="text-sm text-surface-500 mb-6">
        Destacate primero o banner en la app. Se paga con tu saldo prepago al aprobarse.
      </p>
      {msg && <p className="mb-4 rounded-xl bg-kiwi-50 p-3 text-sm">{msg}</p>}

      <section className="rounded-2xl border p-5 mb-6">
        <h2 className="font-semibold mb-3">
          Nueva campaña (spotlight = primero, banner = carrusel)
        </h2>
        <form onSubmit={createCampaign} className="space-y-2">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="spotlight">Aparecer primero</option>
            <option value="banner">Banner home</option>
          </select>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Título (opcional)"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <input
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="Imagen URL (banner)"
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
            Pedir campaña
          </button>
        </form>
      </section>

      <section className="rounded-2xl border p-5 mb-6">
        <h2 className="font-semibold mb-3">Nueva oferta push (a clientes de tu ciudad)</h2>
        <form onSubmit={createOffer} className="space-y-2">
          <input
            value={offer.title}
            onChange={(e) => setOffer({ ...offer, title: e.target.value })}
            placeholder="2x1 en bowls hoy"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
          <input
            value={offer.body}
            onChange={(e) => setOffer({ ...offer, body: e.target.value })}
            placeholder="Solo hoy hasta las 8pm…"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
          <input
            value={offer.imageUrl}
            onChange={(e) => setOffer({ ...offer, imageUrl: e.target.value })}
            placeholder="Imagen URL (opcional)"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-kiwi-600 text-white px-4 py-2 text-sm font-semibold">
            Pedir oferta
          </button>
        </form>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Mis campañas ({campaigns.length})</h2>
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
        <h2 className="font-semibold mb-2">Mis ofertas ({broadcasts.length})</h2>
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
