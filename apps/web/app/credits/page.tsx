'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, CreditCard, History, RefreshCw, Check, X } from 'lucide-react';
import { api, useAuth, safeNavigateToUrl } from '@kiwi/ui';
import { MerchantNav } from '../../components/MerchantNav';

const PACKAGES = [10000, 20000, 30000, 50000];
const MIN_TOPUP = 10000;

const KIND_LABEL: Record<string, string> = {
  recharge: 'Recarga',
  spend: 'Gasto en envío',
  refund: 'Devolución',
};

type ReturnState =
  | { kind: 'polling'; topupId: string }
  | { kind: 'completed'; amount: number }
  | { kind: 'failed' }
  | { kind: 'cancelled' }
  | null;

function CreditsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('20000');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnState, setReturnState] = useState<ReturnState>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    try {
      const [b, h] = await Promise.all([
        api.getCreditBalance().catch(() => null),
        api.getCreditHistory(30, 0).catch(() => null),
      ]);
      if (b) setBalance(Number(b.balance ?? 0));
      if (h) setHistory(Array.isArray(h.items) ? h.items : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [user, load]);

  // Retorno desde Onvo: ?topup=<id>&paid=1 → encuestar hasta acreditar.
  useEffect(() => {
    const topupId = searchParams.get('topup');
    if (!topupId || !user) return;
    if (searchParams.get('cancelled') === '1') {
      setReturnState({ kind: 'cancelled' });
      return;
    }
    if (searchParams.get('paid') !== '1') return;

    let attempts = 0;
    setReturnState({ kind: 'polling', topupId });
    const poll = async () => {
      attempts += 1;
      try {
        const st = await api.getCreditTopup(topupId);
        if (st?.status === 'completed') {
          setReturnState({ kind: 'completed', amount: Number(st.amount ?? 0) });
          load();
          return;
        }
        if (st?.status === 'failed') {
          setReturnState({ kind: 'failed' });
          return;
        }
      } catch {
        // Sin red: seguir intentando hasta agotar.
      }
      if (attempts < 40) {
        pollTimer.current = setTimeout(poll, 3000);
      } else {
        setReturnState({ kind: 'failed' });
      }
    };
    poll();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [searchParams, user, load]);

  const payWithCard = async () => {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value < MIN_TOPUP) {
      setError(`La recarga mínima con tarjeta es ₡${MIN_TOPUP.toLocaleString()}`);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await api.createCreditTopup(value);
      if (!res?.checkoutUrl || !safeNavigateToUrl(res.checkoutUrl)) {
        throw new Error('Onvo no devolvió link de pago. Probá de nuevo.');
      }
      // Vamos a Onvo: al volver, ?topup=&paid=1 confirma la acreditación.
    } catch (e: any) {
      setError(e?.message || 'No se pudo iniciar el pago con tarjeta');
      setCreating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <MerchantNav />
        <main className="mx-auto max-w-3xl space-y-3 p-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
            />
          ))}
        </main>
      </>
    );
  }

  return (
    <>
      <MerchantNav />
      <main className="mx-auto max-w-3xl p-6 pb-20">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Coins className="h-6 w-6" /> Mi crédito
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          Cubre tus envíos (solo el viaje). Recargá con tarjeta cuando quieras.
        </p>

        <AnimatePresence>
          {returnState?.kind === 'polling' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center gap-3 rounded-2xl border border-kiwi-300 dark:border-kiwi-700 bg-kiwi-50 dark:bg-kiwi-900/30 p-4"
            >
              <RefreshCw className="h-5 w-5 animate-spin text-kiwi-700" />
              <p className="text-sm font-medium text-kiwi-800 dark:text-kiwi-200">
                Confirmando tu pago con el banco… no cierres esta pantalla.
              </p>
            </motion.div>
          )}
          {returnState?.kind === 'completed' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-2xl border border-kiwi-300 dark:border-kiwi-700 bg-kiwi-50 dark:bg-kiwi-900/30 p-4"
            >
              <p className="flex items-center gap-2 text-sm font-bold text-kiwi-800 dark:text-kiwi-200">
                <Check className="h-5 w-5" /> ¡Recarga acreditada! +₡
                {returnState.amount.toLocaleString()}
              </p>
              <button
                onClick={() => setReturnState(null)}
                className="mt-1 text-xs text-kiwi-700 underline underline-offset-2"
              >
                Descartar
              </button>
            </motion.div>
          )}
          {returnState?.kind === 'failed' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4"
            >
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                No pudimos confirmar el pago. Si te lo cobraron, escribinos y lo revisamos.
              </p>
              <button
                onClick={() => setReturnState(null)}
                className="mt-1 text-xs text-red-600 underline underline-offset-2"
              >
                Descartar
              </button>
            </motion.div>
          )}
          {returnState?.kind === 'cancelled' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-4"
            >
              <p className="text-sm text-surface-600 dark:text-surface-300">
                Pago cancelado: no se recargó nada.
              </p>
              <button
                onClick={() => setReturnState(null)}
                aria-label="Descartar aviso"
                className="text-surface-500 dark:text-surface-400"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saldo */}
        <div className="mt-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-6 text-center shadow-soft dark:shadow-dark">
          <p className="text-xs font-semibold uppercase tracking-widest text-surface-500 dark:text-surface-400">
            Saldo disponible
          </p>
          <p className="mt-1 font-mono font-bold text-kiwi-700 dark:text-kiwi-400">
            <span className="text-2xl align-middle">₡</span>
            <span className="text-5xl">{Number(balance ?? 0).toLocaleString()}</span>
          </p>
          <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
            Cubre solo el viaje de tus envíos
          </p>
        </div>

        {/* Recarga con tarjeta */}
        <div className="mt-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-5 shadow-soft dark:shadow-dark">
          <p className="mb-1 flex items-center gap-2 text-sm font-bold">
            <CreditCard className="h-4 w-4 text-kiwi-600" /> Recargar con tarjeta
          </p>
          <p className="mb-3 text-xs text-surface-500">
            Pago seguro con Onvo. Se acredita solo al confirmarse el cobro.
          </p>
          <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PACKAGES.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(String(p))}
                className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${
                  Number(amount) === p
                    ? 'bg-kiwi-700 text-white'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                }`}
              >
                ₡{(p / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min={MIN_TOPUP}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Otro monto"
              className="flex-1 min-w-0 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2.5 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={payWithCard}
              disabled={creating}
              className="rounded-xl bg-kiwi-700 px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {creating ? 'Abriendo…' : 'Pagar'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {/* Movimientos */}
        <div className="mt-6">
          <p className="mb-2 flex items-center gap-1 text-sm font-semibold">
            <History className="h-4 w-4" /> Movimientos
          </p>
          {history.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-6 text-center shadow-soft dark:shadow-dark">
              <p className="text-sm font-medium text-surface-700 dark:text-surface-200">
                Todavía no hay movimientos.
              </p>
              <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                Tus recargas y gastos de envío aparecen aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h: any) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-xl bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 px-4 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{KIND_LABEL[h.kind] ?? h.kind}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {h.reason ?? ''} ·{' '}
                      {new Date(h.createdAt).toLocaleDateString('es-CR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-bold ${Number(h.amount) >= 0 ? 'text-kiwi-700' : 'text-surface-600 dark:text-surface-300'}`}
                  >
                    {Number(h.amount) >= 0 ? '+' : ''}₡{Number(h.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm font-medium text-kiwi-700 hover:underline"
        >
          ← Volver al panel
        </Link>
      </main>
    </>
  );
}

export default function CreditsPage() {
  return (
    <Suspense
      fallback={<main className="min-h-[100dvh] flex items-center justify-center">Cargando…</main>}
    >
      <CreditsInner />
    </Suspense>
  );
}
