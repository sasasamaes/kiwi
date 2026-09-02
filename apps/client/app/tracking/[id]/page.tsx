'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedButton } from '@kiwi/ui';

type OrderStatus = 'confirmed' | 'preparing' | 'picked_up' | 'delivering' | 'delivered';

const statusConfig: Record<OrderStatus, { label: string; icon: string; description: string; progress: number }> = {
  confirmed: { label: 'Confirmado', icon: '✅', description: 'El restaurante recibió tu pedido', progress: 20 },
  preparing: { label: 'Preparando', icon: '👨‍🍳', description: 'Están preparando tu comida', progress: 40 },
  picked_up: { label: 'Recogido', icon: '📦', description: 'El repartidor recogió tu pedido', progress: 60 },
  delivering: { label: 'En camino', icon: '🛵', description: 'Tu pedido va en camino', progress: 80 },
  delivered: { label: 'Entregado', icon: '🎉', description: '¡Recibiste tu pedido!', progress: 100 },
};

export default function TrackingPage({ params }: { params: { id: string } }) {
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>('confirmed');
  const [eta, setEta] = useState(25);

  // Simulate order progress
  useEffect(() => {
    const statuses: OrderStatus[] = ['confirmed', 'preparing', 'picked_up', 'delivering', 'delivered'];
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < statuses.length - 1) {
        currentIndex++;
        setCurrentStatus(statuses[currentIndex]);
        setEta(prev => Math.max(0, prev - 5));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const config = statusConfig[currentStatus];

  return (
    <main className="min-h-screen bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">Rastrear Pedido</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Order Status Card */}
        <motion.div 
          className="mb-6 rounded-2xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg overflow-hidden relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div 
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/80 text-sm">Pedido #KIWI-1234</p>
                <motion.h2 
                  className="text-2xl font-bold"
                  key={currentStatus}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {config.label}
                </motion.h2>
              </div>
              <motion.div 
                className="text-5xl"
                key={currentStatus}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                {config.icon}
              </motion.div>
            </div>
            
            <p className="text-white/80 mb-4">{config.description}</p>
            
            {/* Progress Bar */}
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                className="h-2 bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${config.progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            
            {currentStatus !== 'delivered' && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-white/80">Tiempo estimado</span>
                <motion.span 
                  className="text-2xl font-bold"
                  key={eta}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                >
                  {eta} min
                </motion.span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Status Timeline */}
        <motion.div 
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            Estado del Pedido
          </h3>
          <div className="space-y-4">
            {Object.entries(statusConfig).map(([key, value], index) => {
              const statusKey = key as OrderStatus;
              const isCompleted = config.progress >= value.progress;
              const isCurrent = currentStatus === statusKey;
              
              return (
                <div key={key} className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    isCompleted 
                      ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-600 dark:text-kiwi-400' 
                      : 'bg-surface-100 dark:bg-surface-700 text-surface-400'
                  } ${isCurrent ? 'ring-2 ring-kiwi-500 ring-offset-2 dark:ring-offset-surface-800' : ''}`}>
                    <span className="text-lg">{value.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${
                      isCompleted ? 'text-surface-800 dark:text-surface-200' : 'text-surface-400'
                    }`}>
                      {value.label}
                    </p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">{value.description}</p>
                  </div>
                  {isCompleted && !isCurrent && (
                    <span className="text-kiwi-500">✓</span>
                  )}
                  {isCurrent && (
                    <motion.span 
                      className="text-kiwi-500"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      ●
                    </motion.span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Driver Info */}
        {(currentStatus === 'picked_up' || currentStatus === 'delivering') && (
          <motion.div 
            className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              🛵 Tu Repartidor
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-kiwi-gradient text-white font-bold text-xl">
                JC
              </div>
              <div className="flex-1">
                <p className="font-semibold text-surface-800 dark:text-surface-200">Juan Carlos</p>
                <p className="text-sm text-surface-500 dark:text-surface-400">⭐ 4.9 • 156 viajes</p>
              </div>
              <motion.button 
                className="flex h-12 w-12 items-center justify-center rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-600 dark:text-kiwi-400"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                📞
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Order Details */}
        <motion.div 
          className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            📋 Detalles del Pedido
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🥗</span>
              <div className="flex-1">
                <p className="font-medium text-surface-800 dark:text-surface-200">Bowl Tropikal</p>
                <p className="text-sm text-surface-500 dark:text-surface-400">x1</p>
              </div>
              <p className="font-semibold text-surface-800 dark:text-surface-200">₡4,500</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">☕</span>
              <div className="flex-1">
                <p className="font-medium text-surface-800 dark:text-surface-200">Latte</p>
                <p className="text-sm text-surface-500 dark:text-surface-400">x2</p>
              </div>
              <p className="font-semibold text-surface-800 dark:text-surface-200">₡3,600</p>
            </div>
            <div className="border-t border-surface-200 dark:border-surface-700 pt-3">
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Subtotal</span>
                <span className="text-surface-800 dark:text-surface-200">₡8,100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Envío</span>
                <span className="text-kiwi-600 dark:text-kiwi-400">Gratis</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="font-semibold text-surface-800 dark:text-surface-200">Total</span>
                <span className="text-xl font-bold text-surface-800 dark:text-surface-200">₡8,100</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Rate Order (when delivered) */}
        {currentStatus === 'delivered' && (
          <motion.div 
            className="mt-6 rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              ⭐ ¿Cómo fue tu experiencia?
            </h3>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  className="text-3xl"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ⭐
                </motion.button>
              ))}
            </div>
            <AnimatedButton variant="gradient" className="w-full">
              Enviar Calificación
            </AnimatedButton>
          </motion.div>
        )}
      </main>
    </main>
  );
}
