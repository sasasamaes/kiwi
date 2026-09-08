'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './api-client';

interface RouteStop {
  location: {
    lat: number;
    lng: number;
    name?: string;
    address?: string;
  };
  type: 'pickup' | 'delivery';
  orderId?: string;
  estimatedArrival?: Date;
  waitTime?: number;
}

interface OptimizedRoute {
  stops: RouteStop[];
  totalDistance: number;
  totalDuration: number;
  legs: Array<{
    distance: number;
    duration: number;
    startLocation: any;
    endLocation: any;
  }>;
}

interface ActiveOrder {
  id: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  merchant?: {
    businessName: string;
    latitude?: number;
    longitude?: number;
  };
  totalAmount: number;
  status: string;
}

export interface RouteOptimizerProps {
  driverLocation: { lat: number; lng: number };
  activeOrders: ActiveOrder[];
  onRouteCalculated?: (route: OptimizedRoute) => void;
  onNavigateToStop?: (stop: RouteStop) => void;
  className?: string;
}

export function RouteOptimizer({
  driverLocation,
  activeOrders,
  onRouteCalculated,
  onNavigateToStop,
  className = '',
}: RouteOptimizerProps) {
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate optimized route when orders change
  useEffect(() => {
    if (activeOrders.length === 0) {
      setRoute(null);
      return;
    }

    calculateRoute();
  }, [activeOrders, driverLocation]);

  const calculateRoute = async () => {
    if (activeOrders.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Prepare orders for optimization
      const orders = activeOrders.map((order) => ({
        orderId: order.id,
        pickup: {
          lat: order.pickupLat || order.merchant?.latitude || 10.1483,
          lng: order.pickupLng || order.merchant?.longitude || -85.4527,
        },
        delivery: {
          lat: order.deliveryLat || 10.15,
          lng: order.deliveryLng || -85.45,
        },
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        merchantName: order.merchant?.businessName || 'Comercio',
      }));

      const optimizedRoute = await api.optimizeRoute({
        startLocation: driverLocation,
        orders,
      });

      setRoute(optimizedRoute);
      onRouteCalculated?.(optimizedRoute);
    } catch (err) {
      console.error('Route optimization failed:', err);
      setError('No se pudo calcular la ruta');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}min`;
  };

  const formatDistance = (km: number) => {
    return `${km.toFixed(1)} km`;
  };

  const formatArrivalTime = (date?: Date) => {
    if (!date) return '--:--';
    return new Date(date).toLocaleTimeString('es-CR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStopIcon = (type: string, index: number) => {
    if (type === 'pickup') return '🏪';
    return 'home';
  };

  const getStopColor = (type: string) => {
    if (type === 'pickup') return 'bg-kiwi-500';
    return 'bg-yellow-500';
  };

  if (activeOrders.length === 0) {
    return (
      <div className={`rounded-2xl glass p-4 ${className}`}>
        <div className="text-center py-4">
          <span className="text-3xl block mb-2">Package</span>
          <p className="text-sm text-surface-500 dark:text-surface-400">No hay pedidos activos</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl glass p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
          Map Ruta Optimizada
        </h3>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-xs font-medium text-kiwi-700 dark:text-kiwi-400">
            {activeOrders.length} pedidos
          </span>
          <button
            onClick={calculateRoute}
            disabled={loading}
            className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
          >
            <motion.span
              animate={loading ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: 'linear' }}
              className="block"
            >
              RefreshCw
            </motion.span>
          </button>
        </div>
      </div>

      {/* Route Summary */}
      {route && (
        <motion.div
          className="grid grid-cols-2 gap-3 mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="p-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30">
            <p className="text-xs text-kiwi-600 dark:text-kiwi-400">Distancia Total</p>
            <p className="text-lg font-bold text-kiwi-700 dark:text-kiwi-300">
              {formatDistance(route.totalDistance)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30">
            <p className="text-xs text-blue-600 dark:text-blue-400">Tiempo Estimado</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {formatDuration(route.totalDuration)}
            </p>
          </div>
        </motion.div>
      )}

      {/* Route Stops */}
      <div className="space-y-0">
        {/* Start Point */}
        <div className="flex items-center gap-3 pb-3">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white text-sm font-bold">
              Bike
            </div>
            <div className="w-0.5 h-6 bg-surface-200 dark:bg-surface-700" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
              Tu ubicación actual
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">Punto de inicio</p>
          </div>
        </div>

        {/* Route Stops */}
        <AnimatePresence>
          {route?.stops.map((stop, index) => {
            const isLast = index === route.stops.length - 1;
            const order = activeOrders.find((o) => o.id === stop.orderId);

            return (
              <motion.div
                key={`${stop.orderId}-${stop.type}-${index}`}
                className="flex items-center gap-3 pb-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${getStopColor(stop.type)} text-white text-sm`}
                  >
                    {index + 1}
                  </div>
                  {!isLast && <div className="w-0.5 h-6 bg-surface-200 dark:bg-surface-700" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getStopIcon(stop.type, index)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">
                        {stop.type === 'pickup'
                          ? order?.merchant?.businessName || 'Recoger'
                          : 'Entregar'}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                        {stop.type === 'pickup' ? order?.pickupAddress : order?.deliveryAddress}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-surface-400 dark:text-surface-500">
                      ⏱️ {formatArrivalTime(stop.estimatedArrival)}
                    </span>
                    {route.legs[index] && (
                      <span className="text-xs text-surface-400 dark:text-surface-500">
                        {formatDistance(route.legs[index].distance)} •{' '}
                        {formatDuration(route.legs[index].duration)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onNavigateToStop?.(stop)}
                  className="flex-shrink-0 p-2 rounded-lg bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-600 dark:text-kiwi-400 hover:bg-kiwi-200 dark:hover:bg-kiwi-900/70 transition-colors"
                >
                  🧭
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* End Point */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white text-sm">
            ✓
          </div>
          <div>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
              Ruta completada
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {route ? formatDuration(route.totalDuration) : '--'} •{' '}
              {route ? formatDistance(route.totalDistance) : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <motion.div
          className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={calculateRoute}
            className="mt-2 text-sm font-medium text-red-700 dark:text-red-300 underline"
          >
            Reintentar
          </button>
        </motion.div>
      )}
    </div>
  );
}

export default RouteOptimizer;
