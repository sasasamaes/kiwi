// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, CreditCard, DollarSign, Coins, Clock, Wallet, Landmark } from 'lucide-react';
import { AreaChartComponent, PieChartComponent, StatCard, api } from '@kiwi/ui';

interface AdminPayment {
  id: string;
  orderId: string;
  amount: number | string;
  method: string;
  status: string;
  createdAt: string;
  order?: {
    id: string;
    status: string;
    totalAmount: number | string;
    merchant?: { businessName?: string | null } | null;
    driver?: { fullName?: string | null } | null;
  } | null;
}

const METHOD_META: Record<string, { label: string; icon: any }> = {
  onvopay_sinpe: { label: 'SINPE', icon: Smartphone },
  onvopay_card: { label: 'Tarjeta', icon: CreditCard },
  cash: { label: 'Efectivo', icon: DollarSign },
  crypto: { label: 'Cripto', icon: Coins },
  credit: { label: 'Crédito', icon: Wallet },
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completado',
  pending: 'Pendiente',
  processing: 'Procesando',
  failed: 'Fallido',
  refunded: 'Reembolsado',
};

const STATUS_COLOR: Record<string, string> = {
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  refunded: 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-300',
};

const STATUS_FILTERS = [
  { id: '', label: 'Todos' },
  { id: 'completed', label: 'Completados' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'failed', label: 'Fallidos' },
  { id: 'refunded', label: 'Reembolsados' },
];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{
    byStatus: Record<string, { count: number; amount: number }>;
    byMethod: Record<string, { count: number; amount: number }>;
    daily30: Array<{ date: string; amount: number }>;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const load = useCallback(async (status: string, method: string, p: number) => {
    if (p === 0) setLoading(true);
    setError(null);
    try {
      const res = await api.getPaymentsAdmin({
        take: PAGE_SIZE,
        skip: p * PAGE_SIZE,
        status: status || undefined,
        method: method || undefined,
      });
      const items = Array.isArray(res?.items) ? res.items : [];
      setPayments((prev) => (p === 0 ? items : [...prev, ...items]));
      setTotal(Number(res?.total ?? 0));
      setSummary(res?.summary ?? null);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los pagos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter, methodFilter, page);
  }, [statusFilter, methodFilter, page, load]);

  const completed = summary?.byStatus?.completed;
  const pending = summary?.byStatus?.pending;
  const methodChart = Object.entries(summary?.byMethod ?? {}).map(([name, v]) => ({
    name: METHOD_META[name]?.label ?? name,
    value: v.amount,
  }));
  const dailyChart = (summary?.daily30 ?? []).map((d) => ({ date: d.date, value: d.amount }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          Gestión de Pagos
        </h1>
        <p className="text-surface-500 dark:text-surface-400">
          {total} transacciones · datos reales, sin mocks
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Cobrado"
          value={`₡${Number(completed?.amount ?? 0).toLocaleString()}`}
          icon={<Coins className="h-6 w-6" />}
          color="kiwi"
        />
        <StatCard
          title="Operaciones OK"
          value={String(completed?.count ?? 0)}
          icon={<Landmark className="h-6 w-6" />}
          color="blue"
        />
        <StatCard
          title="Pendientes"
          value={`₡${Number(pending?.amount ?? 0).toLocaleString()}`}
          icon={<Clock className="h-6 w-6" />}
          color="gold"
        />
        <StatCard
          title="Con crédito"
          value={`₡${Number(summary?.byMethod?.credit?.amount ?? 0).toLocaleString()}`}
          icon={<Wallet className="h-6 w-6" />}
          color="bark"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          className="lg:col-span-2 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            Cobrado por día (30 días)
          </h3>
          {dailyChart.length > 0 ? (
            <AreaChartComponent data={dailyChart} height={250} />
          ) : (
            <p className="py-10 text-center text-sm text-surface-400">Sin cobros aún</p>
          )}
        </motion.div>

        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            Por método
          </h3>
          {methodChart.length > 0 ? (
            <PieChartComponent data={methodChart} height={250} />
          ) : (
            <p className="py-10 text-center text-sm text-surface-400">Sin datos</p>
          )}
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(0);
              }}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === tab.id
                  ? 'bg-kiwi-700 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setMethodFilter('');
              setPage(0);
            }}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-colors ${
              methodFilter === ''
                ? 'bg-surface-800 text-white dark:bg-surface-100 dark:text-surface-800'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600'
            }`}
          >
            Todos los métodos
          </button>
          {Object.entries(METHOD_META).map(([id, m]) => (
            <button
              key={id}
              onClick={() => {
                setMethodFilter(methodFilter === id ? '' : id);
                setPage(0);
              }}
              className={`flex whitespace-nowrap items-center gap-1 px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                methodFilter === id
                  ? 'bg-surface-800 text-white dark:bg-surface-100 dark:text-surface-800'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600'
              }`}
            >
              <m.icon className="h-4 w-4" /> {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 shadow-soft overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                {['Pedido', 'Comercio', 'Repartidor', 'Método', 'Monto', 'Estado', 'Fecha'].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-surface-400">
                    Cargando…
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-surface-400">
                    Sin pagos con este filtro
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const meta = METHOD_META[p.method] ?? { label: p.method, icon: Coins };
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50"
                    >
                      <td className="py-4 px-6 font-mono text-xs text-surface-500">
                        #{p.orderId.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-4 px-6 text-sm">
                        {p.order?.merchant?.businessName ?? '—'}
                      </td>
                      <td className="py-4 px-6 text-sm">
                        {p.order?.driver?.fullName ?? <span className="text-surface-400">—</span>}
                      </td>
                      <td className="py-4 px-6">
                        <span className="flex items-center gap-1.5 text-sm">
                          <meta.icon className="h-4 w-4 text-surface-400" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium">
                        ₡{Number(p.amount).toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[p.status] ?? 'bg-surface-100 text-surface-500'}`}
                        >
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-surface-500">
                        {new Date(p.createdAt).toLocaleDateString('es-CR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {pages > 1 && (
        <p className="text-center text-xs text-surface-400">
          Página {page + 1} de {pages} ·{' '}
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            className="font-semibold text-kiwi-700 disabled:opacity-40"
          >
            Cargar más
          </button>
        </p>
      )}
    </div>
  );
}
