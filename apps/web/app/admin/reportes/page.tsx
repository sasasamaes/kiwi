'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  Wand2,
  AlertTriangle,
  Pin,
} from 'lucide-react';
import { api } from '@kiwi/ui';
import {
  computeExpectedTrip,
  computeOperatingCosts,
  normalizeCosts,
  labelById,
  projectMonthly,
} from '../simulador/model';
import type { ZoneMix, OperatingCosts } from '../simulador/model';

/**
 * Reporte Real vs Proyección (admin): compara el ingreso REAL del mes
 * (commission histórica de pedidos entregados) contra la proyección del
 * simulador con el mismo modelo económico (mezcla real × pedidos/día × tasa).
 */

interface MonthlyRow {
  month: string; // "YYYY-MM"
  trips: number;
  gmv: number;
  commission: number;
  avgCommissionRate: number | null;
  tripsByZone: Record<string, number>;
}

const fmt = (n: number) => `₡${Math.round(n).toLocaleString('es-CR')}`;
const fmtCompact = (n: number) => {
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}₡${(a / 1e6).toFixed(1).replace('.0', '')}M`;
  if (a >= 1000) return `${sign}₡${Math.round(a / 1000)}K`;
  return `${sign}₡${Math.round(a)}`;
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Clave del mes anterior ("2026-09" → "2026-08"). */
function prevMonthKey(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Caída formateada para la alerta: −X% o −₡Y si no hay base para %. */
function fmtDrop(t: { pct: number | null; delta: number | null }): string {
  if (t.pct != null) return `−${Math.abs(t.pct).toFixed(0)}%`;
  if (t.delta != null) return `−${fmtCompact(Math.abs(t.delta))}`;
  return '−';
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-CR', {
    month: 'short',
    year: '2-digit',
  });
}

/** Días transcurridos del mes (mes completo si es un mes pasado). */
function daysInPeriod(ym: string): number {
  const now = new Date();
  const [y, m] = ym.split('-').map(Number);
  if (y === now.getFullYear() && m === now.getMonth() + 1) {
    return Math.max(1, now.getDate());
  }
  return new Date(y, m, 0).getDate();
}

export default function ReportesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mix, setMix] = useState<ZoneMix | null>(null);
  const [actuals, setActuals] = useState<MonthlyRow[] | null>(null);
  const [months, setMonths] = useState(6);
  const [commissionPct, setCommissionPct] = useState(15);

  // Ritmo real de los últimos 30 días (viene del endpoint monthly-actuals).
  const [last30, setLast30] = useState<{
    trips: number;
    tripsPerDay: number;
    commissionPerDay: number;
  } | null>(null);

  // Historial de escenarios fijados por mes (scenario_snapshots).
  const [history, setHistory] = useState<
    Array<{
      month: string;
      ordersPerDay: number;
      expectedTrip: number;
      commissionPct: number;
      operations: {
        fixedMonthlyCost: number;
        supportPerTrip: number;
        gatewayPct: number;
        digitalPct: number;
      };
      projectedCommission: number;
      projectedNet: number;
      note: string | null;
      createdAt: string;
    }>
  >([]);
  const [pinning, setPinning] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  // Costos operativos reales (sección `operations` de los settings).
  const [costs, setCosts] = useState<OperatingCosts>({
    fixedMonthlyCost: 150000,
    supportPerTrip: 25,
    gatewayPct: 2.9,
    digitalPct: 40,
  });
  const [costsDraft, setCostsDraft] = useState<OperatingCosts>(costs);
  const [costsEditable, setCostsEditable] = useState(false);
  const [savingCosts, setSavingCosts] = useState(false);

  const [ordersPerDay, setOrdersPerDay] = useState(20);
  useEffect(() => {
    const saved = Number(window.localStorage.getItem('kiwi.reportes.pedidosDia'));
    if (Number.isFinite(saved) && saved > 0) setOrdersPerDay(saved);
  }, []);
  useEffect(() => {
    window.localStorage.setItem('kiwi.reportes.pedidosDia', String(ordersPerDay));
  }, [ordersPerDay]);

  const load = useCallback(async (nMonths: number) => {
    setLoading(true);
    setError(null);
    try {
      const [m, a, p, s, h] = await Promise.all([
        api.getDeliveredZoneMix(),
        api.getMonthlyActuals(nMonths),
        api.getDriverCommissionPct().catch(() => 15),
        api.getAdminSettings().catch(() => null),
        api.getScenarioHistory().catch(() => []),
      ]);
      setMix(m);
      setActuals(a.monthly);
      setLast30(a.last30 ?? null);
      setHistory(h);
      setCommissionPct(Math.min(Math.max(Number(p) || 15, 0), 100));
      if (s?.operations) {
        const c = normalizeCosts(s.operations);
        setCosts(c);
        setCostsDraft(c);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveCosts = async () => {
    setSavingCosts(true);
    try {
      const c = normalizeCosts(costsDraft);
      const saved = await api.saveAdminSettings({ operations: c });
      const merged = normalizeCosts(saved?.operations ?? c);
      setCosts(merged);
      setCostsDraft(merged);
      setCostsEditable(false);
    } catch {
      // si falla, el draft queda abierto para reintentar
    } finally {
      setSavingCosts(false);
    }
  };

  useEffect(() => {
    load(months);
  }, [load, months]);

  // Proyección: mismo modelo que el simulador, ahora con costos → neta.
  const expectedTrip = computeExpectedTrip(mix);
  const proj = projectMonthly(expectedTrip, ordersPerDay, commissionPct, costs);
  const costsEditableOpen = costsEditable;

  const currentMonth = useMemo(() => {
    if (!actuals || actuals.length === 0) return null;
    const key = monthKey(new Date());
    return actuals.find((r) => r.month === key) ?? null;
  }, [actuals]);

  // Desviaciones del mes en curso.
  const currentMonthData = currentMonth;
  const projMonthly = proj.monthly;
  let dev: {
    days: number;
    realPerDay: number;
    realCommissionPerDay: number;
    deltaCommission: number;
    deltaPct: number | null;
    realRatePct: number | null;
  } | null = null;
  if (currentMonthData) {
    const days = daysInPeriod(currentMonthData.month);
    const realPerDay = currentMonthData.trips / days;
    const realCommissionPerDay = currentMonthData.commission / days;
    const deltaCommission = currentMonthData.commission - projMonthly;
    const deltaPct = projMonthly > 0 ? (deltaCommission / projMonthly) * 100 : null;
    dev = {
      days,
      realPerDay,
      realCommissionPerDay,
      deltaCommission,
      deltaPct,
      realRatePct:
        currentMonthData.avgCommissionRate != null
          ? currentMonthData.avgCommissionRate * 100
          : null,
    };
  }

  // Filas por zona: peso del mix real × escenario proyectado, contra lo real del mes.
  const zoneRows = useMemo(() => {
    if (!mix) return [];
    const inMonth = currentMonth?.tripsByZone ?? {};
    const projectedMonthTrips = Math.round(ordersPerDay * 30);
    return mix.zones
      .map((z) => {
        const projectedTrips = Math.round((projectedMonthTrips * z.weight) / 100);
        const realTrips = inMonth[z.id] ?? 0;
        return {
          id: z.id,
          weight: z.weight,
          countAll: z.count,
          realTrips,
          projectedTrips,
          delta: realTrips - projectedTrips,
        };
      })
      .sort((a, b) => b.realTrips - a.realTrips || b.weight - a.weight);
  }, [mix, currentMonth, ordersPerDay]);

  // Netos reales por mes (con los costos vigentes) para tendencia MoM.
  const netsByMonth: Record<string, number> = {};
  for (const r of actuals ?? []) {
    const c = computeOperatingCosts(r.trips, r.gmv, costs);
    netsByMonth[r.month] = r.commission - c.total;
  }

  /**
   * Tendencia de un mes vs su anterior (null si no hay base comparable:
   * mes anterior fuera del período o sin viajes — no se compara operación
   * contra meses inactivos, cuyo neto solo refleja los costos fijos).
   */
  const mom = (month: string) => {
    const prev = prevMonthKey(month);
    const rows = actuals ?? [];
    const curRow = rows.find((r) => r.month === month);
    const prevRow = rows.find((r) => r.month === prev);
    if (!curRow || !prevRow || curRow.trips === 0 || prevRow.trips === 0) return null;
    const cur = netsByMonth[month];
    const base = netsByMonth[prev];
    return {
      delta: cur - base,
      pct: base !== 0 ? ((cur - base) / Math.abs(base)) * 100 : null,
    };
  };

  // Alerta: dos CAÍDAS consecutivas de neta real (mes < anterior < previo).
  // Una sola caída puede ser ruido; dos seguidas es tendencia. Meses sin
  // viajes no cuentan (su neto solo refleja costos fijos).
  const actualsRows = actuals ?? [];
  let losingStreak: {
    curMonth: string;
    prevMonth: string;
    curNet: number;
    prevNet: number;
    delta: number;
    pct: number | null;
  } | null = null;
  for (let i = actualsRows.length - 1; i >= 2; i -= 1) {
    const m2 = actualsRows[i];
    const m1 = actualsRows[i - 1];
    const m0 = actualsRows[i - 2];
    if (m2.trips === 0 || m1.trips === 0 || m0.trips === 0) continue;
    const n2 = netsByMonth[m2.month];
    const n1 = netsByMonth[m1.month];
    const n0 = netsByMonth[m0.month];
    if (n2 < n1 && n1 < n0) {
      losingStreak = {
        curMonth: m2.month,
        prevMonth: m1.month,
        curNet: n2,
        prevNet: n1,
        delta: n2 - n1,
        pct: n1 !== 0 ? ((n2 - n1) / Math.abs(n1)) * 100 : null,
      };
      break; // la racha más reciente manda
    }
  }

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
        <div className="h-72 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800" />
      </div>
    );
  }

  if (error || !mix) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-soft dark:bg-surface-800">
        <p className="mb-4 text-sm text-surface-500">{error ?? 'Sin datos'}</p>
        <button
          onClick={() => load(months)}
          className="rounded-xl bg-kiwi-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const hasRealData = currentMonth != null && currentMonth.trips > 0;
  const curCosts = currentMonth
    ? computeOperatingCosts(currentMonth.trips, currentMonth.gmv, costs)
    : null;
  const curNet = currentMonth && curCosts ? currentMonth.commission - curCosts.total : 0;
  const curMarginPct =
    currentMonth && currentMonth.commission > 0 ? (curNet / currentMonth.commission) * 100 : null;
  const costsDirty =
    costsDraft.fixedMonthlyCost !== costs.fixedMonthlyCost ||
    costsDraft.supportPerTrip !== costs.supportPerTrip ||
    costsDraft.gatewayPct !== costs.gatewayPct ||
    costsDraft.digitalPct !== costs.digitalPct;

  /**
   * Fija el escenario vigente como snapshot del mes en curso: es la foto con
   * la que al cerrar el mes se comparará lo realmente ocurrido. Re-fijar
   * reemplaza el snapshot del mes (uno por mes).
   */
  const pinCurrentScenario = async () => {
    setPinning(true);
    setPinMsg(null);
    const ym = monthKey(new Date());
    try {
      await api.saveScenarioSnapshot({
        month: ym,
        ordersPerDay,
        expectedTrip,
        commissionPct,
        operations: costs,
        projectedCommission: proj.monthly,
        projectedNet: proj.netMonthly,
        note: null,
      });
      setPinMsg(
        `Escenario de ${monthLabel(ym)} fijado: ${ordersPerDay}/día, neta proyectada ${fmt(proj.netMonthly)}.`,
      );
      setHistory(await api.getScenarioHistory());
    } catch {
      setPinMsg('No se pudo fijar el escenario. Intentá de nuevo.');
    } finally {
      setPinning(false);
    }
  };

  /**
   * Ajusta el escenario al ritmo real de los últimos 30 días: redondea hacia
   * arriba (1+), lo persiste en la misma clave que lee el simulador y el
   * banner del dashboard, y navega al simulador con ?from=reportes para que
   * cargue el nuevo valor.
   */
  const applyRealRhythm = () => {
    if (!last30) return;
    const next = Math.max(1, Math.ceil(last30.tripsPerDay));
    setOrdersPerDay(next);
    window.localStorage.setItem('kiwi.reportes.pedidosDia', String(next));
    router.push('/admin/simulador?from=reportes');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-display font-bold text-surface-800 dark:text-surface-100">
            <BarChart3 className="h-5 w-5" /> Real vs Proyección
          </h1>
          <p className="text-sm text-surface-500">
            Ingreso real de pedidos entregados contra el escenario del simulador (mezcla real de{' '}
            {mix.classified} pedidos · tasa {commissionPct}%)
          </p>
        </div>
        <button
          onClick={() => load(months)}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
        >
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      {/* Controles del escenario */}
      <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
        <div>
          <label className="mb-1 block text-sm font-medium text-surface-600 dark:text-surface-300">
            Pedidos por día (escenario)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={ordersPerDay}
              onChange={(e) => setOrdersPerDay(Math.max(1, Number(e.target.value) || 1))}
              className="w-36 rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-surface-800 focus:outline-none focus:ring-2 focus:ring-kiwi-500 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
            />
            {last30 && (
              <button
                onClick={applyRealRhythm}
                title={`Últimos 30 días: ${last30.trips} viajes → ${last30.tripsPerDay.toFixed(1)}/día`}
                className="flex items-center gap-1.5 rounded-xl border border-kiwi-300 bg-kiwi-50 px-3 py-2.5 text-xs font-semibold text-kiwi-700 hover:bg-kiwi-100 dark:border-kiwi-700 dark:bg-kiwi-900/30 dark:text-kiwi-300 dark:hover:bg-kiwi-900/50"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Usar ritmo real (30 días): {last30.tripsPerDay.toFixed(1)}/día
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-surface-600 dark:text-surface-300">
            Período
          </label>
          <div className="flex rounded-xl border border-surface-200 p-1 dark:border-surface-700">
            {[6, 12].map((n) => (
              <button
                key={n}
                onClick={() => setMonths(n)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                  months === n
                    ? 'bg-kiwi-500 text-white'
                    : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                }`}
              >
                {n} meses
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          <p className="max-w-xs text-xs text-surface-400">
            Viaje esperado {fmt(expectedTrip)} × {commissionPct}% ={' '}
            <span className="font-semibold text-kiwi-600">{fmt(proj.perOrder)}</span> por pedido
          </p>
          <button
            onClick={pinCurrentScenario}
            disabled={pinning || loading}
            title="Guarda el escenario actual como la proyección de este mes, contra la que se comparará lo real al cerrar"
            className="flex items-center gap-1.5 rounded-xl bg-kiwi-500 px-4 py-2 text-xs font-semibold text-white hover:bg-kiwi-600 disabled:opacity-40"
          >
            <Pin className="h-3.5 w-3.5" />
            {pinning ? 'Fijando…' : 'Fijar escenario de este mes'}
          </button>
          {pinMsg && <p className="max-w-xs text-right text-xs text-surface-500">{pinMsg}</p>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div
          className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-xs text-surface-400">Real mes en curso</p>
          <p className="mt-1 text-2xl font-bold text-surface-800 dark:text-surface-100">
            {fmt(currentMonth?.commission ?? 0)}
          </p>
          <p className="text-xs text-surface-500">
            {currentMonth?.trips ?? 0} viajes · {dev ? fmt(dev.realCommissionPerDay) : '—'}/día
          </p>
          <p className="mt-1.5 border-t border-surface-100 pt-1.5 text-xs dark:border-surface-700">
            Neta real:{' '}
            <b className={curNet >= 0 ? 'text-kiwi-600' : 'text-red-500 dark:text-red-400'}>
              {fmt(curNet)}
            </b>
            {curMarginPct != null && (
              <span className="text-surface-400"> · margen {curMarginPct.toFixed(0)}%</span>
            )}
          </p>
        </motion.div>
        <motion.div
          className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <p className="text-xs text-surface-400">Neta proyectada del mes</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              proj.netMonthly >= 0 ? 'text-kiwi-600' : 'text-red-500 dark:text-red-400'
            }`}
          >
            {fmt(proj.netMonthly)}
          </p>
          <p className="text-xs text-surface-500">
            bruto {fmt(proj.monthly)} − costos {fmt(proj.costs.total)}
          </p>
        </motion.div>
        <motion.div
          className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-xs text-surface-400">Desviación neta (mes en curso)</p>
          {dev && dev.deltaPct != null && hasRealData ? (
            <>
              <p
                className={`mt-1 flex items-center gap-1.5 text-2xl font-bold ${
                  dev.deltaCommission >= 0 ? 'text-kiwi-600' : 'text-red-500 dark:text-red-400'
                }`}
              >
                {dev.deltaCommission >= 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
                {dev.deltaCommission >= 0 ? '+' : ''}
                {dev.deltaPct.toFixed(0)}%
              </p>
              <p className="text-xs text-surface-500">
                {dev.deltaCommission >= 0 ? '+' : '−'}
                {fmt(Math.abs(dev.deltaCommission))} vs proyección
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 flex items-center gap-1.5 text-2xl font-bold text-surface-400">
                <Minus className="h-5 w-5" /> —
              </p>
              <p className="text-xs text-surface-500">Sin viajes entregados aún este mes</p>
            </>
          )}
        </motion.div>
        <motion.div
          className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <p className="text-xs text-surface-400">Ritmo de viajes (día)</p>
          <p className="mt-1 text-2xl font-bold text-surface-800 dark:text-surface-100">
            {dev ? dev.realPerDay.toFixed(1) : '—'}
            <span className="text-base font-medium text-surface-400"> / {ordersPerDay}</span>
          </p>
          <p className="text-xs text-surface-500">
            {dev ? `meta del escenario: ${ordersPerDay}/día` : 'sin datos del mes'}
          </p>
        </motion.div>
      </div>

      <p className="-mt-4 text-xs text-surface-400">
        Costos aplicados: fijos {fmt(costs.fixedMonthlyCost)} · soporte {fmt(costs.supportPerTrip)}
        /viaje · pasarela {costs.gatewayPct}% sobre {costs.digitalPct}% digital del GMV —{' '}
        <button
          onClick={() => setCostsEditable((v) => !v)}
          className="font-medium text-kiwi-600 hover:underline"
        >
          editar
        </button>
      </p>

      {/* Editor rápido de costos */}
      {costsEditableOpen && (
        <motion.div
          className="rounded-2xl border border-kiwi-200 bg-kiwi-50/60 p-5 dark:border-kiwi-800 dark:bg-kiwi-900/20"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                Fijos/mes (₡)
              </label>
              <input
                type="number"
                min={0}
                value={costsDraft.fixedMonthlyCost}
                onChange={(e) =>
                  setCostsDraft({ ...costsDraft, fixedMonthlyCost: Number(e.target.value) || 0 })
                }
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                Soporte/viaje (₡)
              </label>
              <input
                type="number"
                min={0}
                value={costsDraft.supportPerTrip}
                onChange={(e) =>
                  setCostsDraft({ ...costsDraft, supportPerTrip: Number(e.target.value) || 0 })
                }
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                Pasarela (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={costsDraft.gatewayPct}
                onChange={(e) =>
                  setCostsDraft({ ...costsDraft, gatewayPct: Number(e.target.value) || 0 })
                }
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                % digital
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={costsDraft.digitalPct}
                onChange={(e) =>
                  setCostsDraft({ ...costsDraft, digitalPct: Number(e.target.value) || 0 })
                }
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={saveCosts}
              disabled={savingCosts || !costsDirty}
              className="flex items-center gap-1.5 rounded-xl bg-kiwi-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Save className="h-4 w-4" /> {savingCosts ? 'Guardando…' : 'Guardar costos'}
            </button>
            <button
              onClick={() => {
                setCostsDraft(costs);
                setCostsEditable(false);
              }}
              className="rounded-xl px-4 py-2 text-sm text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              Cancelar
            </button>
            <p className="text-xs text-surface-400">
              Se guardan para todo el sistema (también en Configuración → Costos).
            </p>
          </div>
        </motion.div>
      )}

      {/* Alerta: dos meses consecutivos con neta real a la baja */}
      {losingStreak && (
        <motion.div
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-300 bg-red-50 px-5 py-4 dark:border-red-500/40 dark:bg-red-900/20"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="min-w-0 flex-1 text-sm text-red-800 dark:text-red-200">
            Dos meses consecutivos a la baja: la neta real de{' '}
            <b className="capitalize">{monthLabel(losingStreak.curMonth)}</b> (
            {fmtCompact(losingStreak.curNet)}) quedó por debajo de{' '}
            <b className="capitalize">{monthLabel(losingStreak.prevMonth)}</b> (
            {fmtCompact(losingStreak.prevNet)}) —{' '}
            <b>{fmtDrop({ pct: losingStreak.pct, delta: losingStreak.delta })}</b>. Revisá mezcla de
            zonas, volumen y costos en el simulador.
          </p>
          <Link
            href="/admin/simulador?from=reportes"
            className="shrink-0 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
          >
            Abrir simulador
          </Link>
        </motion.div>
      )}

      {/* Gráfico: neta real por mes vs proyección de neta */}
      {actuals && actuals.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
          <p className="mb-3 text-sm font-medium text-surface-600 dark:text-surface-300">
            Ganancia neta real por mes{' '}
            <span className="text-surface-400">
              — línea punteada: neta proyectada ({fmt(proj.netMonthly)}/mes)
            </span>{' '}
            <span className="text-kiwi-600">◆ escenario fijado</span>
          </p>
          <MonthBars
            rows={actuals.map((r) => ({
              month: r.month,
              commission: r.commission - computeOperatingCosts(r.trips, r.gmv, costs).total,
            }))}
            projected={proj.netMonthly}
            historyMarks={history.map((h) => ({
              month: h.month,
              net: h.projectedNet,
            }))}
          />
        </div>
      )}

      {/* Tabla histórica */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-soft dark:bg-surface-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs text-surface-400 dark:border-surface-700">
                <th className="px-4 py-3 font-medium">Mes</th>
                <th className="px-4 py-3 text-right font-medium">Viajes</th>
                <th className="px-4 py-3 text-right font-medium">Viajes/día</th>
                <th className="px-4 py-3 text-right font-medium">GMV</th>
                <th className="px-4 py-3 text-right font-medium">Bruto</th>
                <th className="px-4 py-3 text-right font-medium">Costos</th>
                <th className="px-4 py-3 text-right font-medium">Neta</th>
                <th className="px-4 py-3 text-right font-medium" title="Cambio vs mes anterior">
                  MoM
                </th>
                <th className="px-4 py-3 text-right font-medium">Tasa real</th>
                <th className="px-4 py-3 text-right font-medium">Proy. neta</th>
                <th className="px-4 py-3 text-right font-medium">Desv.</th>
              </tr>
            </thead>
            <tbody>
              {[...(actuals ?? [])].reverse().map((r) => {
                const days = daysInPeriod(r.month);
                const c = computeOperatingCosts(r.trips, r.gmv, costs);
                const net = r.commission - c.total;
                const delta = net - proj.netMonthly;
                const deltaPct = proj.netMonthly > 0 ? (delta / proj.netMonthly) * 100 : null;
                const zero = r.trips === 0;
                const t = mom(r.month);
                return (
                  <tr
                    key={r.month}
                    className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                  >
                    <td className="px-4 py-2.5 font-medium capitalize text-surface-800 dark:text-surface-100">
                      {monthLabel(r.month)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                      {r.trips}
                    </td>
                    <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                      {(r.trips / days).toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                      {fmt(r.gmv)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-surface-800 dark:text-surface-100">
                      {fmt(r.commission)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-red-500/80 dark:text-red-400/80">
                      −{fmt(c.total)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold ${
                        net >= 0
                          ? 'text-kiwi-600 dark:text-kiwi-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}
                    >
                      {fmt(net)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        t == null
                          ? 'text-surface-400'
                          : t.delta >= 0
                            ? 'text-kiwi-600 dark:text-kiwi-400'
                            : 'text-red-500 dark:text-red-400'
                      }`}
                      title={
                        t == null
                          ? 'Sin mes anterior comparable en el período'
                          : `vs ${monthLabel(prevMonthKey(r.month))}: neta ${fmtCompact(netsByMonth[prevMonthKey(r.month)])} → ${fmtCompact(net)}`
                      }
                    >
                      {t == null ? (
                        '—'
                      ) : t.delta === 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Minus className="h-3.5 w-3.5" /> 0%
                        </span>
                      ) : t.delta > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {t.pct != null ? `+${t.pct.toFixed(0)}%` : `+${fmtCompact(t.delta)}`}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <TrendingDown className="h-3.5 w-3.5" />
                          {t.pct != null
                            ? `−${Math.abs(t.pct).toFixed(0)}%`
                            : `−${fmtCompact(Math.abs(t.delta))}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                      {r.avgCommissionRate != null
                        ? `${(r.avgCommissionRate * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-kiwi-600">{fmt(proj.netMonthly)}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        zero
                          ? 'text-surface-400'
                          : delta >= 0
                            ? 'text-kiwi-600'
                            : 'text-red-500 dark:text-red-400'
                      }`}
                    >
                      {zero
                        ? '—'
                        : `${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta))}${
                            deltaPct != null
                              ? ` (${delta >= 0 ? '+' : '−'}${Math.abs(deltaPct).toFixed(0)}%)`
                              : ''
                          }`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de escenarios fijados: proyección vs real */}
      {history.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
          <p className="mb-1 text-sm font-medium text-surface-600 dark:text-surface-300">
            Historial de escenarios
          </p>
          <p className="mb-3 text-xs text-surface-400">
            Lo que se proyectó al fijar cada mes contra la neta real que después ocurrió. Desviación
            positiva = el mes rindió mejor que lo planeado.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs text-surface-400 dark:border-surface-700">
                  <th className="px-4 py-3 font-medium">Mes fijado</th>
                  <th className="px-4 py-3 font-medium">Escenario</th>
                  <th className="px-4 py-3 text-right font-medium">Tasa</th>
                  <th className="px-4 py-3 text-right font-medium">Proy. bruto</th>
                  <th className="px-4 py-3 text-right font-medium">Proy. neta</th>
                  <th className="px-4 py-3 text-right font-medium">Neta real</th>
                  <th className="px-4 py-3 text-right font-medium">Desv.</th>
                  <th className="px-4 py-3 text-right font-medium">Fijado</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h) => {
                  const row = actuals?.find((r) => r.month === h.month);
                  const hasReal = row != null && row.trips > 0;
                  const realNet = hasReal ? netsByMonth[h.month] : null;
                  const d = realNet != null ? realNet - h.projectedNet : null;
                  return (
                    <tr
                      key={h.month}
                      className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                    >
                      <td className="px-4 py-2.5 font-medium capitalize text-surface-800 dark:text-surface-100">
                        {monthLabel(h.month)}
                      </td>
                      <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">
                        {h.ordersPerDay}/día · viaje {fmtCompact(h.expectedTrip)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                        {h.commissionPct}%
                      </td>
                      <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                        {fmtCompact(h.projectedCommission)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-surface-800 dark:text-surface-100">
                        {fmtCompact(h.projectedNet)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold ${
                          realNet == null
                            ? 'text-surface-400'
                            : realNet >= 0
                              ? 'text-kiwi-600 dark:text-kiwi-400'
                              : 'text-red-500 dark:text-red-400'
                        }`}
                      >
                        {realNet != null ? fmtCompact(realNet) : '—'}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-medium ${
                          d == null
                            ? 'text-surface-400'
                            : d >= 0
                              ? 'text-kiwi-600 dark:text-kiwi-400'
                              : 'text-red-500 dark:text-red-400'
                        }`}
                      >
                        {d == null
                          ? '—'
                          : `${d >= 0 ? '+' : '−'}${fmtCompact(Math.abs(d))}${
                              h.projectedNet !== 0
                                ? ` (${d >= 0 ? '+' : '−'}${Math.abs((d / Math.abs(h.projectedNet)) * 100).toFixed(0)}%)`
                                : ''
                            }`}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-surface-400">
                        {new Date(h.createdAt).toLocaleDateString('es-CR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Desviación por zona */}
      <div className="rounded-2xl bg-white p-5 shadow-soft dark:bg-surface-800">
        <p className="mb-1 text-sm font-medium text-surface-600 dark:text-surface-300">
          Desviación por zona
        </p>
        <p className="mb-3 text-xs text-surface-400">
          Viajes reales del mes en curso contra lo proyectado según el peso del mix real y el
          escenario de {ordersPerDay} pedidos/día
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs text-surface-400 dark:border-surface-700">
                <th className="px-4 py-3 font-medium">Zona</th>
                <th className="px-4 py-3 text-right font-medium">Peso mix</th>
                <th className="px-4 py-3 text-right font-medium">Real mes</th>
                <th className="px-4 py-3 text-right font-medium">Proyección mes</th>
                <th className="px-4 py-3 text-right font-medium">Desv.</th>
              </tr>
            </thead>
            <tbody>
              {zoneRows.map((z) => (
                <tr
                  key={z.id}
                  className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                >
                  <td className="px-4 py-2.5 font-medium text-surface-800 dark:text-surface-100">
                    {labelById.get(z.id) ?? z.id}
                  </td>
                  <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                    {z.weight}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">
                    {z.realTrips}
                  </td>
                  <td className="px-4 py-2.5 text-right text-kiwi-600">{z.projectedTrips}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-medium ${
                      z.realTrips === 0
                        ? 'text-surface-400'
                        : z.delta >= 0
                          ? 'text-kiwi-600'
                          : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {z.realTrips === 0 ? '—' : `${z.delta >= 0 ? '+' : '−'}${Math.abs(z.delta)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Barras SVG de la neta real por mes, línea de proyección y escenarios fijados. */
function MonthBars({
  rows,
  projected,
  historyMarks = [],
}: {
  rows: Array<{ month: string; commission: number }>;
  projected: number;
  historyMarks?: Array<{ month: string; net: number }>;
}) {
  const W = 660;
  const H = 210;
  const pad = { l: 10, r: 10, t: 26, b: 26 };
  const n = Math.max(1, rows.length);
  // Escala simétrica: soporta barras negativas (meses con pérdida).
  const maxV = Math.max(
    projected,
    ...rows.map((r) => r.commission),
    ...historyMarks.map((h) => h.net),
    1,
  );
  const minV = Math.min(0, ...rows.map((r) => r.commission), ...historyMarks.map((h) => h.net));
  const innerH = H - pad.t - pad.b;
  const span = Math.max(1, maxV - minV);
  const bw = (W - pad.l - pad.r) / n;
  const yFor = (v: number) => pad.t + ((maxV - v) / span) * innerH;
  const zeroY = yFor(0);
  const marksByMonth = new Map(historyMarks.map((h) => [h.month, h.net]));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Ganancia neta real por mes"
    >
      {/* Línea de proyección */}
      <line
        x1={pad.l}
        x2={W - pad.r}
        y1={yFor(projected)}
        y2={yFor(projected)}
        stroke="#f59e0b"
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
      {/* Línea de cero */}
      {zeroY !== yFor(projected) && (
        <line x1={pad.l} x2={W - pad.r} y1={zeroY} y2={zeroY} stroke="#a3a3a3" strokeWidth={1} />
      )}
      {/* Escenarios fijados (historial): diamantes kiwi */}
      {[...marksByMonth.entries()].map(([m, net]) => {
        const idx = rows.findIndex((r) => r.month === m);
        if (idx < 0) return null;
        const x = pad.l + idx * bw + bw / 2;
        const y = yFor(net);
        return (
          <g key={`mk-${m}`}>
            <line
              x1={x}
              y1={y}
              x2={x}
              y2={zeroY}
              stroke="#16a34a"
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.55}
            />
            <rect
              x={x - 5}
              y={y - 5}
              width={10}
              height={10}
              fill="#16a34a"
              transform={`rotate(45 ${x} ${y})`}
            >
              <title>{`Escenario fijado: ${fmtCompact(net)}/mes`}</title>
            </rect>
          </g>
        );
      })}
      {rows.map((r, i) => {
        const y = yFor(r.commission);
        const yBase = r.commission >= 0 ? zeroY : y;
        const h = Math.max(0, Math.abs(yFor(0) - y));
        const x = pad.l + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const isCurrent = i === n - 1;
        return (
          <g key={r.month}>
            <rect
              x={x}
              y={yBase}
              width={w}
              height={h}
              rx={5}
              fill={
                h === 0
                  ? '#d4d4d8'
                  : r.commission < 0
                    ? '#ef4444'
                    : isCurrent
                      ? '#16a34a'
                      : '#86efac'
              }
            />
            <text
              x={x + w / 2}
              y={r.commission >= 0 ? y - 6 : y + h + 12}
              textAnchor="middle"
              fontSize={10}
              fill="#737373"
            >
              {r.commission !== 0 ? fmtCompact(r.commission) : ''}
            </text>
            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#737373">
              {monthLabel(r.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
