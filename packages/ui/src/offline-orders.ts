'use client';

/**
 * 🥝 KIWI - Offline-First Order Creation Service
 *
 * Creates and manages orders locally when offline,
 * then syncs to the server when reconnected.
 */

import { backgroundSync, type SyncAction } from './background-sync';
import { apiFetch } from './api-client';

const DB_NAME = 'kiwi-offline-orders';
const DB_VERSION = 1;
const STORE_NAME = 'orders';

export type OrderStatus =
  | 'draft' // Created offline, not yet synced
  | 'pending' // Synced, waiting for driver
  | 'accepted' // Driver accepted
  | 'preparing' // Merchant preparing
  | 'ready' // Ready for pickup
  | 'picked_up' // Driver picked up
  | 'in_transit' // On the way
  | 'delivered' // Delivered
  | 'cancelled'; // Cancelled

export type PaymentMethod = 'sinpe' | 'card' | 'cash' | 'crypto';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface OfflineOrder {
  id: string;
  /** Local ID (offline) */
  localId: string;
  /** Server ID (after sync) */
  serverId?: string;

  /** Merchant info */
  merchantId: string;
  merchantName: string;

  /** Customer info */
  customerId?: string;
  customerName: string;
  customerPhone: string;

  /** Delivery info */
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryAddress: string;
  deliveryLat?: number;
  deliveryLng?: number;

  /** Order items */
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;

  /** Payment */
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid' | 'failed';

  /** Status */
  status: OrderStatus;
  statusHistory: Array<{
    status: OrderStatus;
    timestamp: number;
    note?: string;
  }>;

  /** Driver assignment */
  driverId?: string;
  driverName?: string;
  driverPhone?: string;

  /** Timestamps */
  createdAt: number;
  updatedAt: number;
  scheduledFor?: number;

  /** Sync status */
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string;
  lastSyncAttempt?: number;

  /** Metadata */
  notes?: string;
  metadata?: Record<string, any>;
}

interface OfflineOrderOptions {
  /** Auto-sync when online */
  autoSync?: boolean;

  /** Max local orders before warning */
  maxLocalOrders?: number;

  /** Order expiration (ms) */
  orderExpiration?: number;
}

class OfflineOrderService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private options: OfflineOrderOptions;

  constructor(options: OfflineOrderOptions = {}) {
    this.options = {
      autoSync: true,
      maxLocalOrders: 50,
      orderExpiration: 24 * 60 * 60 * 1000, // 24 hours
      ...options,
    };
  }

  /**
   * Initialize IndexedDB
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open orders DB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('🥝 Offline orders initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('localId', 'localId', { unique: true });
          store.createIndex('serverId', 'serverId', { unique: false });
          store.createIndex('merchantId', 'merchantId', { unique: false });
          store.createIndex('customerId', 'customerId', { unique: false });
          store.createIndex('driverId', 'driverId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('🥝 Created orders store');
        }
      };
    });
  }

  /**
   * Create a new order (works offline)
   */
  async createOrder(
    orderData: Omit<
      OfflineOrder,
      'id' | 'localId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'status' | 'statusHistory'
    >,
  ): Promise<OfflineOrder> {
    await this.initialize();

    const now = Date.now();
    const localId = `local_${now}_${Math.random().toString(36).substr(2, 9)}`;

    const order: OfflineOrder = {
      ...orderData,
      id: localId,
      localId,
      status: 'draft',
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now,
      statusHistory: [{ status: 'draft', timestamp: now, note: 'Created offline' }],
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(order);

      request.onsuccess = () => {
        console.log(`🥝 Created order: ${localId}`);

        // Queue for sync if online (fire-and-forget with rejection handler)
        if (navigator.onLine && this.options.autoSync) {
          this.syncOrder(localId).catch((err) =>
            console.error(`Failed to sync new order ${localId}:`, err),
          );
        }

        resolve(order);
      };

      request.onerror = () => {
        console.error('Failed to create order:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update an order
   */
  async updateOrder(localId: string, updates: Partial<OfflineOrder>): Promise<OfflineOrder> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(localId);

      request.onsuccess = () => {
        const order = request.result as OfflineOrder;

        if (!order) {
          reject(new Error('Order not found'));
          return;
        }

        const updatedOrder: OfflineOrder = {
          ...order,
          ...updates,
          updatedAt: Date.now(),
          // Respect an explicit syncStatus (syncing/synced/failed):
          // forcing 'pending' here erased the syncing marker set by
          // syncOrder and the failed marker set by its catch block.
          syncStatus: updates.syncStatus ?? 'pending',
        };

        // Add status to history if status changed
        if (updates.status && updates.status !== order.status) {
          updatedOrder.statusHistory = [
            ...order.statusHistory,
            {
              status: updates.status,
              timestamp: Date.now(),
              note: updates.notes,
            },
          ];
        }

        const updateRequest = store.put(updatedOrder);

        updateRequest.onsuccess = () => {
          console.log(`🥝 Updated order: ${localId}`);

          // Queue for sync (fire-and-forget with rejection handler)
          if (navigator.onLine && this.options.autoSync) {
            this.syncOrder(localId).catch((err) =>
              console.error(`Failed to sync updated order ${localId}:`, err),
            );
          }

          resolve(updatedOrder);
        };

        updateRequest.onerror = () => {
          reject(updateRequest.error);
        };
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get an order by local ID
   */
  async getOrder(localId: string): Promise<OfflineOrder | null> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(localId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all orders (with optional filters)
   */
  async getOrders(filters?: {
    merchantId?: string;
    customerId?: string;
    driverId?: string;
    status?: OrderStatus;
    syncStatus?: string;
  }): Promise<OfflineOrder[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let orders = request.result as OfflineOrder[];

        // Apply filters
        if (filters) {
          if (filters.merchantId) {
            orders = orders.filter((o) => o.merchantId === filters.merchantId);
          }
          if (filters.customerId) {
            orders = orders.filter((o) => o.customerId === filters.customerId);
          }
          if (filters.driverId) {
            orders = orders.filter((o) => o.driverId === filters.driverId);
          }
          if (filters.status) {
            orders = orders.filter((o) => o.status === filters.status);
          }
          if (filters.syncStatus) {
            orders = orders.filter((o) => o.syncStatus === filters.syncStatus);
          }
        }

        // Sort by creation date (newest first)
        orders.sort((a, b) => b.createdAt - a.createdAt);

        resolve(orders);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get pending orders (not yet synced, including retryable failures)
   */
  async getPendingOrders(): Promise<OfflineOrder[]> {
    const [pending, failed] = await Promise.all([
      this.getOrders({ syncStatus: 'pending' }),
      this.getOrders({ syncStatus: 'failed' }),
    ]);
    return [...pending, ...failed].sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get unsynced count (anything not confirmed by the server)
   */
  async getUnsyncedCount(): Promise<number> {
    const orders = await this.getOrders();
    return orders.filter((o) => o.syncStatus !== 'synced').length;
  }

  /**
   * Sync an order to the server. Resolves with the latest LOCAL snapshot —
   * the server round-trip completes in the background queue, so callers
   * must not treat the return value as server-confirmed.
   */
  async syncOrder(localId: string): Promise<OfflineOrder | null> {
    const order = await this.getOrder(localId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.syncStatus === 'synced') {
      return order; // Already synced
    }

    // Mark as syncing
    await this.updateOrder(localId, { syncStatus: 'syncing' });

    try {
      // Enqueue for background sync
      await backgroundSync.enqueue('order:create', order, {
        priority: 'high',
        metadata: { localId: order.localId },
        execute: async (data: OfflineOrder) => {
          const response = await apiFetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const result = await response.json();

          // Update order with server ID
          await this.updateOrder(localId, {
            serverId: result.id,
            syncStatus: 'synced',
          });

          return result;
        },
      });

      return this.getOrder(localId);
    } catch (error) {
      // Mark as failed
      await this.updateOrder(localId, {
        syncStatus: 'failed',
        syncError: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Sync all pending orders
   */
  async syncAllPending(): Promise<{ synced: number; failed: number }> {
    const pending = await this.getPendingOrders();
    let synced = 0;
    let failed = 0;

    for (const order of pending) {
      try {
        await this.syncOrder(order.localId);
        synced++;
      } catch (error) {
        failed++;
        console.error(`Failed to sync order ${order.localId}:`, error);
      }
    }

    return { synced, failed };
  }

  /**
   * Cancel an order
   */
  async cancelOrder(localId: string, reason?: string): Promise<OfflineOrder> {
    return this.updateOrder(localId, {
      status: 'cancelled',
      notes: reason,
    });
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    localId: string,
    status: OrderStatus,
    note?: string,
  ): Promise<OfflineOrder> {
    return this.updateOrder(localId, {
      status,
      notes: note,
    });
  }

  /**
   * Assign driver to order
   */
  async assignDriver(
    localId: string,
    driverId: string,
    driverName: string,
    driverPhone: string,
  ): Promise<OfflineOrder> {
    return this.updateOrder(localId, {
      driverId,
      driverName,
      driverPhone,
      status: 'accepted',
    });
  }

  /**
   * Delete an order (local only)
   */
  async deleteOrder(localId: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(localId);

      request.onsuccess = () => {
        console.log(`🗑️ Deleted order: ${localId}`);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all local orders
   */
  async clearAll(): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🧹 Cleared all local orders');
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get order statistics
   */
  async getStats(): Promise<{
    total: number;
    draft: number;
    pending: number;
    synced: number;
    failed: number;
    byStatus: Record<OrderStatus, number>;
  }> {
    const orders = await this.getOrders();

    const stats = {
      total: orders.length,
      draft: orders.filter((o) => o.status === 'draft').length,
      pending: orders.filter((o) => o.syncStatus === 'pending').length,
      synced: orders.filter((o) => o.syncStatus === 'synced').length,
      failed: orders.filter((o) => o.syncStatus === 'failed').length,
      byStatus: {} as Record<OrderStatus, number>,
    };

    // Count by status
    orders.forEach((order) => {
      stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
    });

    return stats;
  }
}

// Create singleton instance
export const offlineOrders = new OfflineOrderService();

// Auto-initialize on import (client-side only)
if (typeof window !== 'undefined') {
  offlineOrders.initialize().catch(console.error);
}

export type { OfflineOrderOptions };
