// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AnimatedButton, TrackingMap, Skeleton, useSocket, api, Order } from '@kiwi/ui';
import { ArrowLeft, Clock, Check, Bike, Package, Rocket, PartyPopper, X, Star } from 'lucide-react';

type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'pending_acceptance'
  | 'in_transit_to_pickup'
  | 'picked_up'
  | 'in_transit_to_delivery'
  | 'delivered'
  | 'cancelled'
  | 'no_driver';

const statusConfig: Record<OrderStatus, { label: string; description: string; progress: number }> =
  {
    pending: { label: 'Pendiente', description: 'Esperando repartidor', progress: 10 },
    assigned: { label: 'Asignado', description: 'Repartidor asignado', progress: 20 },
    pending_acceptance: {
      label: 'Esperando al repartidor',
      description: 'Confirmando repartidor',
      progress: 15,
    },
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
    no_driver: {
      label: 'Sin repartidores',
      description: 'No hay repartidores disponibles en este momento.',
      progress: 10,
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
    case 'pending_acceptance':
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
    case 'no_driver':
      return <X className={iconClass} />;
    default:
      return <Clock className={iconClass} />;
  }
}

export default function TrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
          <p className="text-surface-500 animate-pulse">Cargando seguimiento…</p>
        </div>
      }
    >
      <TrackingContent />
    </Suspense>
  );
}

function TrackingContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  // Vuelta desde OnvoPay (returnUrl/cancelUrl del intent).
  const paidFlag = searchParams.get('paid') === '1';
  const cancelledFlag = searchParams.get('cancelled') === '1';
  // Verificación real contra el servidor (no se confía solo en el flag de la URL).
  const [paidState, setPaidState] = useState<'unknown' | 'paid' | 'pending'>('unknown');

  useEffect(() => {
    if (!paidFlag) return;
    const id = params.id as string;
    if (!id) return;
    let cancelled = false;
    api
      .getPublicPaidStatus(id)
      .then((r) => {
        if (!cancelled) setPaidState(r?.paid ? 'paid' : 'pending');
      })
      .catch(() => {
        if (!cancelled) setPaidState('pending');
      });
    return () => {
      cancelled = true;
    };
  }, [paidFlag, params.id]);
  const orderId = (params.id as string) ?? '';

  const [order, setOrder] = useState<Order | null>(null);
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  // Nivel de tráfico real del servidor (delivery-estimate). Null = sin dato.
  const [trafficLevel, setTrafficLevel] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<
    { status: string; timestamp: Date; message: string }[]
  >([]);

  const { isConnected, on, emit } = useSocket({
    onConnect: () => {
      emit('order:track', { orderId });
    },
  });

  const STATUS_LABELS: Record<string, string> = {
    pending: 'Viaje recibido',
    assigned: 'Repartidor asignado',
    pending_acceptance: 'Esperando al repartidor',
    in_transit_to_pickup: 'En camino a recoger',
    picked_up: 'Pedido recogido',
    in_transit_to_delivery: 'En camino a entregar',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    no_driver: 'Sin repartidores',
  };

  const etaForStatus = (status?: string | null): number | null => {
    if (status === 'in_transit_to_delivery') return 15;
    if (status === 'picked_up') return 25;
    if (status === 'delivered') return 0;
    return null;
  };

  // ETA del servidor (tráfico real). Solo con las 4 coords + distancia
  // válidas; si el pedido ya se entregó, ETA 0 sin llamar.
  const refreshEta = useCallback(async (o: any) => {
    const status = o?.status as string | undefined;
    if (status === 'delivered' || status === 'cancelled') {
      setEta(0);
      return;
    }
    const pLat = Number(o?.pickupLat);
    const pLng = Number(o?.pickupLng);
    const dLat = Number(o?.deliveryLat);
    const dLng = Number(o?.deliveryLng);
    const dist = Number(o?.distanceKm);
    if (
      ![pLat, pLng, dLat, dLng, dist].every((n) => Number.isFinite(n)) ||
      (pLat === 0 && pLng === 0) ||
      (dLat === 0 && dLng === 0)
    ) {
      return;
    }
    const est = await api.getDeliveryEstimate(pLat, pLng, dLat, dLng, dist);
    const mins = Number(est?.estimatedMinutes);
    if (Number.isFinite(mins) && mins >= 0) setEta(Math.round(mins));
    if (typeof est?.trafficLevel === 'string') setTrafficLevel(est.trafficLevel);
  }, []);

  const fetchOrder = useCallback(
    async (silent = false) => {
      if (!orderId) {
        setError('Pedido no encontrado');
        setLoading(false);
        return;
      }
      try {
        if (!silent) setLoading(true);
        // Invitado con link: endpoint público. Logueado: vista completa, con
        // fallback a la pública si su rol no tiene acceso (ej. cliente dueño
        // en APIs sin el permiso: igual ve su pedido, sin datos sensibles).
        const data = await (async () => {
          if (!api.getToken()) return api.getPublicTracking(orderId);
          try {
            return await api.getOrderById(orderId);
          } catch (err: any) {
            if (err?.status === 401 || err?.status === 403) {
              return api.getPublicTracking(orderId);
            }
            throw err;
          }
        })();
        setOrder(data);
        setCurrentStatus(data.status as OrderStatus);
        // Sin socket (invitados): historial y ETA salen de los timestamps
        // REST en vez de quedar vacíos para siempre.
        const seed: { status: string; timestamp: Date; message: string }[] = [];
        const push = (status: string, ts: any) => {
          if (!ts) return;
          const t = new Date(ts);
          if (isNaN(t.getTime())) return;
          seed.push({ status, timestamp: t, message: STATUS_LABELS[status] ?? status });
        };
        push('pending', data.createdAt);
        push('assigned', data.assignedAt);
        push('in_transit_to_pickup', (data as any).inTransitToPickupAt);
        push('picked_up', data.pickedUpAt);
        push('in_transit_to_delivery', (data as any).inTransitToDeliveryAt);
        push('delivered', data.deliveredAt);
        if (seed.length > 0) {
          seed.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          setStatusHistory(seed);
        }
        setEta((prev) => prev ?? etaForStatus(data.status));
        // ETA real con tráfico cuando hay coordenadas de ambos extremos.
        // Si falla (sin GPS, API dormido), queda la heurística de arriba.
        refreshEta(data).catch(() => undefined);
        setError(null);
      } catch {
        if (!silent) setError('No se pudo cargar el pedido');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId, refreshEta],
  );

  const driverId = (order as any)?.driverId ?? (order as any)?.driver?.id;

  const fetchLocation = useCallback(async () => {
    if (!orderId) return;
    try {
      // Punto azul en vivo: vía logueada si hay sesión, si no la pública.
      // Si la logueada rebota (rol sin acceso), se cae a la pública.
      let loc: any = null;
      if (api.getToken()) {
        if (driverId) {
          loc = await api.getDriverLocation(driverId).catch(() => null);
        }
        if (!loc || loc.known === false) {
          loc = await api.getPublicDriverLocation(orderId).catch(() => null);
        }
      } else {
        loc = await api.getPublicDriverLocation(orderId).catch(() => null);
      }
      if (loc && loc.known !== false && !loc.isStale && Number.isFinite(Number(loc.lat))) {
        setDriverLocation({ lat: Number(loc.lat), lng: Number(loc.lng) });
      }
    } catch {
      // Sin ubicación: el mapa muestra pickup/delivery igual.
    }
  }, [orderId, driverId]);

  useEffect(() => {
    fetchOrder();
    // La ubicación pública no necesita driverId: pedirla ya (si no, los
    // invitados esperan hasta 15s al primer tick del polling).
    fetchLocation();
  }, [fetchOrder, fetchLocation]);

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
        if (data.status === 'delivered') setEta(0);
        else refreshEta({ ...(order as any), status: data.status }).catch(() => undefined);
        // La evidencia (pickup/delivery URLs) vive en `order`: sin este
        // refetch silencioso el tracking nunca muestra la foto hasta recargar.
        fetchOrder(true).catch(() => undefined);
      }
    });
    return cleanup;
  }, [on, orderId, order, refreshEta, fetchOrder]);

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
    motorized_bike: 'Bici Moto',
    bicycle: 'Bicicleta',
    car: 'Carro',
    truck: 'Camión',
  };

  // Solo coords REALES: null/undefined/'' (Number(null) === 0, ¡finito!)
  // iban a parar al (0,0) del Golfo de Guinea — "el pedido en África".
  // Sin GPS no se inventa pin: se muestra lo que sí se conoce.
  const validPoint = (lat: unknown, lng: unknown): { lat: number; lng: number } | undefined => {
    if (lat == null || lng == null || lat === '' || lng === '') return undefined;
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return undefined;
    if (la === 0 && ln === 0) return undefined;
    if (la < -90 || la > 90 || ln < -180 || ln > 180) return undefined;
    return { lat: la, lng: ln };
  };
  const pickup = validPoint((order as any)?.pickupLat, (order as any)?.pickupLng);
  const delivery = validPoint((order as any)?.deliveryLat, (order as any)?.deliveryLng);

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
        {(paidFlag || cancelledFlag) && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              paidFlag && paidState === 'paid'
                ? 'border-kiwi-200 bg-kiwi-50 text-kiwi-700 dark:border-kiwi-800 dark:bg-kiwi-900/20 dark:text-kiwi-300'
                : paidFlag
                  ? 'border-surface-200 bg-surface-50 text-surface-600 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
            }`}
          >
            {paidFlag
              ? paidState === 'paid'
                ? 'Pago confirmado, ¡gracias! Tu pedido sigue su curso.'
                : 'Estamos confirmando tu pago con el banco… esta página se actualiza sola.'
              : 'El pago se canceló. Tu pedido sigue activo: coordinamos el cobro por WhatsApp.'}
          </div>
        )}
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
          />
        </motion.div>
        {!delivery && (
          <p className="mb-6 -mt-3 text-center text-xs text-surface-400">
            Este pedido no trae GPS de entrega: la dirección escrita vale.
          </p>
        )}

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
        {!driverLocation && (order as any)?.driverId && (
          <p className="mb-4 -mt-1 text-center text-xs text-surface-400">
            Conectando con la ubicación del repartidor… si tarda, puede tener el GPS apagado.
          </p>
        )}

        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-700">
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
              <span className="text-lg font-bold text-kiwi-700 dark:text-kiwi-400 font-mono">
                {eta} min
              </span>
              {trafficLevel && (
                <span className="ml-1 rounded-full bg-surface-100 dark:bg-surface-700 px-2 py-0.5 text-xs font-medium text-surface-500 dark:text-surface-400">
                  Tráfico: {trafficLevel}
                </span>
              )}
            </motion.div>
          )}
        </motion.div>

        {currentStatus === 'no_driver' && (
          <div className="mb-6 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            No hay repartidores disponibles en este momento.
          </div>
        )}

        {((order as any).pickupProofPhotoUrl || (order as any).deliveryProofPhotoUrl) && (
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
              Evidencia del pedido
            </h3>
            <div className="space-y-3">
              {(order as any).pickupProofPhotoUrl && (
                <div>
                  <p className="mb-1 text-xs text-surface-500 dark:text-surface-400">
                    Así lo entregó el comercio
                  </p>
                  <img
                    src={(order as any).pickupProofPhotoUrl}
                    alt="Foto del comercio al entregar"
                    className="rounded-xl w-full object-cover"
                  />
                </div>
              )}
              {(order as any).deliveryProofPhotoUrl && (
                <div>
                  <p className="mb-1 text-xs text-surface-500 dark:text-surface-400">
                    Así se entregó a destino
                  </p>
                  <img
                    src={(order as any).deliveryProofPhotoUrl}
                    alt="Foto de la entrega al cliente"
                    className="rounded-xl w-full object-cover"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {driver && currentStatus !== 'pending' && currentStatus !== 'cancelled' && (
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
              Tu repartidor
            </h3>
            <div className="flex items-center gap-3">
              {driver.photoUrl ? (
                // NOTE: <img> intencional — foto dinámica externa, next/image no aporta aquí
                <img
                  src={driver.photoUrl}
                  alt={driver.fullName ?? 'Repartidor'}
                  className="h-14 w-14 rounded-full object-cover bg-surface-100 dark:bg-surface-700"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-kiwi-100 dark:bg-kiwi-900/30 text-xl font-bold text-kiwi-700 dark:text-kiwi-400">
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
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 mb-6"
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
            className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 mb-6"
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
