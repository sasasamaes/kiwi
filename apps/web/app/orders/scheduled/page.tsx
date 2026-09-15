'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin, Home, Coins, Star, Check, ClipboardList } from 'lucide-react';
import {
  AnimatedButton,
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
  Skeleton,
  ThemeToggle,
  useAuth,
  useSocket,
  api,
  Order,
  DriverProposal,
  VehicleBadge,
} from '@kiwi/ui';

export default function ScheduledOrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [scheduledOrders, setScheduledOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [proposals, setProposals] = useState<DriverProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [acceptingProposal, setAcceptingProposal] = useState<string | null>(null);

  // Real-time socket for new proposals
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
      const data = await api.getMyOrders('driver_proposals');
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

  const fetchProposals = useCallback(async (orderId: string) => {
    setLoadingProposals(true);
    try {
      const data = await api.getProposals(orderId);
      setProposals(data);
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
    } finally {
      setLoadingProposals(false);
    }
  }, []);

  // Listen for new proposals
  useEffect(() => {
    const cleanup = on('order:proposalReceived', (data: any) => {
      console.log('📩 New proposal received:', data);
      fetchScheduledOrders();
      // If viewing this order, refresh proposals
      if (selectedOrder?.id === data.orderId) {
        fetchProposals(data.orderId);
      }
    });

    return cleanup;
  }, [on, selectedOrder, fetchScheduledOrders]);

  const handleSelectOrder = useCallback(
    async (order: Order) => {
      setSelectedOrder(order);
      await fetchProposals(order.id);
    },
    [fetchProposals],
  );

  const handleAcceptProposal = useCallback(
    async (proposalId: string) => {
      if (!selectedOrder) return;

      setAcceptingProposal(proposalId);
      try {
        await api.acceptProposal(selectedOrder.id, proposalId);
        // Refresh orders and close modal
        await fetchScheduledOrders();
        setSelectedOrder(null);
        setProposals([]);
      } catch (error) {
        console.error('Failed to accept proposal:', error);
        alert('Error al aceptar la propuesta');
      } finally {
        setAcceptingProposal(null);
      }
    },
    [selectedOrder, fetchScheduledOrders],
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
        <div className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl glass p-4">
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
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              <Calendar className="h-5 w-5 inline" /> Pedidos Programados
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Info Banner */}
        <motion.div
          className="mb-6 rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-medium text-surface-800 dark:text-surface-200">
                ¿Cómo funciona?
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                Los pedidos programados muestran propuestas de repartidores. Tú eliges al que mejor
                se adapte a tus necesidades — no compiten por precio, sino por servicio.
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
              <Calendar className="h-16 w-16" />
            </motion.div>
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-2">
              No hay pedidos programados
            </h3>
            <p className="text-surface-500 dark:text-surface-400 mb-6">
              Crea un pedido programado y los repartidores enviarán propuestas
            </p>
            <Link href="/orders/new">
              <AnimatedButton variant="gradient">➕ Crear Pedido Programado</AnimatedButton>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {scheduledOrders.map((order, orderIndex) => (
              <ScrollReveal key={order.id} index={orderIndex} as="div">
                <motion.div
                  className="rounded-2xl glass p-4 cursor-pointer"
                  whileHover={{ y: -2, boxShadow: '0 12px 32px -8px rgba(34, 197, 94, 0.25)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectOrder(order)}
                >
                  <div className="flex gap-4">
                    {/* Schedule Icon */}
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gold-100 dark:bg-gold-900/30 text-3xl flex-shrink-0">
                      <Calendar className="h-8 w-8" />
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
                            <Calendar className="h-4 w-4 inline" />{' '}
                            {new Date(order.scheduledDate).toLocaleDateString('es-CR', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                            {order.scheduledTime && ` • ${order.scheduledTime}`}
                          </span>
                        )}

                        {/* Status Badge */}
                        <span className="px-3 py-1 rounded-full bg-gold-100 dark:bg-gold-900/50 text-xs font-medium text-gold-700 dark:text-gold-400">
                          <Clock className="h-4 w-4 inline" /> Esperando propuestas
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        )}
      </main>

      {/* Proposals Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setSelectedOrder(null);
                setProposals([]);
              }}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Handle */}
              <div className="sticky top-0 bg-white dark:bg-surface-800 pt-4 pb-2 px-6 border-b border-surface-100 dark:border-surface-700 rounded-t-3xl sm:rounded-t-3xl z-10">
                <div className="w-12 h-1 bg-surface-300 dark:bg-surface-600 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                    <ClipboardList className="h-5 w-5 inline" /> Propuestas
                  </h2>
                  <motion.button
                    onClick={() => {
                      setSelectedOrder(null);
                      setProposals([]);
                    }}
                    className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    ✕
                  </motion.button>
                </div>
              </div>

              <div className="p-6">
                {/* Order Summary */}
                <div className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4 mb-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500 dark:text-surface-400">
                        <MapPin className="h-4 w-4 inline" /> Recoger:
                      </span>
                      <span className="font-medium text-surface-800 dark:text-surface-200 text-right max-w-[60%]">
                        {selectedOrder.pickupAddress}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500 dark:text-surface-400">
                        <Home className="h-4 w-4 inline" /> Entregar:
                      </span>
                      <span className="font-medium text-surface-800 dark:text-surface-200 text-right max-w-[60%]">
                        {selectedOrder.deliveryAddress}
                      </span>
                    </div>
                    {selectedOrder.scheduledDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-surface-500 dark:text-surface-400">
                          <Calendar className="h-4 w-4 inline" /> Fecha:
                        </span>
                        <span className="font-medium text-gold-600 dark:text-gold-400">
                          {new Date(selectedOrder.scheduledDate).toLocaleDateString('es-CR', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })}
                          {selectedOrder.scheduledTime && ` a las ${selectedOrder.scheduledTime}`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500 dark:text-surface-400">
                        <Coins className="h-4 w-4 inline" /> Total:
                      </span>
                      <span className="font-bold text-kiwi-600 dark:text-kiwi-400">
                        ₡{Number(selectedOrder.totalAmount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Proposals */}
                <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                  Propuestas de repartidores
                </h3>

                {loadingProposals ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="flex-1">
                            <Skeleton className="h-5 w-32 mb-2" />
                            <Skeleton className="h-4 w-48" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : proposals.length === 0 ? (
                  <div className="text-center py-8">
                    <motion.div
                      className="text-4xl mb-3"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Clock className="h-10 w-10" />
                    </motion.div>
                    <p className="text-surface-500 dark:text-surface-400">
                      Esperando propuestas de repartidores...
                    </p>
                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                      Los repartidores verán tu pedido y enviarán propuestas
                    </p>
                  </div>
                ) : (
                  <StaggerContainer className="space-y-3">
                    {proposals.map((proposal) => (
                      <StaggerItem key={proposal.id}>
                        <motion.div
                          className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 p-4"
                          whileHover={{ y: -2 }}
                        >
                          <div className="flex items-start gap-4">
                            {/* Driver Avatar */}
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-kiwi-gradient text-white font-bold text-lg flex-shrink-0">
                              {proposal.driver?.fullName?.charAt(0) || 'D'}
                            </div>

                            {/* Driver Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-surface-800 dark:text-surface-100">
                                  {proposal.driver?.fullName || 'Repartidor'}
                                </h4>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm">
                                    <Star className="h-4 w-4" />
                                  </span>
                                  <span className="text-sm font-medium text-surface-600 dark:text-surface-400">
                                    {proposal.driver?.rating?.toFixed(1) || '5.0'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mt-1">
                                <VehicleBadge
                                  type={proposal.driver?.vehicleType || 'motorcycle'}
                                  size="sm"
                                />
                                <span className="text-xs text-surface-400">
                                  {proposal.driver?.totalTrips || 0} viajes
                                </span>
                              </div>

                              {/* Estimated Arrival */}
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-sm font-medium text-kiwi-600 dark:text-kiwi-400">
                                  <Clock className="h-4 w-4 inline" /> Llega en:{' '}
                                  {proposal.estimatedArrival || 'No especificado'}
                                </span>
                              </div>

                              {/* Message */}
                              {proposal.message && (
                                <p className="mt-2 text-sm text-surface-500 dark:text-surface-400 italic">
                                  "{proposal.message}"
                                </p>
                              )}

                              {/* Accept Button */}
                              <motion.button
                                className="mt-3 w-full rounded-xl bg-kiwi-500 py-2.5 text-sm font-semibold text-white shadow-kiwi hover:bg-kiwi-600 transition-colors"
                                onClick={() => handleAcceptProposal(proposal.id)}
                                disabled={acceptingProposal === proposal.id}
                                whileTap={{ scale: 0.98 }}
                              >
                                {acceptingProposal === proposal.id ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <motion.span
                                      animate={{ rotate: 360 }}
                                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                      <Clock className="h-4 w-4" />
                                    </motion.span>
                                    Aceptando...
                                  </span>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4 inline" /> Elegir a{' '}
                                    {proposal.driver?.fullName || 'este repartidor'}
                                  </>
                                )}
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
