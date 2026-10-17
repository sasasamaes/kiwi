// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Plus, History, Phone, X, RefreshCw } from 'lucide-react';
import { api } from '@kiwi/ui';

interface CreditMerchant {
  id: string;
  businessName: string;
  balance: number;
  phone?: string | null;
  email?: string | null;
}

interface CreditEntry {
  id: string;
  amount: number;
  kind: 'recharge' | 'spend' | 'refund';
  reason?: string | null;
  orderId?: string | null;
  createdAt: string;
}

const PACKAGES = [10000, 20000, 30000, 50000];

const KIND_LABEL: Record<string, string> = {
  recharge: 'Recarga',
  spend: 'Gasto en envío',
  refund: 'Devolución',
};

export default function AdminCredits() {
  const [merchants, setMerchants] = useState<CreditMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CreditMerchant | null>(null);
  const [history, setHistory] = useState<CreditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [amount, setAmount] = useState('10000');
  const [reason, setReason] = useState('Paquete prepago semanal');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMerchants(await api.getCreditMerchants());
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los comercios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openMerchant = async (m: CreditMerchant) => {
    setSelected(m);
    setAmount('10000');
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await api.getMerchantCreditHistory(m.id, 30, 0);
      setHistory(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const recharge = async () => {
    if (!selected) return;
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      setNotice('Monto inválido');
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const res = await api.rechargeMerchantCredit(selected.id, value, reason || undefined);
      setMerchants((prev) =>
        prev.map((m) => (m.id === selected.id ? { ...m, balance: Number(res.balance) } : m)),
      );
      setSelected((prev) => (prev ? { ...prev, balance: Number(res.balance) } : prev));
      setNotice(`Recargados ₡${value.toLocaleString()} a ${selected.businessName}`);
      const res2 = await api.getMerchantCreditHistory(selected.id, 30, 0);
      setHistory(Array.isArray(res2?.items) ? res2.items : []);
    } catch (e: any) {
      setNotice(e?.message || 'No se pudo recargar');
    } finally {
      setSaving(false);
    }
  };

  const filtered = merchants.filter((m) =>
    m.businessName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const totalBalance = merchants.reduce((s, m) => s + Number(m.balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            <Coins className="h-6 w-6" /> Crédito prepago
          </h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            Recargas semanales de ₡10,000 o más · {merchants.length} comercios · ₡
            {totalBalance.toLocaleString()} en circulación
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 rounded-lg"
        >
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar comercio…"
        className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2.5 text-sm"
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m, i) => (
            <motion.button
              key={m.id}
              onClick={() => openMerchant(m)}
              className="flex w-full items-center justify-between rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 text-left"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
              whileTap={{ scale: 0.98 }}
            >
              <div>
                <p className="font-semibold text-surface-800 dark:text-surface-100">
                  {m.businessName}
                </p>
                <p className="flex items-center gap-1 text-xs text-surface-500">
                  {m.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {m.phone}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`font-mono text-lg font-bold ${Number(m.balance) < 2000 ? 'text-red-600' : 'text-kiwi-700'}`}
                >
                  ₡{Number(m.balance).toLocaleString()}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Tocar para recargar
                </p>
              </div>
            </motion.button>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-surface-500">Sin comercios</p>
          )}
        </div>
      )}

      {/* Modal recarga + historial */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-surface-800 p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">{selected.businessName}</h3>
                  <p className="font-mono text-2xl font-bold text-kiwi-700">
                    ₡{Number(selected.balance).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-surface-500 dark:text-surface-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mb-2 text-sm font-semibold">Recargar paquete</p>
              <div className="mb-3 grid grid-cols-4 gap-2">
                {PACKAGES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAmount(String(p))}
                    className={`rounded-xl py-2.5 text-sm font-bold ${
                      Number(amount) === p
                        ? 'bg-kiwi-700 text-white'
                        : 'bg-surface-100 dark:bg-surface-700 text-surface-600'
                    }`}
                  >
                    ₡{(p / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
              <div className="mb-3 flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Otro monto"
                  className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-2.5 text-sm"
                />
                <button
                  onClick={recharge}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-xl bg-kiwi-700 px-5 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> {saving ? '…' : 'Recargar'}
                </button>
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="mb-2 w-full rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-2.5 text-sm"
              />
              {notice && <p className="mb-2 text-sm text-kiwi-700">{notice}</p>}

              <p className="mb-2 mt-4 flex items-center gap-1 text-sm font-semibold">
                <History className="h-4 w-4" /> Movimientos
              </p>
              {historyLoading ? (
                <p className="text-sm text-surface-500 dark:text-surface-400">Cargando…</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-surface-500 dark:text-surface-400">Sin movimientos</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-xl bg-surface-50 dark:bg-surface-700/50 px-3 py-2 text-sm"
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
                        className={`font-mono font-bold ${Number(h.amount) >= 0 ? 'text-kiwi-700' : 'text-surface-600'}`}
                      >
                        {Number(h.amount) >= 0 ? '+' : ''}₡{Number(h.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
