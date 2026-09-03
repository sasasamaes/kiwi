'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AnimatedButton, TrackingMap, Skeleton, useSocket, api, Order } from '@kiwi/ui';

type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'in_transit_to_pickup'
  | 'picked_up'
  | 'in_transit_to_delivery'
  | 'delivered'
  | 'cancelled';

const statusConfig: Record<
  OrderStatus,
  { label: string; icon: string; description: string; progress: number }
> = {
  pending: { label: 'Pendiente', icon: 'Clock', description: 'Esperando repartidor', progress: 10 },
  assigned: { label: 'Asignado', icon: 'Check', description: 'Repartidor asignado', progress: 20 },
  in_transit_to_pickup: {
    label: 'En camino a recoger',
    icon: 'Bike',
    description: 'El repartidor va al comercio',
    progress: 40,
  },
  picked_up: {
    label: 'Recogido',
    icon: 'Package',
    description: 'El repartidor recogió tu pedido',
    progress: 60,
  },
  in_transit_to_delivery: {
    label: 'En camino',
    icon: '🚀',
    description: 'Tu pedido va en camino',
    progress: 80,
  },
  delivered: {
    label: 'Entregado',
    icon: 'PartyPopper',
    description: '¡Recibiste tu pedido!',
    progress: 100,
  },
  cancelled: {
    label: 'Cancelado',
    icon: 'X',
    description: 'El pedido fue cancelado',
    progress: 0,
  },
};

export default function TrackingPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [statusHistory, setStatusHistory] = useState<
    { status: string; timestamp: Date; message: string }[]
  >([]);

  // Socket for real-time updates
  const { isConnected, on, emit } = useSocket({
    onConnect: () => {
      console.log('🟢 Connected for order tracking');
      // Join order room for updates
      emit('order:track', { orderId });
    },
  });

  // Fetch initial order data
  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getOrder(orderId);
      setOrder(data);
      setCurrentStatus(data.status as OrderStatus);
    } catch (err) {
      setError('No se pudo cargar el pedido');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Listen for real-time status changes
  useEffect(() => {
    const cleanup = on('order:statusChanged', (data: any) => {
      if (data.orderId === orderId) {
        setCurrentStatus(data.status as OrderStatus);
        setStatusHistory((prev) => [
          { status: data.status, timestamp: new Date(), message: data.message },
          ...prev,
        ]);

        // Update eta based on status
        if (data.status === 'in_transit_to_delivery') {
          setEta(15);
        } else if (data.status === 'picked_up') {
          setEta(25);
        } else if (data.status === 'delivered') {
          setEta(0);
        }
      }
    });

    return cleanup;
  }, [on, orderId]);

  // Listen for driver location updates
  useEffect(() => {
    const cleanup = on('driver:location', (data: any) => {
      if (data.orderId === orderId) {
        setDriverLocation({ lat: data.lat, lng: data.lng });
      }
    });

    return cleanup;
  }, [on, orderId]);

  // Listen for driver assignment
  useEffect(() => {
    const cleanup = on('order:assigned', (data: any) => {
      if (data.orderId === orderId) {
        setStatusHistory((prev) => [
          { status: 'assigned', timestamp: new Date(), message: data.message },
          ...prev,
        ]);
      }
    });

    return cleanup;
  }, [on, orderId]);

  // Countdown timer for ETA
  useEffect(() => {
    if (eta === null || eta <= 0) return;

    const interval = setInterval(() => {
      setEta((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [eta]);

  const config = statusConfig[currentStatus];

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
        <div className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">X</span>
          <h2 className="text-xl font-semibold text-surface-800 dark:text-surface-100 mb-2">
            {error || 'Pedido no encontrado'}
          </h2>
          <Link href="/">
            <AnimatedButton>Volver al inicio</AnimatedButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400"
            >
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Rastrear Pedido
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Live Map */}
        <motion.div
          className="rounded-2xl overflow-hidden shadow-soft dark:shadow-dark mb-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <TrackingMap
            pickup={{ lat: 10.1483, lng: -85.4527 }}
            delivery={{ lat: 10.1583, lng: -85.4627 }}
            driverLocation={driverLocation || undefined}
            height={300}
            showRoute={true}
            showTraffic={true}
          />
        </motion.div>

        {/* Connection Status */}
        <motion.div
          className={`mb-4 px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 ${
            isConnected
              ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          {isConnected ? 'En vivo' : 'Sin conexión'}
        </motion.div>

        {/* Status Card */}
        <motion.div
          className="rounded-2xl glass p-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="text-4xl">{config.icon}</span>
            <div>
              <h2 className="text-xl font-display font-semibold text-surface-800 dark:text-surface-100">
                {config.label}
              </h2>
              <p className="text-surface-500 dark:text-surface-400">{config.description}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-kiwi-400 to-kiwi-600"
              initial={{ width: 0 }}
              animate={{ width: `${config.progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>

          {/* ETA */}
          {eta !== null && eta > 0 && currentStatus !== 'delivered' && (
            <motion.div
              className="mt-4 flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span className="text-sm text-surface-500 dark:text-surface-400">
                Tiempo estimado:
              </span>
              <span className="text-lg font-bold text-kiwi-600 dark:text-kiwi-400">{eta} min</span>
            </motion.div>
          )}
        </motion.div>

        {/* Order Details */}
        <motion.div
          className="rounded-2xl glass p-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
            Detalles del pedido
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-500 dark:text-surface-400">Pedido</span>
              <span className="text-surface-700 dark:text-surface-200 font-medium">
                #{orderId.slice(0, 8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500 dark:text-surface-400">Estado</span>
              <span className="text-surface-700 dark:text-surface-200">{config.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500 dark:text-surface-400">Total</span>
              <span className="text-surface-700 dark:text-surface-200 font-semibold">
                ₡{Number(order.totalAmount || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Status History */}
        {statusHistory.length > 0 && (
          <motion.div
            className="rounded-2xl glass p-4 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">Historial</h3>
            <div className="space-y-3">
              {statusHistory.map((item, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-kiwi-500" />
                    {index < statusHistory.length - 1 && (
                      <div className="w-0.5 h-8 bg-surface-200 dark:bg-surface-700" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-200">
                      {item.message}
                    </p>
                    <p className="text-xs text-surface-400">
                      {new Date(item.timestamp).toLocaleTimeString('es-CR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link href="/" className="flex-1">
            <AnimatedButton variant="secondary" className="w-full">
              Volver al inicio
            </AnimatedButton>
          </Link>
          {currentStatus === 'delivered' && (
            <Link href={`/order/${orderId}/rate`} className="flex-1">
              <AnimatedButton className="w-full">Star Calificar</AnimatedButton>
            </Link>
          )}
        </div>
      </main>
    </main>
  );
}
