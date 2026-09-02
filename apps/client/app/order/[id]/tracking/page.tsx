'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AnimatedButton, 
  Skeleton,
  useSocket,
  api,
  Order,
  VehicleBadge
} from '@kiwi/ui';

interface OrderWithDetails extends Order {
  merchant?: {
    businessName: string;
    address: string;
  };
  driver?: {
    id: string;
    fullName: string;
    vehicleType: string;
    rating: number;
    phone?: string;
  };
  items?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
}

const STATUS_STEPS = [
  { key: 'pending', label: 'Pedido creado', icon: '📦', description: 'Tu pedido fue recibido' },
  { key: 'assigned', label: 'Repartidor asignado', icon: '🛵', description: 'Un repartidor tomó tu pedido' },
  { key: 'in_transit_to_pickup', label: 'Recogiendo', icon: '🏃', description: 'El repartidor va a recoger tu pedido' },
  { key: 'picked_up', label: 'Pedido recogido', icon: '✅', description: 'Tu pedido fue recogido' },
  { key: 'in_transit_to_delivery', label: 'En camino', icon: '🚀', description: 'Tu pedido va camino a ti' },
  { key: 'delivered', label: 'Entregado', icon: '🎉', description: '¡Tu pedido fue entregado!' },
];

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Socket for real-time updates
  const { isConnected, on } = useSocket({
    onConnect: () => console.log('🟢 Connected for order tracking'),
  });

  // Fetch order details
  const fetchOrder = useCallback(async () => {
    try {
      const data = await api.getOrderById(orderId);
      setOrder(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch order:', err);
      setError(err instanceof Error ? err.message : 'No se pudo cargar el pedido');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Listen for real-time status updates
  useEffect(() => {
    const cleanup = on('order:statusChanged', (data: any) => {
      if (data.orderId === orderId) {
        console.log('🔄 Order status changed:', data);
        fetchOrder();
      }
    });

    return cleanup;
  }, [on, orderId, fetchOrder]);

  // Update time every minute for ETA calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate current step index
  const currentStepIndex = order
    ? STATUS_STEPS.findIndex(step => step.key === order.status)
    : -1;

  // Calculate time elapsed since order creation
  const getTimeElapsed = () => {
    if (!order) return '';
    const created = new Date(order.createdAt);
    const diff = Math.floor((currentTime.getTime() - created.getTime()) / 1000 / 60);
    if (diff < 1) return 'Hace menos de 1 min';
    if (diff === 1) return 'Hace 1 min';
    return `Hace ${diff} min`;
  };

  // Get estimated delivery time
  const getEstimatedTime = () => {
    if (!order) return '';
    const created = new Date(order.createdAt);
    // Assume 25-35 min delivery time
    const estimated = new Date(created.getTime() + 30 * 60 * 1000);
    return estimated.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-bg-light dark:bg-surface-950">
        <div className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <motion.div 
          className="text-center px-4"
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
            No pudimos cargar el pedido
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mb-6">
            {error || 'Pedido no encontrado'}
          </p>
          <div className="flex gap-3 justify-center">
            <AnimatedButton variant="secondary" onClick={() => router.push('/')}>← Volver</AnimatedButton>
            <AnimatedButton variant="gradient" onClick={fetchOrder}>🔄 Reintentar</AnimatedButton>
          </div>
        </motion.div>
      </main>
    );
  }

  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';

  return (
    <main className="min-h-screen bg-bg-light dark:bg-surface-950 pb-8">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200">
              <span>←</span>
              <span className="text-sm font-medium">Inicio</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">📍 Tracking</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Status Hero */}
        <motion.div 
          className={`mb-6 rounded-3xl p-6 text-white shadow-kiwi-lg overflow-hidden relative ${
            isDelivered ? 'bg-gradient-to-br from-green-500 to-green-600' :
            isCancelled ? 'bg-gradient-to-br from-red-500 to-red-600' :
            'bg-kiwi-gradient'
          }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Background decoration */}
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/80 text-sm">Pedido #{order.id.slice(0, 8)}</p>
                <h2 className="text-2xl font-display font-bold mt-1">
                  {isDelivered ? '🎉 Entregado' :
                   isCancelled ? '❌ Cancelado' :
                   STATUS_STEPS[currentStepIndex]?.icon || '📦'} {' '}
                  {isDelivered ? '' :
                   isCancelled ? '' :
                   STATUS_STEPS[currentStepIndex]?.label || 'Procesando'}
                </h2>
              </div>
              <motion.div 
                className="text-5xl"
                animate={isDelivered ? { rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: isDelivered ? Infinity : 0, repeatDelay: 2 }}
              >
                {isDelivered ? '🎉' : isCancelled ? '❌' : STATUS_STEPS[currentStepIndex]?.icon || '📦'}
              </motion.div>
            </div>

            {!isDelivered && !isCancelled && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <motion.span 
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ●
                  </motion.span>
                  <span>{STATUS_STEPS[currentStepIndex]?.description || 'Procesando tu pedido'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">{getTimeElapsed()}</span>
                  <span className="text-white/70">ETA: {getEstimatedTime()}</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Status Timeline */}
        <motion.div 
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            📊 Estado del Pedido
          </h3>

          <div className="space-y-0">
            {STATUS_STEPS.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isFuture = index > currentStepIndex;

              return (
                <motion.div 
                  key={step.key}
                  className="flex gap-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {/* Timeline line + dot */}
                  <div className="flex flex-col items-center">
                    <motion.div 
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                        isCompleted 
                          ? 'bg-kiwi-500 text-white' 
                          : isCurrent
                            ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-600 ring-2 ring-kiwi-500'
                            : 'bg-surface-100 dark:bg-surface-700 text-surface-400'
                      }`}
                      animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {isCompleted && !isCurrent ? '✓' : step.icon}
                    </motion.div>
                    {index < STATUS_STEPS.length - 1 && (
                      <div className={`w-0.5 h-8 ${
                        isCompleted ? 'bg-kiwi-500' : 'bg-surface-200 dark:bg-surface-700'
                      }`} />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 pb-8">
                    <p className={`font-medium ${
                      isCompleted 
                        ? 'text-surface-800 dark:text-surface-100' 
                        : 'text-surface-400 dark:text-surface-500'
                    }`}>
                      {step.label}
                    </p>
                    <p className={`text-sm ${
                      isCompleted 
                        ? 'text-surface-500 dark:text-surface-400' 
                        : 'text-surface-300 dark:text-surface-600'
                    }`}>
                      {step.description}
                    </p>
                    {isCurrent && (
                      <motion.div
                        className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400 text-xs font-medium"
                        animate={{ opacity: [1, 0.7, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        ● En curso
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Driver Info */}
        {order.driver && (
          <motion.div 
            className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              🛵 Tu Repartidor
            </h3>

            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-kiwi-gradient text-white font-bold text-xl">
                {order.driver.fullName?.charAt(0) || 'D'}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-surface-800 dark:text-surface-100">
                    {order.driver.fullName}
                  </h4>
                  <div className="flex items-center gap-1">
                    <span className="text-sm">⭐</span>
                    <span className="text-sm font-medium text-surface-600 dark:text-surface-400">
                      {order.driver.rating?.toFixed(1) || '5.0'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <VehicleBadge type={order.driver.vehicleType || 'motorcycle'} size="sm" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Order Details */}
        <motion.div 
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            📦 Detalles del Pedido
          </h3>

          <div className="space-y-3">
            {/* Addresses */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-600 flex-shrink-0 mt-0.5">
                  <span className="text-xs">📍</span>
                </div>
                <div>
                  <p className="text-xs text-surface-400">Recoger en</p>
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                    {order.pickupAddress}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 dark:bg-gold-900/50 text-gold-600 flex-shrink-0 mt-0.5">
                  <span className="text-xs">🏠</span>
                </div>
                <div>
                  <p className="text-xs text-surface-400">Entregar en</p>
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                    {order.deliveryAddress}
                  </p>
                </div>
              </div>
            </div>

            {/* Items */}
            {order.items && order.items.length > 0 && (
              <div className="border-t border-surface-100 dark:border-surface-700 pt-3">
                <p className="text-xs text-surface-400 mb-2">Productos</p>
                <div className="space-y-2">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-surface-600 dark:text-surface-400">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="text-surface-800 dark:text-surface-200">
                        ₡{(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total */}
            <div className="border-t border-surface-100 dark:border-surface-700 pt-3">
              <div className="flex justify-between">
                <span className="font-semibold text-surface-800 dark:text-surface-200">Total</span>
                <span className="text-lg font-bold text-kiwi-600 dark:text-kiwi-400">
                  ₡{Number(order.totalAmount).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {isDelivered && (
            <Link href="/">
              <AnimatedButton variant="gradient" className="w-full">
                🏠 Volver al inicio
              </AnimatedButton>
            </Link>
          )}

          {!isDelivered && !isCancelled && order.driver?.phone && (
            <AnimatedButton 
              variant="secondary" 
              className="w-full"
              onClick={() => window.open(`tel:${order.driver.phone}`)}
            >
              📞 Llamar al repartidor
            </AnimatedButton>
          )}

          {!isDelivered && !isCancelled && (
            <AnimatedButton 
              variant="ghost" 
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={async () => {
                if (confirm('¿Estás seguro de cancelar el pedido?')) {
                  try {
                    await api.updateOrderStatus(orderId, 'cancelled');
                    fetchOrder();
                  } catch (error) {
                    alert('No se pudo cancelar el pedido');
                  }
                }
              }}
            >
              ❌ Cancelar pedido
            </AnimatedButton>
          )}
        </div>
      </div>
    </main>
  );
}
