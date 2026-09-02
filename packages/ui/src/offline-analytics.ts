'use client';

/**
 * 🥝 KIWI - Offline Usage Analytics Service
 * 
 * Tracks offline usage patterns for business insights.
 * Stores analytics locally and syncs when online.
 */

import { offlineCache } from './offline-cache';
import { backgroundSync } from './background-sync';

const DB_NAME = 'kiwi-offline-analytics';
const DB_VERSION = 1;
const STORE_NAME = 'analytics';

export type AnalyticsEventType = 
  | 'offline:mode_entered'
  | 'offline:mode_exited'
  | 'offline:order_created'
  | 'offline:payment_processed'
  | 'offline:route_cached'
  | 'offline:data_synced'
  | 'offline:sync_failed'
  | 'offline:conflict_detected'
  | 'offline:conflict_resolved'
  | 'offline:cache_hit'
  | 'offline:cache_miss'
  | 'offline:network_changed'
  | 'offline:app_launched'
  | 'offline:feature_used';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  
  /** User info */
  userId: string;
  userType: 'merchant' | 'driver' | 'customer';
  
  /** Device info */
  deviceId: string;
  platform: string;
  
  /** Event data */
  data?: Record<string, any>;
  
  /** Location context */
  location?: { lat: number; lng: number };
  
  /** Network state at event time */
  networkState: {
    isOnline: boolean;
    connectionType: string;
    speed: string;
  };
  
  /** Timestamp */
  timestamp: number;
}

export interface OfflineUsageStats {
  /** Total offline time */
  totalOfflineTime: number;
  
  /** Offline sessions count */
  offlineSessions: number;
  
  /** Average offline session duration */
  avgOfflineSessionDuration: number;
  
  /** Peak offline hours */
  peakOfflineHours: Array<{ hour: number; count: number }>;
  
  /** Features used offline */
  offlineFeatureUsage: Record<string, number>;
  
  /** Offline orders created */
  offlineOrders: number;
  
  /** Offline payments processed */
  offlinePayments: number;
  
  /** Routes cached for offline */
  routesCached: number;
  
  /** Sync success rate */
  syncSuccessRate: number;
  
  /** Conflicts detected */
  conflictsDetected: number;
  
  /** Average sync time */
  avgSyncTime: number;
  
  /** Data saved (bytes) */
  dataSavedOffline: number;
  
  /** Network distribution */
  networkDistribution: Record<string, number>;
  
  /** Daily trends */
  dailyTrends: Array<{
    date: string;
    offlineTime: number;
    orders: number;
    payments: number;
    syncs: number;
  }>;
}

interface OfflineAnalyticsOptions {
  /** Auto-sync analytics when online */
  autoSync?: boolean;
  
  /** Retention period (ms) */
  retentionPeriod?: number;
  
  /** Max events to store */
  maxEvents?: number;
}

class OfflineAnalyticsService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private options: OfflineAnalyticsOptions;
  private offlineStartTime: number | null = null;
  private sessionEvents: AnalyticsEvent[] = [];

  constructor(options: OfflineAnalyticsOptions = {}) {
    this.options = {
      autoSync: true,
      retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxEvents: 10000,
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
        this.setupNetworkListeners();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Setup network listeners for offline tracking
   */
  private setupNetworkListeners(): void {
    window.addEventListener('offline', () => {
      this.offlineStartTime = Date.now();
      this.trackEvent('offline:mode_entered');
    });

    window.addEventListener('online', () => {
      if (this.offlineStartTime) {
        const duration = Date.now() - this.offlineStartTime;
        this.trackEvent('offline:mode_exited', { duration });
        this.offlineStartTime = null;
      }
    });
  }

  /**
   * Generate event ID
   */
  private generateId(): string {
    return `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current network state
   */
  private getNetworkState() {
    const conn = (navigator as any).connection;
    return {
      isOnline: navigator.onLine,
      connectionType: conn?.effectiveType || 'unknown',
      speed: conn?.downlink ? `${conn.downlink} Mbps` : 'unknown',
    };
  }

  /**
   * Track an analytics event
   */
  async trackEvent(
    type: AnalyticsEventType,
    data?: Record<string, any>,
    userId?: string,
    userType?: 'merchant' | 'driver' | 'customer'
  ): Promise<void> {
    await this.initialize();

    const event: AnalyticsEvent = {
      id: this.generateId(),
      type,
      userId: userId || 'anonymous',
      userType: userType || 'customer',
      deviceId: this.getDeviceId(),
      platform: navigator.platform,
      data,
      networkState: this.getNetworkState(),
      timestamp: Date.now(),
    };

    // Store locally
    await this.storeEvent(event);
    this.sessionEvents.push(event);

    // Sync if online and auto-sync enabled
    if (navigator.onLine && this.options.autoSync) {
      await backgroundSync.enqueue('custom', event, {
        priority: 'low',
        metadata: { type: 'analytics' },
      });
    }
  }

  /**
   * Get device ID
   */
  private getDeviceId(): string {
    if (typeof window === 'undefined') return 'server';
    
    let deviceId = localStorage.getItem('kiwi-device-id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('kiwi-device-id', deviceId);
    }
    return deviceId;
  }

  /**
   * Store event in IndexedDB
   */
  private async storeEvent(event: AnalyticsEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not initialized')); return; }
      
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(event);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get analytics stats
   */
  async getStats(days: number = 7): Promise<OfflineUsageStats> {
    await this.initialize();

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const events = await this.getEvents(cutoff);

    const stats: OfflineUsageStats = {
      totalOfflineTime: 0,
      offlineSessions: 0,
      avgOfflineSessionDuration: 0,
      peakOfflineHours: [],
      offlineFeatureUsage: {},
      offlineOrders: 0,
      offlinePayments: 0,
      routesCached: 0,
      syncSuccessRate: 0,
      conflictsDetected: 0,
      avgSyncTime: 0,
      dataSavedOffline: 0,
      networkDistribution: {},
      dailyTrends: [],
    };

    let offlineDurations: number[] = [];
    let syncTimes: number[] = [];
    let syncSuccesses = 0;
    let syncTotal = 0;

    events.forEach(event => {
      // Offline mode tracking
      if (event.type === 'offline:mode_entered') {
        stats.offlineSessions++;
      }
      if (event.type === 'offline:mode_exited' && event.data?.duration) {
        offlineDurations.push(event.data.duration);
        stats.totalOfflineTime += event.data.duration;
      }

      // Feature usage
      if (event.type === 'offline:feature_used' && event.data?.feature) {
        stats.offlineFeatureUsage[event.data.feature] = 
          (stats.offlineFeatureUsage[event.data.feature] || 0) + 1;
      }

      // Orders and payments
      if (event.type === 'offline:order_created') stats.offlineOrders++;
      if (event.type === 'offline:payment_processed') stats.offlinePayments++;
      if (event.type === 'offline:route_cached') stats.routesCached++;

      // Sync tracking
      if (event.type === 'offline:data_synced') {
        syncSuccesses++;
        syncTotal++;
        if (event.data?.duration) syncTimes.push(event.data.duration);
      }
      if (event.type === 'offline:sync_failed') syncTotal++;

      // Conflicts
      if (event.type === 'offline:conflict_detected') stats.conflictsDetected++;

      // Network distribution
      const network = event.networkState.connectionType;
      stats.networkDistribution[network] = (stats.networkDistribution[network] || 0) + 1;
    });

    // Calculate averages
    if (offlineDurations.length > 0) {
      stats.avgOfflineSessionDuration = offlineDurations.reduce((a, b) => a + b, 0) / offlineDurations.length;
    }
    if (syncTimes.length > 0) {
      stats.avgSyncTime = syncTimes.reduce((a, b) => a + b, 0) / syncTimes.length;
    }
    stats.syncSuccessRate = syncTotal > 0 ? (syncSuccesses / syncTotal) * 100 : 100;

    // Daily trends
    const dailyMap = new Map<string, { offlineTime: number; orders: number; payments: number; syncs: number }>();
    events.forEach(event => {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { offlineTime: 0, orders: 0, payments: 0, syncs: 0 });
      }
      const day = dailyMap.get(date)!;
      if (event.type === 'offline:order_created') day.orders++;
      if (event.type === 'offline:payment_processed') day.payments++;
      if (event.type === 'offline:data_synced') day.syncs++;
    });

    stats.dailyTrends = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return stats;
  }

  /**
   * Get events
   */
  private async getEvents(since: number): Promise<AnalyticsEvent[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not initialized')); return; }
      
      const tx = this.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.getAll(IDBKeyRange.lowerBound(since));
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Format duration
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Format bytes
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export const offlineAnalytics = new OfflineAnalyticsService();

// Auto-initialize
if (typeof window !== 'undefined') {
  offlineAnalytics.initialize().catch(console.error);
}

export type { OfflineAnalyticsOptions };
