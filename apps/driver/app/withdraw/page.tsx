// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RefreshCw, Check, X, Smartphone, Home } from 'lucide-react';
import { api, Skeleton } from '@kiwi/ui';

interface Balance {
  totalEarnings: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  availableBalance: number;
}

interface Withdrawal {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  sinpePhone?: string;
  sinpeName?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  processedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pending: {
    label: 'Pendiente',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400',
  },
  processing: {
    label: 'Procesando',
    icon: RefreshCw,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  },
  completed: {
    label: 'Completado',
    icon: Check,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
  },
  failed: {
    label: 'Cancelado',
    icon: X,
    color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  },
  rejected: {
    label: 'Rechazado',
    icon: X,
    color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  },
};

export default function WithdrawPage() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'sinpe' | 'bank_transfer'>('sinpe');
  const [sinpePhone, setSinpePhone] = useState('');
  const [sinpeName, setSinpeName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [balanceData, withdrawalsData] = await Promise.all([
        api.getBalance(),
        api.getMyWithdrawals(),
      ]);
      setBalance(balanceData);
      setWithdrawals(Array.isArray(withdrawalsData) ? withdrawalsData : []);
    } catch (err) {
      console.error('Failed to fetch withdrawal data:', err);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseInt(amount.replace(/[^0-9]/g, ''));

    if (!amountNum || amountNum < 1000) {
      alert('El monto mínimo de retiro es ₡1,000');
      return;
    }

    if (balance && amountNum > balance.availableBalance) {
      alert('Saldo insuficiente');
      return;
    }

    if (paymentMethod === 'sinpe' && !sinpePhone) {
      alert('El número SINPE es requerido');
      return;
    }

    if (paymentMethod === 'bank_transfer' && (!bankName || !accountNumber || !accountHolder)) {
      alert('Los datos bancarios son requeridos');
      return;
    }

    try {
      setSubmitting(true);
      await api.requestWithdrawal({
        amount: amountNum,
        paymentMethod,
        sinpePhone: paymentMethod === 'sinpe' ? sinpePhone : undefined,
        sinpeName: paymentMethod === 'sinpe' ? sinpeName : undefined,
        bankName: paymentMethod === 'bank_transfer' ? bankName : undefined,
        accountNumber: paymentMethod === 'bank_transfer' ? accountNumber : undefined,
        accountHolder: paymentMethod === 'bank_transfer' ? accountHolder : undefined,
      });

      // Reset form
      setAmount('');
      setSinpePhone('');
      setSinpeName('');
      setBankName('');
      setAccountNumber('');
      setAccountHolder('');
      setShowForm(false);

      // Refresh data
      fetchData();

      alert('Solicitud de retiro enviada exitosamente');
    } catch (err) {
      console.error('Failed to request withdrawal:', err);
      alert(err instanceof Error ? err.message : 'No se pudo procesar el retiro');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('¿Estás seguro de cancelar este retiro?')) return;

    try {
      await api.cancelWithdrawal(id);
      fetchData();
    } catch (err) {
      console.error('Failed to cancel withdrawal:', err);
      alert('No se pudo cancelar el retiro');
    }
  };

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString()}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const quickAmounts = [5000, 10000, 15000, 20000];

  if (loading) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
        <div className="pt-safe sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex flex-col items-center justify-center">
        <motion.div
          className="text-center p-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            😕
          </motion.div>
          <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            No pudimos cargar los datos
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mb-6">{error}</p>
          <motion.button
            onClick={fetchData}
            className="px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Reintentar
          </motion.button>
        </motion.div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 pb-28">
      {/* Header */}
      <motion.header
        className="pt-safe sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/earnings"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Retirar
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Balance Card */}
        <motion.div
          className="mb-6 rounded-3xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg overflow-hidden relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute -left-5 -bottom-5 h-20 w-20 rounded-full bg-white/10"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          />

          <div className="relative">
            <p className="text-white/80 text-sm font-medium">Saldo Disponible</p>
            <motion.p
              className="mt-1 text-4xl font-display font-bold"
              key={balance?.availableBalance}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10 }}
            >
              {formatCurrency(balance?.availableBalance || 0)}
            </motion.p>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-white/60">Ganancias</p>
                <p className="font-medium">{formatCurrency(balance?.totalEarnings || 0)}</p>
              </div>
              <div>
                <p className="text-white/60">Retirado</p>
                <p className="font-medium">{formatCurrency(balance?.totalWithdrawn || 0)}</p>
              </div>
              <div>
                <p className="text-white/60">Pendiente</p>
                <p className="font-medium">{formatCurrency(balance?.pendingWithdrawals || 0)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Withdraw Button */}
        {!showForm && (
          <motion.button
            onClick={() => setShowForm(true)}
            className="w-full mb-6 rounded-2xl bg-white dark:bg-surface-800 py-4 text-lg font-semibold text-kiwi-700 dark:text-kiwi-400 shadow-soft dark:shadow-dark border-2 border-kiwi-200 dark:border-kiwi-800"
            whileHover={{ scale: 1.02, borderColor: '#22c55e' }}
            whileTap={{ scale: 0.98 }}
          >
            Solicitar Retiro
          </motion.button>
        )}

        {/* Withdrawal Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                  Nuevo Retiro
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  aria-label="Cerrar formulario de retiro"
                  className="text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
                    Monto a retirar
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 dark:text-surface-400">
                      ₡
                    </span>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 text-2xl font-bold placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-kiwi-600 transition-all"
                    />
                  </div>
                  {/* Quick Amount Buttons */}
                  <div className="flex gap-2 mt-2">
                    {quickAmounts.map((qAmount) => (
                      <button
                        key={qAmount}
                        type="button"
                        onClick={() => setAmount(qAmount.toString())}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                          parseInt(amount) === qAmount
                            ? 'bg-kiwi-700 text-white'
                            : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600'
                        }`}
                      >
                        ₡{(qAmount / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
                    Método de pago
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('sinpe')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === 'sinpe'
                          ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30'
                          : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                      }`}
                    >
                      <Smartphone className="text-2xl block mb-1 h-6 w-6 mx-auto" />
                      <span className="font-medium text-surface-800 dark:text-surface-100">
                        SINPE
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30'
                          : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                      }`}
                    >
                      <span className="text-2xl block mb-1">🏦</span>
                      <span className="font-medium text-surface-800 dark:text-surface-100">
                        Transferencia
                      </span>
                    </button>
                  </div>
                </div>

                {/* SINPE Fields */}
                {paymentMethod === 'sinpe' && (
                  <motion.div
                    className="space-y-3"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <div>
                      <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Número SINPE
                      </label>
                      <input
                        type="tel"
                        value={sinpePhone}
                        onChange={(e) => setSinpePhone(e.target.value)}
                        placeholder="8888-1234"
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Nombre (opcional)
                      </label>
                      <input
                        type="text"
                        value={sinpeName}
                        onChange={(e) => setSinpeName(e.target.value)}
                        placeholder="Tu nombre"
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 transition-all"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Bank Transfer Fields */}
                {paymentMethod === 'bank_transfer' && (
                  <motion.div
                    className="space-y-3"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <div>
                      <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Banco
                      </label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600 transition-all"
                      >
                        <option value="">Seleccionar banco</option>
                        <option value="BAC">BAC</option>
                        <option value="BNCR">BNCR</option>
                        <option value="BCT">BCT</option>
                        <option value="Banco Improsa">Banco Improsa</option>
                        <option value="CoopedelR">CoopedelR</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Número de cuenta
                      </label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="0000-0000-0000"
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Titular de la cuenta
                      </label>
                      <input
                        type="text"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 transition-all"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={submitting || !amount || parseInt(amount.replace(/[^0-9]/g, '')) < 1000}
                  className="w-full py-4 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {submitting
                    ? 'Procesando...'
                    : `Retirar ${amount ? formatCurrency(parseInt(amount.replace(/[^0-9]/g, ''))) : ''}`}
                </motion.button>

                <p className="text-xs text-center text-surface-500 dark:text-surface-400">
                  Mínimo ₡1,000 • Los retiros se procesan de lunes a viernes
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Withdrawal History */}
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="mb-4 text-sm font-semibold text-surface-600 dark:text-surface-400">
            ClipboardList Historial de Retiros
          </h3>

          {withdrawals.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-2 block">📭</span>
              <p className="text-surface-500 dark:text-surface-400 text-sm">No hay retiros aún</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((withdrawal, index) => {
                const statusConfig = STATUS_CONFIG[withdrawal.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon as any;

                return (
                  <motion.div
                    key={withdrawal.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${statusConfig.color}`}
                      >
                        {typeof StatusIcon === 'string' ? (
                          <span className="text-lg">{StatusIcon}</span>
                        ) : (
                          <StatusIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-surface-800 dark:text-surface-100">
                          {formatCurrency(withdrawal.amount)}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {withdrawal.paymentMethod === 'sinpe' ? 'SINPE' : 'Transferencia'} •{' '}
                          {formatDate(withdrawal.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                      {withdrawal.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(withdrawal.id)}
                          aria-label={`Cancelar retiro de ${formatCurrency(withdrawal.amount)}`}
                          className="text-red-500 hover:text-red-600 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </main>
  );
}
