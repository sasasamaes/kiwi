'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AnimatedButton, TrackingMap, Skeleton, useSocket, api, Order } from '@kiwi/ui';
import { ArrowLeft, Clock, Check, Bike, Package, Rocket, PartyPopper, X, Star } from 'lucide-react';

type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'in_transit_to_pickup'
  | 'picked_up'
  | 'in_transit_to_delivery'
  | 'delivered'
  | 'cancelled';

const statusConfig: Record<OrderStatus, { label: string; description: string; progress: number }> =
  {
    pending: { label: 'Pendiente', description: 'Esperando repartidor', progress: 10 },
    assigned: { label: 'Asignado', description: 'Repartidor asignado', progress: 20 },
    in_transit_to_pickup: {
      label: 'En camino a recoger',
      description: 'El repartidor va al comercio',
      progress: 40,
    },
    picked_up: {
      label: 'Recogido',
      description: 'El repartidor recogio tu pedido',
      progress: 60,
    },
    in_transit_to_delivery: {
      label: 'En camino',
      description: 'Tu pedido va en camino',
      progress: 80,
    },
    delivered: {
      label: 'Entregado',
      description: 'Recibiste tu pedido!',
      progress: 100,
    },
    cancelled: {
      label: 'Cancelado',
      description: 'El pedido fue cancelado',
      progress: 0,
    },
  };

const fallbackConfig = {
  label: 'Actualizando',
  description: 'Sincronizando estado…',
  progress: 0,
};

function StatusIcon({ status }: { status: string }) {
  const iconClass = 'h-5 w-5';
  switch (status) {
    case 'pending':
      return <Clock className={iconClass} />;
    case 'assigned':
      return <Check className={iconClass} />;
    case 'in_transit_to_pickup':
      return <Bike className={iconClass} />;
    case 'picked_up':
      return <Package className={iconClass} />;
    case 'in_transit_to_delivery':
      return <Rocket className={iconClass} />;
    case 'delivered':
      return <PartyPopper className={iconClass} />;
    case 'cancelled':
      return <X className={iconClass} />;
    default:
      return <Clock className={iconClass} />;
  }
}

export default function TrackingPage() {
  const params = useParams();
  const orderId = (params.id as string) ?? '';

  const [order, setOrder] = useState<Order | null>(null);
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [statusHistory, setStatusHistory] = useState<
    { status: string; timestamp: Date; message: string }[]
  >([]);

  const { isConnected, on, emit } = useSocket({
    onConnect: () => {
      emit('order:track', { orderId });
    },
  });

  const fetchOrder = useCallback(
    async (silent = false) => {
      if (!orderId) {
        setError('Pedido no encontrado');
        setLoading(false);
        return;
      }
      try {
        if (!silent) setLoading(true);
        // Invitado con link: endpoint público. Logueado: vista completa.
        const data = api.getToken()
          ? await api.getOrderById(orderId)
          : await api.getPublicTracking(orderId);
        setOrder(data);
        setCurrentStatus(data.status as OrderStatus);
        setError(null);
      } catch {
        if (!silent) setError('No se pudo cargar el pedido');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId],
  );

  const driverId = (order as any)?.driverId ?? (order as any)?.driver?.id;

  const fetchLocation = useCallback(async () => {
    if (!orderId) return;
    try {
      const loc = api.getToken()
        ? driverId
          ? await api.getDriverLocation(driverId).catch(() => null)
          : null
        : await api.getPublicDriverLocation(orderId).catch(() => null);
      if (loc && loc.known !== false && !loc.isStale && Number.isFinite(Number(loc.lat))) {
        setDriverLocation({ lat: Number(loc.lat), lng: Number(loc.lng) });
      }
    } catch {
      // Sin ubicación: el mapa muestra pickup/delivery igual.
    }
  }, [orderId, driverId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Invitados sin socket: polling honesto cada 15s en vez de "en vivo".
  useEffect(() => {
    if (isConnected || !orderId) return;
    const interval = setInterval(() => {
      fetchOrder(true);
      fetchLocation();
    }, 15000);
    return () => clearInterval(interval);
  }, [isConnected, orderId, fetchOrder, fetchLocation]);

  useEffect(() => {
    if (driverId) fetchLocation();
  }, [driverId, fetchLocation]);

  useEffect(() => {
    const cleanup = on('order:statusChanged', (data: any) => {
      if (data.orderId === orderId) {
        setCurrentStatus(data.status as OrderStatus);
        setStatusHistory((prev) => [
          { status: data.status, timestamp: new Date(), message: data.message },
          ...prev,
        ]);
        if (data.status === 'in_transit_to_delivery') setEta(15);
        else if (data.status === 'picked_up') setEta(25);
        else if (data.status === 'delivered') setEta(0);
      }
    });
    return cleanup;
  }, [on, orderId]);

  useEffect(() => {
    const cleanup = on('driver:location', (data: any) => {
      if (data.orderId === orderId) {
        setDriverLocation({ lat: data.lat, lng: data.lng });
      }
    });
    return cleanup;
  }, [on, orderId]);

  useEffect(() => {
    if (eta === null || eta <= 0) return;
    const interval = setInterval(() => {
      setEta((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 60000);
    return () => clearInterval(interval);
  }, [eta]);

  const config = statusConfig[currentStatus] ?? fallbackConfig;

  const driver = (order as any)?.driver ?? null;
  const vehicleLabels: Record<string, string> = {
    motorcycle: 'Moto',
    motorized_bike: 'Bici con motor',
    bicycle: 'Bicicleta',
    car: 'Carro',
    truck: 'Camión',
  };

  // API may include real coords; fall back to Nicoya center when absent.
  const numOr = (v: unknown, fb: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  const pickup = {
    lat: numOr((order as any)?.pickupLat, 10.1483),
    lng: numOr((order as any)?.pickupLng, -85.4527),
  };
  const delivery = {
    lat: numOr((order as any)?.deliveryLat, 10.1583),
    lng: numOr((order as any)?.deliveryLng, -85.4627),
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
        <div className="pt-safe sticky top-0 z-40 glass-strong">
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
          <X className="h-16 w-16 text-surface-300 mx-auto mb-4" />
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
      <motion.header
        className="pt-safe sticky top-0 z-40 glass-strong"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400"
            >
              <ArrowLeft className="h-4 w-4" />
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
        <motion.div
          className="rounded-2xl overflow-hidden mb-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <TrackingMap
            pickup={pickup}
            delivery={delivery}
            driverLocation={driverLocation || undefined}
            height={300}
            showRoute={true}
            showTraffic={true}
          />
        </motion.div>

        <motion.div
          className={`mb-4 px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 ${
            isConnected
              ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'}`}
          />
          {isConnected ? 'En vivo' : 'Se actualiza solo'}
        </motion.div>

        <motion.div
          className="rounded-2xl glass p-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-600">
              <StatusIcon status={currentStatus} />
            </div>
            <div>
              <h2 className="text-xl font-display font-semibold text-surface-800 dark:text-surface-100">
                {config.label}
              </h2>
              <p className="text-surface-500 dark:text-surface-400">{config.description}</p>
            </div>
          </div>

          <div className="relative h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-kiwi-400 to-kiwi-600"
              initial={{ width: 0 }}
              animate={{ width: `${config.progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>

          {eta !== null && eta > 0 && currentStatus !== 'delivered' && (
            <motion.div
              className="mt-4 flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Clock className="h-4 w-4 text-surface-400" />
              <span className="text-sm text-surface-500 dark:text-surface-400">
                Tiempo estimado:
              </span>
              <span className="text-lg font-bold text-kiwi-600 dark:text-kiwi-400 font-mono">
                {eta} min
              </span>
            </motion.div>
          )}
        </motion.div>

        {driver && currentStatus !== 'pending' && currentStatus !== 'cancelled' && (
          <motion.div
            className="rounded-2xl glass p-4 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
              Tu repartidor
            </h3>
            <div className="flex items-center gap-3">
              {driver.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={driver.photoUrl}
                  alt={driver.fullName ?? 'Repartidor'}
                  className="h-14 w-14 rounded-full object-cover bg-surface-100 dark:bg-surface-700"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-kiwi-100 dark:bg-kiwi-900/30 text-xl font-bold text-kiwi-600 dark:text-kiwi-400">
                  {(driver.fullName ?? '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-surface-800 dark:text-surface-100 truncate">
                  {driver.fullName ?? 'Repartidor'}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-surface-500 dark:text-surface-400">
                  {driver.rating != null && (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      {Number(driver.rating).toFixed(1)}
                    </span>
                  )}
                  {driver.vehicleType && (
                    <span>{vehicleLabels[driver.vehicleType] ?? driver.vehicleType}</span>
                  )}
                  {driver.vehiclePlate && (
                    <span className="rounded-md bg-surface-100 dark:bg-surface-700 px-2 py-0.5 font-mono text-xs font-semibold text-surface-700 dark:text-surface-200">
                      {driver.vehiclePlate}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

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
              <span className="text-surface-700 dark:text-surface-200 font-medium font-mono">
                #{(orderId || '').slice(0, 8) || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500 dark:text-surface-400">Estado</span>
              <span className="text-surface-700 dark:text-surface-200">{config.label}</span>
            </div>
            {Array.isArray((order as any).items) && (order as any).items.length > 0 && (
              <div className="pt-2 space-y-1">
                {(order as any).items.map((it: any, i: number) => (
                  <div key={it.id ?? i} className="flex justify-between text-sm">
                    <span className="text-surface-600 dark:text-surface-400">
                      {it.quantity}x {it.name}
                      {Array.isArray(it.selectedVariants) && it.selectedVariants.length > 0 && (
                        <> ({it.selectedVariants.map((v: any) => v.option).join(', ')})</>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {(order as any).totalAmount ? (
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Total</span>
                <span className="text-surface-700 dark:text-surface-200 font-semibold font-mono">
                  {Number((order as any).totalAmount).toLocaleString()}
                </span>
              </div>
            ) : null}
          </div>
        </motion.div>

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

        <div className="flex gap-3">
          <Link href="/" className="flex-1">
            <AnimatedButton variant="secondary" className="w-full">
              Volver al inicio
            </AnimatedButton>
          </Link>
          {currentStatus === 'delivered' && (
            <Link href={`/order/${orderId}/rate`} className="flex-1">
              <AnimatedButton className="w-full">Calificar</AnimatedButton>
            </Link>
          )}
        </div>
      </main>
    </main>
  );
}
