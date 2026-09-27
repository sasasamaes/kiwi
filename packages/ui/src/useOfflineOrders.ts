// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  offlineOrders,
  type OfflineOrder,
  type OrderStatus,
  type PaymentMethod,
} from './offline-orders';

interface UseOfflineOrdersOptions {
  /** Filter by merchant ID */
  merchantId?: string;

  /** Filter by customer ID */
  customerId?: string;

  /** Filter by driver ID */
  driverId?: string;

  /** Filter by status */
  status?: OrderStatus;

  /** Auto-refresh interval (ms) */
  refreshInterval?: number;
}

interface UseOfflineOrdersResult {
  /** All orders matching filters */
  orders: OfflineOrder[];

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;

  /** Create a new order */
  createOrder: (orderData: CreateOrderData) => Promise<OfflineOrder>;

  /** Update an order */
  updateOrder: (localId: string, updates: Partial<OfflineOrder>) => Promise<OfflineOrder>;

  /** Cancel an order */
  cancelOrder: (localId: string, reason?: string) => Promise<OfflineOrder>;

  /** Assign driver */
  assignDriver: (
    localId: string,
    driverId: string,
    driverName: string,
    driverPhone: string,
  ) => Promise<OfflineOrder>;

  /** Update status */
  updateStatus: (localId: string, status: OrderStatus, note?: string) => Promise<OfflineOrder>;

  /** Sync order to server */
  syncOrder: (localId: string) => Promise<OfflineOrder>;

  /** Get a single order by local id */
  getOrder: (localId: string) => Promise<OfflineOrder | null>;

  /** Sync all pending orders */
  syncAll: () => Promise<{ synced: number; failed: number }>;

  /** Delete an order */
  deleteOrder: (localId: string) => Promise<void>;

  /** Refresh orders */
  refresh: () => Promise<void>;

  /** Get unsynced count */
  unsyncedCount: number;

  /** Stats */
  stats: {
    total: number;
    draft: number;
    pending: number;
    synced: number;
    failed: number;
  } | null;
}

interface CreateOrderData {
  merchantId: string;
  merchantName: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryAddress: string;
  deliveryLat?: number;
  deliveryLng?: number;
  items: Array<{
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
  }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  notes?: string;
  scheduledFor?: number;
}

export function useOfflineOrders(options: UseOfflineOrdersOptions = {}): UseOfflineOrdersResult {
  const [orders, setOrders] = useState<OfflineOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [stats, setStats] = useState<UseOfflineOrdersResult['stats']>(null);

  /**
   * Load orders
   */
  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const fetchedOrders = await offlineOrders.getOrders({
        merchantId: options.merchantId,
        customerId: options.customerId,
        driverId: options.driverId,
        status: options.status,
      });

      setOrders(fetchedOrders);

      // Load stats
      const orderStats = await offlineOrders.getStats();
      setStats(orderStats);
      setUnsyncedCount(orderStats.pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [options.merchantId, options.customerId, options.driverId, options.status]);

  /**
   * Create a new order
   */
  const createOrder = useCallback(
    async (orderData: CreateOrderData): Promise<OfflineOrder> => {
      try {
        const order = await offlineOrders.createOrder({
          ...orderData,
          paymentStatus: orderData.paymentStatus ?? 'pending',
          items: orderData.items.map((item, index) => ({
            ...item,
            id: `${Date.now()}_${index}`,
          })),
        } as any);
        await loadOrders();
        return order;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create order';
        setError(errorMessage);
        throw err;
      }
    },
    [loadOrders],
  );

  /**
   * Update an order
   */
  const updateOrder = useCallback(
    async (localId: string, updates: Partial<OfflineOrder>): Promise<OfflineOrder> => {
      try {
        const order = await offlineOrders.updateOrder(localId, updates);
        await loadOrders();
        return order;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update order';
        setError(errorMessage);
        throw err;
      }
    },
    [loadOrders],
  );

  /**
   * Cancel an order
   */
  const cancelOrder = useCallback(
    async (localId: string, reason?: string): Promise<OfflineOrder> => {
      try {
        const order = await offlineOrders.cancelOrder(localId, reason);
        await loadOrders();
        return order;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to cancel order';
        setError(errorMessage);
        throw err;
      }
    },
    [loadOrders],
  );

  /**
   * Assign driver
   */
  const assignDriver = useCallback(
    async (
      localId: string,
      driverId: string,
      driverName: string,
      driverPhone: string,
    ): Promise<OfflineOrder> => {
      try {
        const order = await offlineOrders.assignDriver(localId, driverId, driverName, driverPhone);
        await loadOrders();
        return order;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to assign driver';
        setError(errorMessage);
        throw err;
      }
    },
    [loadOrders],
  );

  /**
   * Update status
   */
  const updateStatus = useCallback(
    async (localId: string, status: OrderStatus, note?: string): Promise<OfflineOrder> => {
      try {
        const order = await offlineOrders.updateOrderStatus(localId, status, note);
        await loadOrders();
        return order;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
        setError(errorMessage);
        throw err;
      }
    },
    [loadOrders],
  );

  /**
   * Sync order
   */
  const syncOrder = useCallback(
    async (localId: string): Promise<OfflineOrder> => {
      try {
        const order = await offlineOrders.syncOrder(localId);
        if (!order) throw new Error('Order not found');
        await loadOrders();
        return order;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to sync order';
        setError(errorMessage);
        throw err;
      }
    },
    [loadOrders],
  );

  /**
   * Get a single order by local id
   */
  const getOrder = useCallback(async (localId: string): Promise<OfflineOrder | null> => {
    return offlineOrders.getOrder(localId);
  }, []);

  /**
   * Sync all pending
   */
  const syncAll = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    try {
      const result = await offlineOrders.syncAllPending();
      await loadOrders();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync orders';
      setError(errorMessage);
      throw err;
    }
  }, [loadOrders]);

  /**
   * Delete order
   */
  const deleteOrder = useCallback(
    async (localId: string): Promise<void> => {
      try {
        await offlineOrders.deleteOrder(localId);
        await loadOrders();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete order';
        setError(errorMessage);
        throw err;
      }
    },
    [loadOrders],
  );

  // Initial load
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Auto-refresh
  useEffect(() => {
    if (!options.refreshInterval) return;

    const interval = setInterval(loadOrders, options.refreshInterval);
    return () => clearInterval(interval);
  }, [options.refreshInterval, loadOrders]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      // Auto-sync when coming back online
      syncAll().catch(console.error);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncAll]);

  return {
    orders,
    isLoading,
    error,
    createOrder,
    updateOrder,
    cancelOrder,
    assignDriver,
    updateStatus,
    syncOrder,
    getOrder,
    syncAll,
    deleteOrder,
    refresh: loadOrders,
    unsyncedCount,
    stats,
  };
}

/**
 * Hook for merchant order management
 */
export function useMerchantOrders(merchantId: string) {
  return useOfflineOrders({ merchantId });
}

/**
 * Hook for driver order management
 */
export function useDriverOrders(driverId: string) {
  return useOfflineOrders({ driverId });
}

/**
 * Hook for customer order tracking
 */
export function useCustomerOrders(customerId: string) {
  return useOfflineOrders({ customerId });
}

export type { UseOfflineOrdersOptions, UseOfflineOrdersResult, CreateOrderData };
export type { OfflineOrder, OrderStatus, PaymentMethod };
