// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Coins, Bike, Package, CalendarDays } from 'lucide-react';
import { api } from '@kiwi/ui';

const fmt = (n: number) => `₡${Math.round(Number(n) || 0).toLocaleString('es-CR')}`;

interface Bucket {
  trips: number;
  gmv: number;
  commission: number;
  driverPay: number;
}
interface RankRow {
  driverId: string;
  name: string;
  trips: number;
  driverPay: number;
  commission: number;
  todayTrips: number;
  todayPay: number;
  todayCommission: number;
}
interface OrderRow {
  id: string;
  deliveredAt: string;
  merchant: string | null;
  driver: string | null;
  basePrice: number;
  commission: number;
  driverPayout: number;
  totalAmount: number;
  deliveryZone: string | null;
}

export default function GananciasPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    launchDate: string;
    today: Bucket;
    week: Bucket;
    month: Bucket;
    sinceLaunch: Bucket;
    daily: Array<{
      date: string;
      trips: number;
      commission: number;
      driverPay: number;
      gmv: number;
    }>;
    ranking: RankRow[];
    orders: OrderRow[];
  } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await api.getKiwiEarnings());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las ganancias');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-surface-200 dark:bg-surface-800" />
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-soft dark:bg-surface-800">
        <p className="mb-4 text-sm text-surface-500">{error ?? 'Sin datos'}</p>
        <button
          onClick={load}
          className="rounded-xl bg-kiwi-700 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const cards: Array<{ title: string; sub: string; b: Bucket }> = [
    {
      title: 'Hoy',
      sub: new Date().toLocaleDateString('es-CR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      b: data.today,
    },
    { title: 'Últimos 7 días', sub: 'ventana móvil', b: data.week },
    { title: 'Este mes', sub: 'mes calendario CR', b: data.month },
    { title: 'Desde lun 19 oct', sub: 'operación real (sin tests)', b: data.sinceLaunch },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-display font-bold text-surface-800 dark:text-surface-100">
            <Coins className="h-5 w-5" /> Ganancias Kiwi
          </h1>
          <p className="text-sm text-surface-500">
            Comisión por pedido entregado · desde lun 19 oct 2026 (antes fue test y no cuenta)
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
        >
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
            <p className="text-xs text-surface-500 dark:text-surface-400">{c.title}</p>
            <p className="text-[11px] text-surface-400">{c.sub}</p>
            <p className="mt-1 text-2xl font-bold text-kiwi-700 dark:text-kiwi-300">
              {fmt(c.b.commission)}
            </p>
            <p className="text-xs text-surface-500">
              {c.b.trips} viajes · repartidores {fmt(c.b.driverPay)}
            </p>
            <p className="mt-1 text-[11px] text-surface-400">Viajes (GMV) {fmt(c.b.gmv)}</p>
          </div>
        ))}
      </div>

      {/* Ranking repartidores */}
      <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
        <p className="mb-1 flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-300">
          <Bike className="h-4 w-4" /> Ranking repartidores · desde lun 19
        </p>
        <p className="mb-3 text-xs text-surface-500">
          Cuánto ganó cada quien hoy y cuánta comisión dejó a Kiwi.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-700">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Repartidor</th>
                <th className="px-4 py-3 text-right font-medium">Viajes hoy</th>
                <th className="px-4 py-3 text-right font-medium">Ganó hoy</th>
                <th className="px-4 py-3 text-right font-medium">Kiwi hoy</th>
                <th className="px-4 py-3 text-right font-medium">Viajes total</th>
                <th className="px-4 py-3 text-right font-medium">Ganó total</th>
                <th className="px-4 py-3 text-right font-medium">Kiwi total</th>
              </tr>
            </thead>
            <tbody>
              {data.ranking.map((r, i) => (
                <tr
                  key={r.driverId}
                  className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                >
                  <td className="px-4 py-2.5">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-surface-800 dark:text-surface-100">
                    {r.name}
                  </td>
                  <td className="px-4 py-2.5 text-right">{r.todayTrips}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(r.todayPay)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-kiwi-700 dark:text-kiwi-300">
                    {fmt(r.todayCommission)}
                  </td>
                  <td className="px-4 py-2.5 text-right">{r.trips}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(r.driverPay)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-kiwi-700 dark:text-kiwi-300">
                    {fmt(r.commission)}
                  </td>
                </tr>
              ))}
              {data.ranking.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-surface-500">
                    Sin entregas desde el lun 19.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Por día */}
      <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
        <p className="mb-1 flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-300">
          <CalendarDays className="h-4 w-4" /> Por día · desde lun 19
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-700">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 text-right font-medium">Viajes</th>
                <th className="px-4 py-3 text-right font-medium">Kiwi</th>
                <th className="px-4 py-3 text-right font-medium">Repartidores</th>
                <th className="px-4 py-3 text-right font-medium">Viajes GMV</th>
              </tr>
            </thead>
            <tbody>
              {[...data.daily].reverse().map((d) => (
                <tr
                  key={d.date}
                  className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                >
                  <td className="px-4 py-2.5 font-medium">{d.date}</td>
                  <td className="px-4 py-2.5 text-right">{d.trips}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-kiwi-700">
                    {fmt(d.commission)}
                  </td>
                  <td className="px-4 py-2.5 text-right">{fmt(d.driverPay)}</td>
                  <td className="px-4 py-2.5 text-right text-surface-500">{fmt(d.gmv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle pedidos */}
      <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
        <p className="mb-1 flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-300">
          <Package className="h-4 w-4" /> Detalle por pedido · comisión Kiwi
        </p>
        <p className="mb-3 text-xs text-surface-500">
          {data.orders.length} entregados desde lun 19 · viaje = base, Kiwi = commission, repartidor
          = payout.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-700">
                <th className="px-4 py-3 font-medium">Entregado</th>
                <th className="px-4 py-3 font-medium">Comercio</th>
                <th className="px-4 py-3 font-medium">Repartidor</th>
                <th className="px-4 py-3 text-right font-medium">Viaje</th>
                <th className="px-4 py-3 text-right font-medium">Kiwi</th>
                <th className="px-4 py-3 text-right font-medium">Repartidor</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                >
                  <td className="px-4 py-2.5 text-xs text-surface-500">
                    {o.deliveredAt
                      ? new Date(o.deliveredAt).toLocaleString('es-CR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5">{o.merchant ?? '—'}</td>
                  <td className="px-4 py-2.5">{o.driver ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(o.basePrice)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-kiwi-700 dark:text-kiwi-300">
                    {fmt(o.commission)}
                  </td>
                  <td className="px-4 py-2.5 text-right">{fmt(o.driverPayout)}</td>
                </tr>
              ))}
              {data.orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-surface-500">
                    Sin entregas desde el lun 19.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
