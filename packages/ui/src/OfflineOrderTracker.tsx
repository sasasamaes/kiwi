'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOfflineOrders, type OfflineOrder, type OrderStatus } from './useOfflineOrders';
import { useNetworkStatus } from './useNetworkStatus';
import { backgroundSync } from './background-sync';
import { Bike, MapPin, Package, RefreshCw, User, WifiOff } from 'lucide-react';

interface OfflineOrderTrackerProps {
  localId: string;
  onStatusChange?: (status: OrderStatus) => void;
  className?: string;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    description: string;
  }
> = {
  draft: {
    label: 'Borrador',
    icon: 'file',
    color: 'text-surface-600',
    bgColor: 'bg-surface-100',
    description: 'Pedido creado localmente',
  },
  pending: {
    label: 'Pendiente',
    icon: 'clock',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: 'Esperando repartidor',
  },
  accepted: {
    label: 'Aceptado',
    icon: 'Check',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Repartidor asignado',
  },
  preparing: {
    label: 'Preparando',
    icon: '👨‍🍳',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    description: 'Preparando tu pedido',
  },
  ready: {
    label: 'Listo',
    icon: 'package',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: 'Listo para recoger',
  },
  picked_up: {
    label: 'Recogido',
    icon: 'bike',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Repartidor en camino',
  },
  in_transit: {
    label: 'En camino',
    icon: 'map',
    color: 'text-kiwi-600',
    bgColor: 'bg-kiwi-100',
    description: 'Casi llegando',
  },
  delivered: {
    label: 'Entregado',
    icon: 'party',
    color: 'text-kiwi-600',
    bgColor: 'bg-kiwi-100',
    description: 'Pedido entregado',
  },
  cancelled: {
    label: 'Cancelado',
    icon: 'close',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: 'Pedido cancelado',
  },
};

export function OfflineOrderTracker({
  localId,
  onStatusChange,
  className = '',
}: OfflineOrderTrackerProps) {
  const { getOrder, updateStatus, syncOrder } = useOfflineOrders();
  const { isOnline } = useNetworkStatus();
  const [order, setOrder] = useState<OfflineOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [localId]);

  const loadOrder = async () => {
    setIsLoading(true);
    const fetchedOrder = await getOrder(localId);
    setOrder(fetchedOrder);
    setIsLoading(false);
  };

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    try {
      const updatedOrder = await updateStatus(localId, newStatus);
      setOrder(updatedOrder);
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleSync = async () => {
    try {
      await syncOrder(localId);
      await loadOrder();
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-32 bg-surface-200 dark:bg-surface-700 rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <span className="text-4xl">X</span>
        <p className="text-surface-500 dark:text-surface-400">Pedido no encontrado</p>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status];

  return (
    <motion.div
      className={`glass rounded-2xl overflow-hidden ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Status Header */}
      <div className={`p-4 ${statusConfig.bgColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.span
              className="text-3xl"
              animate={
                order.status === 'in_transit'
                  ? {
                      scale: [1, 1.1, 1],
                    }
                  : {}
              }
              transition={{ duration: 2, repeat: Infinity }}
            >
              {statusConfig.icon}
            </motion.span>
            <div>
              <h3 className={`font-display font-bold ${statusConfig.color}`}>
                {statusConfig.label}
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                {statusConfig.description}
              </p>
            </div>
          </div>

          {/* Sync Status */}
          <div className="flex items-center gap-2">
            {order.syncStatus === 'syncing' && (
              <motion.div
                className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            )}
            {order.syncStatus === 'pending' && !isOnline && (
              <WifiOff className="text-orange-500 h-5 w-5" />
            )}
            {order.syncStatus === 'failed' && (
              <button onClick={handleSync} className="text-red-500 hover:text-red-600">
                <RefreshCw className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="p-4 space-y-3">
        {/* Customer Info */}
        <div className="flex items-center gap-3">
          <User className="text-xl h-5 w-5" />
          <div>
            <p className="font-medium text-surface-800 dark:text-surface-200">
              {order.customerName}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">{order.customerPhone}</p>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="flex items-center gap-3">
          <MapPin className="text-xl h-5 w-5" />
          <div>
            <p className="text-sm text-surface-500 dark:text-surface-400">Entregar en</p>
            <p className="font-medium text-surface-800 dark:text-surface-200">
              {order.deliveryAddress}
            </p>
          </div>
        </div>

        {/* Items Summary */}
        <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
          <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">
            {order.items.length} producto{order.items.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-1">
            {order.items.slice(0, 3).map((item) => (
              <div key={item.menuItemId} className="flex justify-between text-sm">
                <span className="text-surface-600 dark:text-surface-400">
                  {item.quantity}x {item.name}
                </span>
                <span className="font-medium">
                  ₡{(item.price * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-xs text-surface-400">+{order.items.length - 3} más</p>
            )}
          </div>
          <div className="flex justify-between pt-2 mt-2 border-t border-surface-200 dark:border-surface-700">
            <span className="font-semibold text-surface-800 dark:text-surface-200">Total</span>
            <span className="font-bold text-kiwi-600 dark:text-kiwi-400">
              ₡{order.total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Driver Info */}
        {order.driverName && (
          <div className="flex items-center gap-3">
            <Bike className="text-xl h-5 w-5" />
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Repartidor</p>
              <p className="font-medium text-surface-800 dark:text-surface-200">
                {order.driverName}
              </p>
            </div>
          </div>
        )}

        {/* Status History */}
        <div className="pt-3 border-t border-surface-100 dark:border-surface-700">
          <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">Historial</p>
          <div className="space-y-2">
            {order.statusHistory
              .slice(-3)
              .reverse()
              .map((entry, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span>{STATUS_CONFIG[entry.status]?.icon}</span>
                  <span className="text-surface-600 dark:text-surface-400">
                    {STATUS_CONFIG[entry.status]?.label}
                  </span>
                  <span className="text-xs text-surface-400 ml-auto">
                    {new Date(entry.timestamp).toLocaleTimeString('es-CR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-surface-100 dark:border-surface-700">
        <div className="flex gap-2">
          {/* Status Update Buttons */}
          {order.status === 'draft' && (
            <button
              onClick={() => handleStatusUpdate('pending')}
              className="flex-1 py-2 rounded-xl bg-kiwi-500 text-white font-medium"
            >
              Enviar Pedido
            </button>
          )}

          {order.status === 'pending' && (
            <button
              onClick={() => handleStatusUpdate('cancelled')}
              className="flex-1 py-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium"
            >
              Cancelar
            </button>
          )}

          {order.status === 'accepted' && (
            <button
              onClick={() => handleStatusUpdate('preparing')}
              className="flex-1 py-2 rounded-xl bg-yellow-500 text-white font-medium"
            >
              👨‍🍳 Preparar
            </button>
          )}

          {order.status === 'preparing' && (
            <button
              onClick={() => handleStatusUpdate('ready')}
              className="flex-1 py-2 rounded-xl bg-purple-500 text-white font-medium"
            >
              Marcar Listo
            </button>
          )}

          {order.status === 'ready' && (
            <button
              onClick={() => handleStatusUpdate('picked_up')}
              className="flex-1 py-2 rounded-xl bg-blue-500 text-white font-medium"
            >
              Recogido
            </button>
          )}

          {order.status === 'picked_up' && (
            <button
              onClick={() => handleStatusUpdate('in_transit')}
              className="flex-1 py-2 rounded-xl bg-kiwi-500 text-white font-medium"
            >
              Map En Camino
            </button>
          )}

          {order.status === 'in_transit' && (
            <button
              onClick={() => handleStatusUpdate('delivered')}
              className="flex-1 py-2 rounded-xl bg-kiwi-500 text-white font-medium"
            >
              Entregado
            </button>
          )}

          {/* Sync Button */}
          {order.syncStatus !== 'synced' && isOnline && (
            <button
              onClick={handleSync}
              className="px-4 py-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * List of offline orders
 */
export function OfflineOrderList({
  merchantId,
  className = '',
}: {
  merchantId?: string;
  className?: string;
}) {
  const { orders, unsyncedCount, syncAll, isLoading } = useOfflineOrders({ merchantId });
  const { isOnline } = useNetworkStatus();

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse h-48 bg-surface-200 dark:bg-surface-700 rounded-2xl"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Sync Banner */}
      {unsyncedCount > 0 && (
        <motion.div
          className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="text-2xl h-6 w-6" />
              <div>
                <p className="font-medium text-blue-700 dark:text-blue-400">
                  {unsyncedCount} pedido{unsyncedCount !== 1 ? 's' : ''} pendiente
                  {unsyncedCount !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  {isOnline ? 'Se sincronizarán automáticamente' : 'Esperando conexión...'}
                </p>
              </div>
            </div>
            {isOnline && (
              <button
                onClick={syncAll}
                className="px-4 py-2 rounded-xl bg-blue-500 text-white font-medium"
              >
                Sincronizar
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Orders */}
      {orders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="text-5xl block mb-4 h-12 w-12" />
          <h3 className="text-lg font-semibold text-surface-800 dark:text-surface-100 mb-2">
            No hay pedidos
          </h3>
          <p className="text-surface-500 dark:text-surface-400">
            Los pedidos creados aparecerán aquí
          </p>
        </div>
      ) : (
        orders.map((order) => (
          <OfflineOrderTracker key={order.localId} localId={order.localId} className="w-full" />
        ))
      )}
    </div>
  );
}
