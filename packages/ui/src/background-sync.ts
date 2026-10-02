// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * 🥝 KIWI - Background Sync Service
 *
 * Queues actions when offline and syncs when reconnected.
 * Supports retry logic, priority queues, and conflict resolution.
 */

import { apiFetch } from './api-client';

const DB_NAME = 'kiwi-background-sync';
const DB_VERSION = 1;
const STORE_NAME = 'sync-queue';

export type SyncPriority = 'low' | 'normal' | 'high' | 'critical';
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed' | 'cancelled';
export type ActionType =
  | 'order:create'
  | 'order:update'
  | 'order:cancel'
  | 'order:status'
  | 'payment:create'
  | 'payment:confirm'
  | 'location:update'
  | 'rating:submit'
  | 'notification:register'
  | 'custom';

export interface SyncAction<T = any> {
  id: string;
  type: ActionType;
  data: T;
  priority: SyncPriority;
  status: SyncStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
  nextRetryAt: number;
  lastError?: string;
  metadata?: Record<string, any>;
  /** Function to execute when syncing */
  execute?: (data: T) => Promise<any>;
}

interface SyncQueueStats {
  total: number;
  pending: number;
  syncing: number;
  completed: number;
  failed: number;
  byPriority: Record<SyncPriority, number>;
  byType: Record<string, number>;
}

interface BackgroundSyncOptions {
  /** Maximum number of concurrent syncs */
  maxConcurrent?: number;

  /** Base delay for exponential backoff (ms) */
  retryBaseDelay?: number;

  /** Maximum retry delay (ms) */
  maxRetryDelay?: number;

  /** Maximum number of retry attempts */
  maxAttempts?: number;

  /** How often to check for pending syncs (ms) */
  pollInterval?: number;

  /** Callback when sync completes */
  onSyncComplete?: (action: SyncAction, result: any) => void;

  /** Callback when sync fails */
  onSyncFailed?: (action: SyncAction, error: Error) => void;

  /** Callback when queue changes */
  onQueueChange?: (stats: SyncQueueStats) => void;
}

class BackgroundSyncService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private isSyncing = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private options: BackgroundSyncOptions;
  private listeners: Map<string, Set<Function>> = new Map();
  /** In-memory executors: functions can't live in IndexedDB (DataCloneError) */
  private executors: Map<string, (data: any) => Promise<any>> = new Map();

  constructor(options: BackgroundSyncOptions = {}) {
    this.options = {
      maxConcurrent: 3,
      retryBaseDelay: 1000,
      maxRetryDelay: 300000, // 5 minutes
      maxAttempts: 5,
      pollInterval: 5000, // 5 seconds
      ...options,
    };
  }

  /**
   * Initialize the IndexedDB database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available (server-side)'));
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open sync DB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('🥝 Background sync initialized');

        // Recovery: una recarga a mitad de sync deja filas en 'syncing' que
        // el poll (solo 'pending') jamás retoma → UI bloqueada en
        // "Sincronizando…". Se devuelven a 'pending' al arrancar.
        try {
          const tx = this.db.transaction([STORE_NAME], 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const stuck = store.index('status').getAll('syncing');
          stuck.onsuccess = () => {
            const rows = (stuck.result as SyncAction[]) || [];
            for (const r of rows) {
              store.put({ ...r, status: 'pending', nextRetryAt: 0, updatedAt: Date.now() });
            }
            if (rows.length > 0) console.log(`🥝 Recovered ${rows.length} stuck sync action(s)`);
          };
        } catch {
          // best-effort: si falla, el flujo normal sigue igual
        }

        // Start polling for pending syncs
        this.startPolling();

        // Listen for online/offline events
        this.setupNetworkListeners();

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
          console.log('🥝 Created sync queue store');
        }
      };
    });
  }

  /**
   * SSR-safe online check (navigator doesn't exist on the server).
   */
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  /**
   * Set up network event listeners
   */
  private setupNetworkListeners(): void {
    const handleOnline = () => {
      console.log('🥝 Back online, starting sync...');
      this.processQueue();
    };

    const handleOffline = () => {
      console.log(' pelletGone offline, queueing actions...');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  /**
   * Start polling for pending syncs
   */
  private startPolling(): void {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      if (this.isOnline() && !this.isSyncing) {
        this.processQueue();
      }
    }, this.options.pollInterval);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Add an action to the sync queue
   */
  async enqueue<T>(
    type: ActionType,
    data: T,
    options: {
      priority?: SyncPriority;
      maxAttempts?: number;
      metadata?: Record<string, any>;
      execute?: (data: T) => Promise<any>;
    } = {},
  ): Promise<SyncAction<T>> {
    await this.initialize();

    const action: SyncAction<T> = {
      id: this.generateId(),
      type,
      data,
      priority: options.priority || 'normal',
      status: 'pending',
      attempts: 0,
      maxAttempts: options.maxAttempts || this.options.maxAttempts!,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nextRetryAt: Date.now(),
      metadata: options.metadata,
    };

    // Keep custom executor in memory only — functions are not
    // structured-cloneable and would make the IDB put throw DataCloneError.
    if (options.execute) this.executors.set(action.id, options.execute as any);

    // Persist a clone WITHOUT the function
    const { execute: _omit, ...persistable } = action as any;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(persistable);

      request.onsuccess = () => {
        console.log(`🥝 Enqueued ${type} action: ${action.id}`);
        this.emit('enqueued', action);
        this.notifyQueueChange();
        resolve(action);
      };

      request.onerror = () => {
        console.error('Failed to enqueue action:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Process the sync queue
   */
  async processQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline()) return;

    this.isSyncing = true;
    this.emit('syncStart');

    try {
      const pendingActions = await this.getPendingActions();

      // Sort by priority
      const sortedActions = this.sortByPriority(pendingActions);

      // Process up to maxConcurrent actions
      const toProcess = sortedActions.slice(0, this.options.maxConcurrent);

      const results = await Promise.allSettled(toProcess.map((action) => this.syncAction(action)));

      // Check if more actions to process
      const remaining = await this.getPendingActions();
      if (remaining.length > 0) {
        // Schedule next batch
        setTimeout(() => this.processQueue(), 1000);
      }
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isSyncing = false;
      this.emit('syncEnd');
    }
  }

  /**
   * Sync a single action
   */
  private async syncAction(action: SyncAction): Promise<any> {
    try {
      // Update status to syncing
      await this.updateAction(action.id, {
        status: 'syncing',
        attempts: action.attempts + 1,
        updatedAt: Date.now(),
      });

      this.emit('syncing', action);

      let result: any;

      const customExecute = this.executors.get(action.id);
      if (customExecute) {
        // Use in-memory custom execute function
        result = await customExecute(action.data);
      } else {
        // Default API call based on action type
        result = await this.executeDefaultAction(action);
      }

      // Mark as completed
      await this.updateAction(action.id, {
        status: 'completed',
        updatedAt: Date.now(),
      });
      this.executors.delete(action.id);

      console.log(`✅ Synced ${action.type}: ${action.id}`);
      this.emit('synced', { action, result });
      this.options.onSyncComplete?.(action, result);
      this.notifyQueueChange();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`❌ Failed to sync ${action.type}:`, errorMessage);

      // Calculate next retry time with exponential backoff
      const nextRetryAt = this.calculateRetryTime(action.attempts + 1);

      // Check if we should retry
      if (action.attempts + 1 < action.maxAttempts) {
        await this.updateAction(action.id, {
          status: 'pending',
          attempts: action.attempts + 1,
          nextRetryAt,
          lastError: errorMessage,
          updatedAt: Date.now(),
        });

        console.log(
          `🔄 Will retry ${action.type} in ${Math.round((nextRetryAt - Date.now()) / 1000)}s`,
        );
      } else {
        // Max attempts reached
        await this.updateAction(action.id, {
          status: 'failed',
          attempts: action.attempts + 1,
          lastError: errorMessage,
          updatedAt: Date.now(),
        });

        console.error(`💀 ${action.type} failed permanently after ${action.maxAttempts} attempts`);
        this.executors.delete(action.id);
        this.emit('failed', { action, error: errorMessage });
        this.options.onSyncFailed?.(
          action,
          error instanceof Error ? error : new Error(errorMessage),
        );
      }

      this.notifyQueueChange();
      throw error;
    }
  }

  /**
   * Execute action with default API calls
   */
  private async executeDefaultAction(action: SyncAction): Promise<any> {
    const endpoints: Record<string, string> = {
      'order:create': '/api/orders',
      'order:update': `/api/orders/${action.data.id}`,
      'order:cancel': `/api/orders/${action.data.id}/cancel`,
      'order:status': `/api/orders/${action.data.id}/status`,
      'payment:create': '/api/payments',
      'payment:confirm': `/api/payments/confirm`,
      'location:update': '/api/driver/location',
      'rating:submit': '/api/ratings',
      'notification:register': '/api/notifications/device-token',
    };

    const endpoint = endpoints[action.type];
    if (!endpoint) {
      throw new Error(`No default endpoint for action type: ${action.type}`);
    }

    const methods: Record<ActionType, string> = {
      'order:create': 'POST',
      'order:update': 'PUT',
      'order:cancel': 'POST',
      'order:status': 'PUT',
      'payment:create': 'POST',
      'payment:confirm': 'POST',
      'location:update': 'PUT',
      'rating:submit': 'POST',
      'notification:register': 'POST',
      custom: 'POST',
    };

    const method = methods[action.type] ?? 'POST';

    // Si el payload trae idempotencyKey (ej. order:create offline), viaja
    // como header para que el replay post-reload no duplique en el server.
    const idempotencyKey = (action.data as any)?.idempotencyKey;
    const response = await apiFetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey) } : {}),
      },
      body: JSON.stringify(action.data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Calculate retry time with exponential backoff
   */
  private calculateRetryTime(attempt: number): number {
    const delay = Math.min(
      this.options.retryBaseDelay! * Math.pow(2, attempt - 1),
      this.options.maxRetryDelay!,
    );

    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Date.now() + delay + jitter;
  }

  /**
   * Get pending actions sorted by priority and retry time
   */
  private async getPendingActions(): Promise<SyncAction[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        const actions = request.result as SyncAction[];

        // Filter out actions not ready for retry
        const readyActions = actions.filter((action) => action.nextRetryAt <= Date.now());

        resolve(readyActions);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Sort actions by priority
   */
  private sortByPriority(actions: SyncAction[]): SyncAction[] {
    const priorityOrder: Record<SyncPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    return [...actions].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Update an action in the queue
   */
  private async updateAction(id: string, updates: Partial<SyncAction>): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const action = request.result;
        if (!action) {
          reject(new Error('Action not found'));
          return;
        }

        const updatedAction = { ...action, ...updates };
        const updateRequest = store.put(updatedAction);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cancel an action
   */
  async cancel(id: string): Promise<void> {
    await this.updateAction(id, {
      status: 'cancelled',
      updatedAt: Date.now(),
    });
    this.notifyQueueChange();
  }

  /**
   * Retry a failed action immediately
   */
  async retry(id: string): Promise<void> {
    await this.updateAction(id, {
      status: 'pending',
      nextRetryAt: Date.now(),
      updatedAt: Date.now(),
    });
    this.notifyQueueChange();

    if (this.isOnline()) {
      this.processQueue();
    }
  }

  /**
   * Clear all completed/failed actions. Resolves only after every status
   * cursor exhausts (the old code resolved when the 'cancelled' cursor
   * finished, undercounting or hanging when cursors finished out of order).
   */
  async clearCompleted(): Promise<number> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');

      let deletedCount = 0;
      const statuses = ['completed', 'failed', 'cancelled'];
      let remaining = statuses.length;

      statuses.forEach((status) => {
        const request = index.openCursor(status);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else if (--remaining === 0) {
            console.log(`🧹 Cleared ${deletedCount} completed actions`);
            this.notifyQueueChange();
            resolve(deletedCount);
          }
        };

        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<SyncQueueStats> {
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
        const actions = request.result as SyncAction[];

        const stats: SyncQueueStats = {
          total: actions.length,
          pending: actions.filter((a) => a.status === 'pending').length,
          syncing: actions.filter((a) => a.status === 'syncing').length,
          completed: actions.filter((a) => a.status === 'completed').length,
          failed: actions.filter((a) => a.status === 'failed').length,
          byPriority: {
            low: actions.filter((a) => a.priority === 'low').length,
            normal: actions.filter((a) => a.priority === 'normal').length,
            high: actions.filter((a) => a.priority === 'high').length,
            critical: actions.filter((a) => a.priority === 'critical').length,
          },
          byType: {},
        };

        // Count by type
        actions.forEach((action) => {
          const baseType = action.type.split(':')[0];
          stats.byType[baseType] = (stats.byType[baseType] || 0) + 1;
        });

        resolve(stats);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all actions in queue
   */
  async getAll(): Promise<SyncAction[]> {
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
        resolve(request.result as SyncAction[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  }

  /**
   * Subscribe to events
   */
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Notify queue change
   */
  private async notifyQueueChange(): Promise<void> {
    try {
      const stats = await this.getStats();
      this.emit('queueChange', stats);
      this.options.onQueueChange?.(stats);
    } catch (error) {
      console.error('Failed to get queue stats:', error);
    }
  }

  /**
   * Destroy the service
   */
  destroy(): void {
    this.stopPolling();
    this.listeners.clear();
  }
}

// Create singleton instance
export const backgroundSync = new BackgroundSyncService();

// Auto-initialize on import (client-side only)
if (typeof window !== 'undefined') {
  backgroundSync.initialize().catch(console.error);
}

export type { SyncQueueStats, BackgroundSyncOptions };
