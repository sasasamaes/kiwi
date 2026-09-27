// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Bike, MapPin, Car, Check, Star, Phone, PartyPopper } from 'lucide-react';

interface OrderStatus {
  id: string;
  status: 'pending' | 'assigned' | 'pickup' | 'delivering' | 'delivered';
  driver?: {
    name: string;
    photo: string;
    location: { lat: number; lng: number };
  };
  eta?: number; // minutes
}

interface OrderTrackerProps {
  orderId: string;
  initialStatus?: OrderStatus['status'];
}

const statusConfig = {
  pending: { label: 'Esperando repartidor', icon: Clock, color: 'bg-gold-100 text-gold-700' },
  assigned: { label: 'Repartidor asignado', icon: Bike, color: 'bg-blue-100 text-blue-700' },
  pickup: { label: 'En camino a recoger', icon: MapPin, color: 'bg-kiwi-100 text-kiwi-700' },
  delivering: { label: 'En camino a entregar', icon: Car, color: 'bg-kiwi-700 text-white' },
  delivered: { label: 'Entregado', icon: Check, color: 'bg-green-100 text-green-700' },
};

export function OrderTracker({ orderId, initialStatus = 'pending' }: OrderTrackerProps) {
  const [status, setStatus] = useState<OrderStatus['status']>(initialStatus);
  const [eta, setEta] = useState(15);

  // Sync when the parent passes a new status (props are not state).
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  // Simulate status changes for demo
  useEffect(() => {
    const statuses: OrderStatus['status'][] = [
      'pending',
      'assigned',
      'pickup',
      'delivering',
      'delivered',
    ];
    let currentIndex = statuses.indexOf(initialStatus);

    const interval = setInterval(() => {
      if (currentIndex < statuses.length - 1) {
        currentIndex++;
        setStatus(statuses[currentIndex]);
        setEta((prev) => Math.max(0, prev - 5));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [initialStatus]);

  const config = statusConfig[status];
  const ConfigIcon = config.icon as any;

  return (
    <motion.div className="rounded-2xl bg-white p-4 shadow-soft" layout>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-surface-600">Pedido #{orderId}</span>
        <motion.span
          className={`rounded-full px-3 py-1 text-xs font-medium ${config.color}`}
          key={status}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {typeof ConfigIcon === 'string' ? (
            <span>{ConfigIcon}</span>
          ) : (
            <ConfigIcon className="h-4 w-4 inline" />
          )}{' '}
          {config.label}
        </motion.span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-surface-400 mb-2">
          <span>Inicio</span>
          <span>Entrega</span>
        </div>
        <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
          <motion.div
            className="h-full bg-kiwi-gradient rounded-full"
            initial={{ width: '0%' }}
            animate={{
              width:
                status === 'pending'
                  ? '10%'
                  : status === 'assigned'
                    ? '30%'
                    : status === 'pickup'
                      ? '50%'
                      : status === 'delivering'
                        ? '80%'
                        : '100%',
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ETA */}
      <AnimatePresence mode="wait">
        {status !== 'delivered' && eta > 0 && (
          <motion.div
            key={eta}
            className="flex items-center justify-center gap-2 rounded-xl bg-kiwi-50 p-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <motion.span
              className="text-lg"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ⏱️
            </motion.span>
            <span className="text-sm font-medium text-kiwi-700">
              Llegada estimada: {eta} minutos
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Driver Info */}
      {status !== 'pending' && (
        <motion.div
          className="mt-3 flex items-center gap-3 rounded-xl bg-surface-50 p-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <div className="h-10 w-10 rounded-full bg-kiwi-100 flex items-center justify-center text-kiwi-700 font-semibold">
            JC
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-800">Juan Carlos</p>
            <p className="text-xs text-surface-400">
              <Star className="h-4 w-4 inline" /> 4.9 • 156 viajes
            </p>
          </div>
          <motion.button
            className="rounded-full bg-kiwi-100 p-2 text-kiwi-700 hover:bg-kiwi-200"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Phone className="h-5 w-5" />
          </motion.button>
        </motion.div>
      )}

      {/* Delivered State */}
      <AnimatePresence>
        {status === 'delivered' && (
          <motion.div
            className="mt-3 rounded-xl bg-green-50 p-4 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <motion.span
              className="text-4xl"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5 }}
            >
              <PartyPopper className="h-10 w-10" />
            </motion.span>
            <p className="mt-2 font-medium text-green-700">¡Pedido entregado con éxito!</p>
            <p className="text-sm text-green-600">Gracias por usar Kiwi</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
