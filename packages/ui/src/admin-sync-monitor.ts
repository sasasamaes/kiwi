// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * 🥝 KIWI - Admin Sync Monitoring Service
 *
 * Monitors offline data sync across all devices.
 * Provides real-time status for admin dashboard.
 */

const DB_NAME = 'kiwi-admin-sync';
const DB_VERSION = 1;
const STORE_NAME = 'device-sync';

export type DevicePlatform = 'ios' | 'android' | 'web' | 'pwa';
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'stale';
export type DeviceStatus = 'active' | 'idle' | 'offline';

export interface DeviceSyncInfo {
  deviceId: string;
  userId: string;
  userName: string;
  userType: 'merchant' | 'driver' | 'customer';
  platform: DevicePlatform;

  /** Sync status */
  syncStatus: SyncStatus;
  deviceStatus: DeviceStatus;

  /** Data counts */
  pendingOrders: number;
  pendingPayments: number;
  pendingSync: number;
  totalCached: number;

  /** Location */
  lastKnownLocation?: { lat: number; lng: number; address?: string };

  /** Network */
  connectionType: string;
  isOnline: boolean;

  /** Timestamps */
  lastSyncAt: number;
  lastSeenAt: number;
  registeredAt: number;

  /** Version */
  appVersion: string;
  syncVersion: string;
}

export interface SyncEvent {
  id: string;
  deviceId: string;
  eventType: 'sync_start' | 'sync_complete' | 'sync_error' | 'conflict' | 'offline_mode';
  data?: any;
  timestamp: number;
}

interface AdminSyncOptions {
  /** Refresh interval for dashboard (ms) */
  refreshInterval?: number;

  /** Stale threshold (ms) */
  staleThreshold?: number;

  /** Callback for real-time updates */
  onDeviceUpdate?: (device: DeviceSyncInfo) => void;

  /** Callback for sync events */
  onSyncEvent?: (event: SyncEvent) => void;
}

class AdminSyncMonitoringService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private options: AdminSyncOptions;
  private listeners: Map<string, Set<Function>> = new Map();
  private devices: Map<string, DeviceSyncInfo> = new Map();

  constructor(options: AdminSyncOptions = {}) {
    this.options = {
      refreshInterval: 5000,
      staleThreshold: 5 * 60 * 1000, // 5 minutes
      ...options,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'deviceId' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('userType', 'userType', { unique: false });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
        }
      };
    });
  }

  /**
   * Register or update device
   */
  async updateDevice(device: Partial<DeviceSyncInfo> & { deviceId: string }): Promise<void> {
    await this.initialize();

    const existing = this.devices.get(device.deviceId);
    const updated: DeviceSyncInfo = {
      ...existing,
      ...device,
      lastSeenAt: Date.now(),
    } as DeviceSyncInfo;

    this.devices.set(device.deviceId, updated);

    // Store in IndexedDB
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('DB not initialized'));
        return;
      }
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(updated);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all devices
   */
  async getDevices(filters?: {
    userType?: DeviceSyncInfo['userType'];
    syncStatus?: SyncStatus;
    platform?: DevicePlatform;
  }): Promise<DeviceSyncInfo[]> {
    let devices = Array.from(this.devices.values());

    if (filters) {
      if (filters.userType) devices = devices.filter((d) => d.userType === filters.userType);
      if (filters.syncStatus) devices = devices.filter((d) => d.syncStatus === filters.syncStatus);
      if (filters.platform) devices = devices.filter((d) => d.platform === filters.platform);
    }

    return devices.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<{
    totalDevices: number;
    activeDevices: number;
    offlineDevices: number;
    syncingDevices: number;
    errorDevices: number;
    staleDevices: number;
    totalPendingSync: number;
    totalPendingOrders: number;
    totalPendingPayments: number;
    byPlatform: Record<DevicePlatform, number>;
    byUserType: Record<string, number>;
    bySyncStatus: Record<SyncStatus, number>;
    recentEvents: SyncEvent[];
  }> {
    const devices = Array.from(this.devices.values());
    const now = Date.now();

    const stats = {
      totalDevices: devices.length,
      activeDevices: 0,
      offlineDevices: 0,
      syncingDevices: 0,
      errorDevices: 0,
      staleDevices: 0,
      totalPendingSync: 0,
      totalPendingOrders: 0,
      totalPendingPayments: 0,
      byPlatform: { ios: 0, android: 0, web: 0, pwa: 0 } as Record<DevicePlatform, number>,
      byUserType: {} as Record<string, number>,
      bySyncStatus: { synced: 0, syncing: 0, offline: 0, error: 0, stale: 0 } as Record<
        SyncStatus,
        number
      >,
      recentEvents: [] as SyncEvent[],
    };

    devices.forEach((device) => {
      // Count by status
      if (device.isOnline) stats.activeDevices++;
      else stats.offlineDevices++;

      if (device.syncStatus === 'syncing') stats.syncingDevices++;
      if (device.syncStatus === 'error') stats.errorDevices++;
      if (now - device.lastSeenAt > this.options.staleThreshold!) stats.staleDevices++;

      // Totals
      stats.totalPendingSync += device.pendingSync;
      stats.totalPendingOrders += device.pendingOrders;
      stats.totalPendingPayments += device.pendingPayments;

      // By platform
      stats.byPlatform[device.platform]++;

      // By user type
      stats.byUserType[device.userType] = (stats.byUserType[device.userType] || 0) + 1;

      // By sync status
      stats.bySyncStatus[device.syncStatus]++;
    });

    return stats;
  }

  /**
   * Log sync event
   */
  async logSyncEvent(event: Omit<SyncEvent, 'id' | 'timestamp'>): Promise<SyncEvent> {
    const syncEvent: SyncEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.emit('syncEvent', syncEvent);
    this.options.onSyncEvent?.(syncEvent);

    return syncEvent;
  }

  /**
   * Get device status color
   */
  getStatusColor(status: SyncStatus): string {
    const colors: Record<SyncStatus, string> = {
      synced: '#22c55e',
      syncing: '#3b82f6',
      offline: '#94a3b8',
      error: '#ef4444',
      stale: '#f59e0b',
    };
    return colors[status] || '#94a3b8';
  }

  /**
   * Format last seen
   */
  formatLastSeen(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)}h`;
    return new Date(timestamp).toLocaleDateString('es-CR');
  }

  private emit(event: string, data?: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) listeners.forEach((cb) => cb(data));
  }

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }
}

export const adminSyncMonitoring = new AdminSyncMonitoringService();

// Auto-initialize
if (typeof window !== 'undefined') {
  adminSyncMonitoring.initialize().catch(console.error);
}

export type { AdminSyncOptions };
