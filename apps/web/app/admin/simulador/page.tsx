'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calculator, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';
import { api } from '@kiwi/ui';
import { priceById, labelById, computeExpectedTrip } from './model';
import type { ZoneMix } from './model';

const fmt = (n: number) => `₡${Math.round(n).toLocaleString('es-CR')}`;

/**
 * Simulador de ganancias (admin): proyecta el ingreso de Kiwi con la mezcla
 * REAL de zonas de pedidos entregados.
 *
 * Modelo: por pedido la app retiene `comisión % × viaje`. Viaje esperado =
 * Σ (peso de la zona × precio del viaje). Pedidos sin zona clasificable no
 * entran al cálculo (se avisa cuántos son).
 */
export default function SimuladorPage() {
  const [mix, setMix] = useState<ZoneMix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // El escenario se comparte con el reporte vía localStorage; si se llega con
  // ?from=reportes se recarga el valor guardado (p.ej. "Usar ritmo real").
  const [fromReportes, setFromReportes] = useState(false);
  const [ordersPerDay, setOrdersPerDay] = useState(20);
  const [commissionPct, setCommissionPct] = useState(15);
  const [savedPct, setSavedPct] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, p] = await Promise.all([
        api.getDeliveredZoneMix(),
        api.getDriverCommissionPct().catch(() => 15),
      ]);
      setMix(m);
      const pct = Math.min(Math.max(Number(p) || 15, 0), 100);
      setCommissionPct(pct);
      setSavedPct(pct);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('from') === 'reportes') {
      setFromReportes(true);
    }
  }, []);

  // Aplica el escenario compartido por el reporte (localStorage).
  useEffect(() => {
    if (!fromReportes) return;
    const saved = Number(window.localStorage.getItem('kiwi.reportes.pedidosDia'));
    if (Number.isFinite(saved) && saved > 0) setOrdersPerDay(Math.round(saved));
  }, [fromReportes]);

  // Viaje esperado con la mezcla real (mismo modelo que usa el reporte).
  const expectedTrip = computeExpectedTrip(mix);

  const rate = Math.min(Math.max(commissionPct || 0, 0), 100) / 100;
  const perDay = Math.max(0, ordersPerDay || 0);
  const revenuePerOrder = expectedTrip * rate;
  const dailyRevenue = perDay * revenuePerOrder;
  const monthlyRevenue = dailyRevenue * 30;

  const applyCommission = async () => {
    setApplying(true);
    setApplyMsg(null);
    try {
      const current = await api.getAdminSettings();
      await api.saveAdminSettings({
        platform: { ...current.platform, commission: rate * 100 },
      });
      setSavedPct(rate * 100);
      setApplyMsg(`Comisión guardada en ${rate * 100}%. Rige para pedidos nuevos.`);
    } catch (err) {
      setApplyMsg(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setApplying(false);
    }
  };
  const dirty = savedPct == null || Math.abs(savedPct - rate * 100) > 1e-9;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-56 animate-pulse rounded-xl bg-surface-200 dark:bg-surface-800" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800" />
      </div>
    );
  }

  if (error || !mix) {
    return (
      <div className="rounded-2xl bg-white dark:bg-surface-800 p-8 text-center shadow-soft">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <p className="mb-4 text-sm text-surface-500">{error ?? 'Sin datos'}</p>
        <button
          onClick={load}
          className="rounded-xl bg-kiwi-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-display font-bold text-surface-800 dark:text-surface-100">
            <Calculator className="h-5 w-5" /> Simulador de ganancias
          </h1>
          <p className="text-sm text-surface-500">
            Proyección con la mezcla real de {mix.classified} pedidos entregados
            {mix.unclassified > 0 && ` (${mix.unclassified} sin zona no entran)`}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
        >
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      {mix.classified === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-surface-800 p-8 text-center shadow-soft">
          <p className="text-sm text-surface-500">
            Todavía no hay pedidos entregados con zona. El simulador se activa con datos reales.
          </p>
        </div>
      ) : (
        <>
          {/* Controles */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white dark:bg-surface-800 p-5 shadow-soft">
              <label className="mb-1 block text-sm font-medium text-surface-600 dark:text-surface-300">
                Pedidos por día
              </label>
              <input
                type="number"
                min={0}
                value={ordersPerDay}
                onChange={(e) => setOrdersPerDay(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2.5 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
            </div>
            <div className="rounded-2xl bg-white dark:bg-surface-800 p-5 shadow-soft">
              <label className="mb-1 block text-sm font-medium text-surface-600 dark:text-surface-300">
                Comisión al repartidor (% del viaje)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(Number(e.target.value) || 0)}
                  className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2.5 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
                />
                <button
                  onClick={applyCommission}
                  disabled={applying || !dirty}
                  className="rounded-xl bg-kiwi-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  title="Guardar como tasa vigente (rige para pedidos nuevos)"
                >
                  {applying ? '…' : 'Aplicar'}
                </button>
              </div>
              {applyMsg && <p className="mt-1.5 text-xs text-surface-500">{applyMsg}</p>}
            </div>
          </div>

          {/* Resultado */}
          <motion.div
            className="rounded-2xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="grid gap-4 text-center sm:grid-cols-4">
              <div>
                <p className="text-xs text-white/70">Viaje esperado</p>
                <p className="text-2xl font-bold">{fmt(expectedTrip)}</p>
              </div>
              <div>
                <p className="text-xs text-white/70">Por pedido (Kiwi)</p>
                <p className="text-2xl font-bold">{fmt(revenuePerOrder)}</p>
              </div>
              <div>
                <p className="text-xs text-white/70">Por día</p>
                <p className="text-2xl font-bold">{fmt(dailyRevenue)}</p>
              </div>
              <div>
                <p className="flex items-center justify-center gap-1 text-xs text-white/70">
                  <TrendingUp className="h-3 w-3" /> Por mes (×30)
                </p>
                <p className="text-2xl font-bold">{fmt(monthlyRevenue)}</p>
              </div>
            </div>
          </motion.div>

          {/* Detalle por zona */}
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-800 shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700 text-left text-xs text-surface-400">
                    <th className="px-4 py-3 font-medium">Zona</th>
                    <th className="px-4 py-3 text-right font-medium">Pedidos</th>
                    <th className="px-4 py-3 text-right font-medium">Peso</th>
                    <th className="px-4 py-3 text-right font-medium">Viaje</th>
                    <th className="px-4 py-3 text-right font-medium">Kiwi/día</th>
                  </tr>
                </thead>
                <tbody>
                  {mix.zones.map((z) => {
                    const price = priceById.get(z.id) ?? 0;
                    const zoneDaily = perDay * (z.weight / 100);
                    return (
                      <tr
                        key={z.id}
                        className="border-b border-surface-100 dark:border-surface-800 last:border-0"
                      >
                        <td className="px-4 py-2.5 font-medium text-surface-800 dark:text-surface-100">
                          {labelById.get(z.id) ?? z.id}
                        </td>
                        <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                          {z.count}
                        </td>
                        <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                          {z.weight}%
                        </td>
                        <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                          {fmt(price)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-kiwi-600">
                          {fmt(zoneDaily * price * rate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
