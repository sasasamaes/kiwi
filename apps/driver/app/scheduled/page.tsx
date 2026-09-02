'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AnimatedButton, 
  StaggerContainer, 
  StaggerItem,
  Skeleton,
  ThemeToggle,
  useAuth,
  useSocket,
  api,
  Order
} from '@kiwi/ui';

export default function ScheduledOrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [scheduledOrders, setScheduledOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string[]>([]);

  // Proposal form data
  const [proposalData, setProposalData] = useState({
    estimatedArrival: '',
    message: '',
  });

  // Real-time socket for new scheduled orders
  const { isConnected, on } = useSocket({
    onConnect: () => console.log('🟢 Connected for scheduled orders'),
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchScheduledOrders = useCallback(async () => {
    try {
      const data = await api.getScheduledOrders();
      setScheduledOrders(data);
    } catch (error) {
      console.error('Failed to fetch scheduled orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchScheduledOrders();
    }
  }, [user, fetchScheduledOrders]);

  // Listen for new scheduled orders
  useEffect(() => {
    const cleanup = on('order:new', (data: any) => {
      console.log('📅 New scheduled order:', data);
      fetchScheduledOrders();
    });

    return cleanup;
  }, [on, fetchScheduledOrders]);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowProposalForm(true);
    setProposalData({ estimatedArrival: '', message: '' });
  };

  const handleSubmitProposal = useCallback(async () => {
    if (!selectedOrder || !proposalData.estimatedArrival.trim()) return;

    setSubmitting(true);
    try {
      await api.submitProposal(selectedOrder.id, proposalData);
      setSubmitted(prev => [...prev, selectedOrder.id]);
      setShowProposalForm(false);
      setSelectedOrder(null);
      setProposalData({ estimatedArrival: '', message: '' });
    } catch (error) {
      console.error('Failed to submit proposal:', error);
      alert('Error al enviar propuesta');
    } finally {
      setSubmitting(false);
    }
  }, [selectedOrder, proposalData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-surface-950">
        <div className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <div className="mx-auto max-w-lg px-4 py-8 space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark">
              <div className="flex gap-4">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-bg-light dark:bg-surface-950 pb-24">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200">
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">Inicio</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">📅 Pedidos Programados</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Info Banner */}
        <motion.div
          className="mb-6 rounded-2xl bg-gold-50 dark:bg-gold-900/30 p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-medium text-surface-800 dark:text-surface-200">Propón tu servicio</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                Envía tu propuesta con tiempo estimado de llegada y un mensaje. El comerciante elegirá al repartidor que mejor se adapte.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Orders List */}
        {scheduledOrders.length === 0 ? (
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-12 text-center shadow-soft dark:shadow-dark"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="text-6xl mb-4"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              📅
            </motion.div>
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-2">
              No hay pedidos programados
            </h3>
            <p className="text-surface-500 dark:text-surface-400">
              Cuando los comerciantes creen pedidos programados, aparecerán aquí
            </p>
          </motion.div>
        ) : (
          <StaggerContainer className="space-y-4">
            {scheduledOrders.map((order) => {
              const hasSubmitted = submitted.includes(order.id);
              
              return (
                <StaggerItem key={order.id}>
                  <motion.div
                    className={`rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark ${
                      hasSubmitted ? 'ring-2 ring-kiwi-500' : ''
                    }`}
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex gap-4">
                      {/* Schedule Icon */}
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gold-100 dark:bg-gold-900/30 text-3xl flex-shrink-0">
                        📅
                      </div>

                      {/* Order Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                              Pedido Programado
                            </h3>
                            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                              {order.pickupAddress} → {order.deliveryAddress}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-kiwi-600 dark:text-kiwi-400">
                            ₡{Number(order.totalAmount).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 mt-3">
                          {/* Schedule Time */}
                          {order.scheduledDate && (
                            <span className="flex items-center gap-1 text-sm text-gold-600 dark:text-gold-400 font-medium">
                              📅 {new Date(order.scheduledDate).toLocaleDateString('es-CR', { weekday: 'short', month: 'short', day: 'numeric' })}
                              {order.scheduledTime && ` • ${order.scheduledTime}`}
                            </span>
                          )}

                          {/* Distance */}
                          {order.distanceKm && (
                            <span className="text-sm text-surface-500 dark:text-surface-400">
                              📍 {order.distanceKm} km
                            </span>
                          )}
                        </div>

                        {/* Action Button */}
                        <div className="mt-3">
                          {hasSubmitted ? (
                            <div className="flex items-center gap-2 text-kiwi-600 dark:text-kiwi-400">
                              <span className="text-lg">✅</span>
                              <span className="text-sm font-medium">Propuesta enviada</span>
                            </div>
                          ) : (
                            <AnimatedButton
                              variant="gradient"
                              className="w-full"
                              onClick={() => handleSelectOrder(order)}
                            >
                              📩 Enviar Propuesta
                            </AnimatedButton>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </main>

      {/* Proposal Form Modal */}
      <AnimatePresence>
        {showProposalForm && selectedOrder && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { setShowProposalForm(false); setSelectedOrder(null); }}
            />

            {/* Modal */}
            <motion.div 
              className="relative w-full max-w-lg bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Handle */}
              <div className="pt-4 pb-2 px-6 border-b border-surface-100 dark:border-surface-700 rounded-t-3xl sm:rounded-t-3xl">
                <div className="w-12 h-1 bg-surface-300 dark:bg-surface-600 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                    📩 Enviar Propuesta
                  </h2>
                  <motion.button
                    onClick={() => { setShowProposalForm(false); setSelectedOrder(null); }}
                    className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >✕</motion.button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Order Summary */}
                <div className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500 dark:text-surface-400">📍 Recoger:</span>
                      <span className="font-medium text-surface-800 dark:text-surface-200 text-right max-w-[60%]">
                        {selectedOrder.pickupAddress}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500 dark:text-surface-400">🏠 Entregar:</span>
                      <span className="font-medium text-surface-800 dark:text-surface-200 text-right max-w-[60%]">
                        {selectedOrder.deliveryAddress}
                      </span>
                    </div>
                    {selectedOrder.scheduledDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-surface-500 dark:text-surface-400">📅 Fecha:</span>
                        <span className="font-medium text-gold-600 dark:text-gold-400">
                          {new Date(selectedOrder.scheduledDate).toLocaleDateString('es-CR', { weekday: 'long', month: 'long', day: 'numeric' })}
                          {selectedOrder.scheduledTime && ` a las ${selectedOrder.scheduledTime}`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500 dark:text-surface-400">💰 Pago:</span>
                      <span className="font-bold text-kiwi-600 dark:text-kiwi-400">
                        ₡{Number(selectedOrder.driverPayout || selectedOrder.totalAmount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Estimated Arrival */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    🕐 ¿Cuándo puedes llegar? *
                  </label>
                  <input
                    type="text"
                    value={proposalData.estimatedArrival}
                    onChange={(e) => setProposalData({ ...proposalData, estimatedArrival: e.target.value })}
                    placeholder="Ej: En 15 minutos, A las 3:00 PM, En una hora"
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['En 10 min', 'En 15 min', 'En 30 min', 'En 1 hora'].map((time) => (
                      <motion.button
                        key={time}
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          proposalData.estimatedArrival === time
                            ? 'bg-kiwi-500 text-white'
                            : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200'
                        }`}
                        onClick={() => setProposalData({ ...proposalData, estimatedArrival: time })}
                        whileTap={{ scale: 0.95 }}
                      >
                        {time}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    💬 Mensaje (opcional)
                  </label>
                  <textarea
                    value={proposalData.message}
                    onChange={(e) => setProposalData({ ...proposalData, message: e.target.value })}
                    placeholder="Ej: Conozco bien la zona, llego rápido. Tengo moto nueva."
                    rows={3}
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                  />
                </div>

                {/* Submit Button */}
                <AnimatedButton
                  variant="gradient"
                  className="w-full"
                  onClick={handleSubmitProposal}
                  disabled={!proposalData.estimatedArrival.trim() || submitting}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⏳</motion.span>
                      Enviando...
                    </span>
                  ) : (
                    '📩 Enviar Mi Propuesta'
                  )}
                </AnimatedButton>

                <p className="text-xs text-center text-surface-400">
                  El comerciante verá tu propuesta y te elegirá si eres el mejor fit
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
