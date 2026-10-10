// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  RefreshCw,
  Check,
  X,
  ClipboardList,
  Coins,
  Smartphone,
  Calendar,
  Star,
} from 'lucide-react';
import { api, Skeleton } from '@kiwi/ui';

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
  transactionId?: string;
  createdAt: string;
  driver: {
    id: string;
    userId: string;
    fullName: string;
    vehicleType: string;
    rating: number;
    user: {
      id: string;
      email: string;
      phone: string;
    };
  };
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

const FILTER_TABS = [
  { id: 'all', label: 'Todos', icon: ClipboardList },
  { id: 'pending', label: 'Pendientes', icon: Clock },
  { id: 'processing', label: 'Procesando', icon: RefreshCw },
  { id: 'completed', label: 'Completados', icon: Check },
  { id: 'rejected', label: 'Rechazados', icon: X },
];

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [transactionId, setTransactionId] = useState('');

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // For now, we'll fetch pending withdrawals (admin endpoint)
      // In a real app, you'd have an endpoint to get all withdrawals
      const data = await api.getPendingWithdrawals();
      setWithdrawals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los retiros');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(true);
      await api.approveWithdrawal(id, transactionId || undefined);
      setSelectedWithdrawal(null);
      setTransactionId('');
      fetchWithdrawals();
    } catch (err) {
      console.error('Failed to approve withdrawal:', err);
      alert('No se pudo aprobar el retiro');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      alert('Por favor ingresa un motivo de rechazo');
      return;
    }

    try {
      setActionLoading(true);
      await api.rejectWithdrawal(id, rejectReason);
      setSelectedWithdrawal(null);
      setShowRejectModal(false);
      setRejectReason('');
      fetchWithdrawals();
    } catch (err) {
      console.error('Failed to reject withdrawal:', err);
      alert('No se pudo rechazar el retiro');
    } finally {
      setActionLoading(false);
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

  const getStatusConfig = (status: string) => {
    return (
      STATUS_CONFIG[status] || {
        label: status,
        icon: '❓',
        color: 'bg-surface-100 text-surface-700',
      }
    );
  };

  // Filter withdrawals
  const filteredWithdrawals = withdrawals.filter(
    (w) => activeFilter === 'all' || w.status === activeFilter,
  );

  // Calculate totals
  const totalPending = withdrawals
    .filter((w) => w.status === 'pending')
    .reduce((sum, w) => sum + w.amount, 0);
  const totalProcessing = withdrawals
    .filter((w) => w.status === 'processing')
    .reduce((sum, w) => sum + w.amount, 0);

  if (loading && withdrawals.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          className="text-center"
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
            No pudimos cargar los retiros
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mb-6">{error}</p>
          <motion.button
            onClick={fetchWithdrawals}
            className="px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className="h-4 w-4 inline" /> Reintentar
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            <Coins className="h-6 w-6 inline" /> Retiros
          </h1>
          <p className="text-surface-500 dark:text-surface-400">
            {withdrawals.filter((w) => w.status === 'pending').length} pendientes de procesar
          </p>
        </div>
        <motion.button
          onClick={fetchWithdrawals}
          className="px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw className="h-4 w-4 inline" /> Actualizar
        </motion.button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          className="rounded-2xl bg-yellow-50 dark:bg-yellow-900/30 p-4 shadow-soft dark:shadow-dark border border-yellow-200 dark:border-yellow-800"
          whileHover={{ y: -2 }}
        >
          <p className="text-sm text-yellow-600 dark:text-yellow-400">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
            {formatCurrency(totalPending)}
          </p>
        </motion.div>
        <motion.div
          className="rounded-2xl bg-blue-50 dark:bg-blue-900/30 p-4 shadow-soft dark:shadow-dark border border-blue-200 dark:border-blue-800"
          whileHover={{ y: -2 }}
        >
          <p className="text-sm text-blue-600 dark:text-blue-400">Procesando</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {formatCurrency(totalProcessing)}
          </p>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTER_TABS.map((tab) => {
          const TabIcon = tab.icon as any;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeFilter === tab.id
                  ? 'bg-kiwi-700 text-white'
                  : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <TabIcon className="mr-1 h-4 w-4 inline" />
              {tab.label}
            </motion.button>
          );
        })}
      </div>

      {/* Withdrawals List */}
      {filteredWithdrawals.length === 0 ? (
        <motion.div className="text-center py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <span className="text-5xl mb-4 block">📭</span>
          <p className="text-surface-500 dark:text-surface-400">No hay retiros en esta categoría</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {filteredWithdrawals.map((withdrawal, index) => {
            const statusConfig = getStatusConfig(withdrawal.status);
            const StatusIcon = statusConfig.icon as any;

            return (
              <motion.div
                key={withdrawal.id}
                className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 cursor-pointer hover:shadow-medium dark:hover:shadow-dark transition-all"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedWithdrawal(withdrawal)}
                whileHover={{ y: -2 }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-900/50 text-2xl">
                      {withdrawal.paymentMethod === 'sinpe' ? (
                        <Smartphone className="h-6 w-6" />
                      ) : (
                        '🏦'
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-surface-800 dark:text-surface-100">
                        {withdrawal.driver.fullName}
                      </p>
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {withdrawal.driver.user.email}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
                  >
                    {typeof StatusIcon === 'string' ? (
                      <span>{StatusIcon}</span>
                    ) : (
                      <StatusIcon className="h-4 w-4 inline" />
                    )}{' '}
                    {statusConfig.label}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-surface-500 dark:text-surface-400">
                    <span>
                      <Calendar className="h-4 w-4 inline" /> {formatDate(withdrawal.createdAt)}
                    </span>
                    <span>
                      {withdrawal.paymentMethod === 'sinpe' ? (
                        <>
                          <Smartphone className="h-4 w-4 inline" /> SINPE
                        </>
                      ) : (
                        '🏦 Transferencia'
                      )}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-kiwi-700 dark:text-kiwi-400">
                    {formatCurrency(withdrawal.amount)}
                  </span>
                </div>

                {/* Quick Actions for Pending */}
                {withdrawal.status === 'pending' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
                    <button
                      className="flex-1 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWithdrawal(withdrawal);
                        setShowRejectModal(true);
                      }}
                    >
                      <X className="h-4 w-4 inline" /> Rechazar
                    </button>
                    <button
                      className="flex-1 py-2 text-sm font-medium bg-kiwi-700 text-white rounded-lg hover:bg-kiwi-800 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(withdrawal.id);
                      }}
                    >
                      <Check className="h-4 w-4 inline" /> Aprobar
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Withdrawal Detail Modal */}
      <AnimatePresence>
        {selectedWithdrawal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedWithdrawal(null)}
          >
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 p-6 z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                    <Coins className="h-5 w-5 inline" /> Detalle del Retiro
                  </h3>
                  <button
                    onClick={() => setSelectedWithdrawal(null)}
                    className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Amount */}
                <div className="text-center py-4">
                  <p className="text-4xl font-bold text-kiwi-700 dark:text-kiwi-400">
                    {formatCurrency(selectedWithdrawal.amount)}
                  </p>
                  <span
                    className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusConfig(selectedWithdrawal.status).color}`}
                  >
                    {(() => {
                      const ModalStatusIcon = getStatusConfig(selectedWithdrawal.status)
                        .icon as any;
                      return typeof ModalStatusIcon === 'string' ? (
                        <span>{ModalStatusIcon}</span>
                      ) : (
                        <ModalStatusIcon className="h-4 w-4 inline" />
                      );
                    })()}{' '}
                    {getStatusConfig(selectedWithdrawal.status).label}
                  </span>
                </div>

                {/* Driver Info */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                  <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">Repartidor</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400 font-bold">
                      {selectedWithdrawal.driver.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-surface-800 dark:text-surface-100">
                        {selectedWithdrawal.driver.fullName}
                      </p>
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {selectedWithdrawal.driver.user.email} • <Star className="h-4 w-4 inline" />{' '}
                        {selectedWithdrawal.driver.rating}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                  <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">
                    {selectedWithdrawal.paymentMethod === 'sinpe' ? (
                      <>
                        <Smartphone className="h-4 w-4 inline" /> Datos SINPE
                      </>
                    ) : (
                      '🏦 Datos Bancarios'
                    )}
                  </p>
                  {selectedWithdrawal.paymentMethod === 'sinpe' ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-surface-500 dark:text-surface-400">Teléfono</span>
                        <span className="font-medium text-surface-800 dark:text-surface-100">
                          {selectedWithdrawal.sinpePhone || 'No especificado'}
                        </span>
                      </div>
                      {selectedWithdrawal.sinpeName && (
                        <div className="flex justify-between">
                          <span className="text-surface-500 dark:text-surface-400">Nombre</span>
                          <span className="font-medium text-surface-800 dark:text-surface-100">
                            {selectedWithdrawal.sinpeName}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-surface-500 dark:text-surface-400">Banco</span>
                        <span className="font-medium text-surface-800 dark:text-surface-100">
                          {selectedWithdrawal.bankName || 'No especificado'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-500 dark:text-surface-400">Cuenta</span>
                        <span className="font-medium text-surface-800 dark:text-surface-100 font-mono">
                          {selectedWithdrawal.accountNumber || 'No especificado'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-500 dark:text-surface-400">Titular</span>
                        <span className="font-medium text-surface-800 dark:text-surface-100">
                          {selectedWithdrawal.accountHolder || 'No especificado'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Transaction ID (if processing/completed) */}
                {(selectedWithdrawal.status === 'processing' ||
                  selectedWithdrawal.status === 'completed') && (
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">
                      ID de Transacción
                    </p>
                    <p className="font-mono text-surface-800 dark:text-surface-100">
                      {selectedWithdrawal.transactionId || 'No registrado'}
                    </p>
                  </div>
                )}

                {/* Rejection Reason (if rejected) */}
                {selectedWithdrawal.status === 'rejected' && selectedWithdrawal.rejectionReason && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400 mb-1">Motivo de rechazo</p>
                    <p className="text-red-700 dark:text-red-300">
                      {selectedWithdrawal.rejectionReason}
                    </p>
                  </div>
                )}

                {/* Dates */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-surface-500 dark:text-surface-400">Solicitado</span>
                      <span className="text-surface-800 dark:text-surface-100">
                        {formatDate(selectedWithdrawal.createdAt)}
                      </span>
                    </div>
                    {selectedWithdrawal.processedAt && (
                      <div className="flex justify-between">
                        <span className="text-surface-500 dark:text-surface-400">Procesado</span>
                        <span className="text-surface-800 dark:text-surface-100">
                          {formatDate(selectedWithdrawal.processedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {selectedWithdrawal.status === 'pending' && (
                  <div className="space-y-3 pt-4 border-t border-surface-200 dark:border-surface-700">
                    <div>
                      <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1">
                        ID de Transacción (opcional)
                      </label>
                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Ej: SINPE-123456 o BAC-789012"
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 transition-all"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        className="flex-1 py-3 px-4 text-sm font-medium border-2 border-red-500 text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading}
                      >
                        <X className="h-4 w-4 inline" /> Rechazar
                      </button>
                      <button
                        className="flex-1 py-3 px-4 text-sm font-medium bg-kiwi-700 text-white rounded-xl hover:bg-kiwi-800 transition-colors"
                        onClick={() => handleApprove(selectedWithdrawal.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          'Procesando...'
                        ) : (
                          <>
                            <Check className="h-4 w-4 inline" /> Aprobar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Reason Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl max-w-md w-full shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
                  <X className="h-5 w-5 inline" /> Rechazar Retiro
                </h3>
                <p className="text-surface-500 dark:text-surface-400 mb-4">
                  Por favor, indica el motivo del rechazo:
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ej: Datos incorrectos, cuenta no válida, etc."
                  className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none h-24"
                />
                <div className="flex gap-3 mt-4">
                  <button
                    className="flex-1 py-3 px-4 text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason('');
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="flex-1 py-3 px-4 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                    onClick={() => selectedWithdrawal && handleReject(selectedWithdrawal.id)}
                    disabled={actionLoading || !rejectReason.trim()}
                  >
                    {actionLoading ? 'Procesando...' : 'Rechazar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
