// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle2, XCircle, Clock, Link2, Pause, Play } from 'lucide-react';
import { api } from '@kiwi/ui';

interface PendingCryptoPayment {
  orderId: string;
  coin: string;
  expectedAmount: number | null;
  walletAddress: string | null;
  cryptoTxHash: string | null;
  status: string;
  createdAt: string;
  order?: {
    id: string;
    status: string;
    totalAmount: number;
    businessName: string | null;
  } | null;
}

interface ReverifyResult {
  state: 'checking' | 'done';
  completed?: boolean;
  alreadyCompleted?: boolean;
  reason?: string | null;
  txHash?: string | null;
}

const PAGE_SIZE = 20;
const AUTO_REFRESH_MS = 60_000;

/**
 * Reconciliación de pagos crypto pendientes (solo admin).
 * La re-verificación fuerza el chequeo on-chain contra Horizon fila a fila:
 * el pago SOLO se acredita con evidencia en la blockchain (wallet, asset,
 * monto y tx confirmada) — el botón nunca marca pagado por sí mismo.
 */
export default function CryptoReconciliationPage() {
  const [payments, setPayments] = useState<PendingCryptoPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ReverifyResult>>({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Ref para que el interval no dependa de `results`: pausa el auto-refresh
  // mientras hay una re-verificación en curso sin reiniciar el temporizador.
  const busyRef = useRef(false);

  const load = useCallback(async (p: number) => {
    if (p === 0) setLoading(true);
    setError(null);
    try {
      const res = await api.listPendingCryptoAdmin({ take: PAGE_SIZE, skip: p * PAGE_SIZE });
      const items = Array.isArray(res?.items) ? res.items : [];
      setPayments((prev) => (p === 0 ? items : [...prev, ...items]));
      setTotal(Number(res?.total ?? 0));
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los pagos crypto');
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  useEffect(() => {
    busyRef.current = Object.values(results).some((r) => r.state === 'checking');
  }, [results]);

  // Auto-refresh (solo página 0): pestaña oculta o re-verificación en curso
  // posponen el tick; no lo cancelan.
  useEffect(() => {
    if (!autoRefresh || page !== 0) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (busyRef.current) return;
      load(0);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, page, load]);

  const reverify = async (orderId: string) => {
    setResults((prev) => ({ ...prev, [orderId]: { state: 'checking' } }));
    try {
      const res = await api.reverifyCryptoPayment(orderId);
      setResults((prev) => ({
        ...prev,
        [orderId]: {
          state: 'done',
          completed: Boolean(res?.completed),
          alreadyCompleted: Boolean(res?.alreadyCompleted),
          reason: res?.reason ?? null,
          txHash: res?.txHash ?? null,
        },
      }));
      // Si se acreditó, la fila ya no es "pendiente": refrescar la lista.
      if (res?.completed) {
        await load(0);
        setPage(0);
      }
    } catch (e: any) {
      setResults((prev) => ({
        ...prev,
        [orderId]: {
          state: 'done',
          completed: false,
          reason: e?.message || 'Error de verificación',
        },
      }));
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          Cripto — Reconciliación
        </h1>
        {/* Badge del contador: aria-live para que el auto-refresh se anuncie sin focus */}
        <span
          aria-live="polite"
          className="px-3 py-1 rounded-full text-xs font-semibold bg-kiwi-700 text-white"
        >
          {total} pendiente{total === 1 ? '' : 's'}
        </span>
        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${
            autoRefresh
              ? 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          {autoRefresh
            ? `Auto cada 1 min${lastRefreshed ? ` · ${lastRefreshed.toLocaleTimeString('es-CR')}` : ''}`
            : 'Auto-refresco pausado'}
        </span>
        <button
          type="button"
          onClick={() => setAutoRefresh((a) => !a)}
          aria-pressed={autoRefresh}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        >
          {autoRefresh ? (
            <>
              <Pause className="h-3.5 w-3.5" /> Pausar
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Reanudar
            </>
          )}
        </button>
      </div>
      <p className="-mt-4 text-surface-500 dark:text-surface-400">
        La verificación es contra la blockchain de Stellar (Horizon), nunca manual.
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 shadow-soft overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                {[
                  'Pedido',
                  'Comercio',
                  'Esperado',
                  'Wallet receptora',
                  'Creado',
                  'Verificación',
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-surface-400">
                    Cargando…
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-surface-400">
                    Sin pagos crypto pendientes 🎉
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const res = results[p.orderId];
                  const checking = res?.state === 'checking';
                  const ageMin = Math.round((Date.now() - new Date(p.createdAt).getTime()) / 60000);
                  return (
                    <tr
                      key={p.orderId}
                      className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50"
                    >
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs text-surface-500">
                          #{p.orderId.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="block text-xs text-surface-400">
                          pedido: {p.order?.status ?? '—'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm">
                        {p.order?.businessName ?? '—'}
                        <span className="block text-xs text-surface-400">
                          ₡{Number(p.order?.totalAmount ?? 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm font-medium">
                        {p.expectedAmount != null ? (
                          <>
                            {p.expectedAmount} {p.coin}
                          </>
                        ) : (
                          <span className="text-xs text-red-600 dark:text-red-400">
                            monto no registrado — no acreditable
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {p.walletAddress ? (
                          <span className="flex items-center gap-1 font-mono text-xs text-surface-500">
                            <Link2 className="h-3 w-3" />
                            {p.walletAddress.slice(0, 8)}…{p.walletAddress.slice(-6)}
                          </span>
                        ) : (
                          <span className="text-xs text-surface-400">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm">
                        <span className="flex items-center gap-1.5 text-surface-500">
                          <Clock className="h-4 w-4" />
                          hace {ageMin < 60 ? `${ageMin} min` : `${Math.round(ageMin / 60)} h`}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-start gap-1">
                          <button
                            type="button"
                            onClick={() => reverify(p.orderId)}
                            disabled={checking || p.expectedAmount == null}
                            aria-busy={checking}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-kiwi-700 text-white hover:bg-kiwi-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                            {checking ? 'Verificando…' : 'Re-verificar on-chain'}
                          </button>
                          {res?.state === 'done' && res.completed && (
                            <span
                              role="status"
                              className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400"
                            >
                              <CheckCircle2 className="h-4 w-4" /> Acreditado
                              {res.txHash ? ` (tx ${res.txHash.slice(0, 10)}…)` : ''}
                            </span>
                          )}
                          {res?.state === 'done' && !res.completed && (
                            <span
                              role="alert"
                              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400"
                            >
                              <XCircle className="h-4 w-4" />
                              Sin evidencia on-chain — sigue pendiente
                            </span>
                          )}
                        </div>
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
            type="button"
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
