// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * 🥝 KIWI - Unified Cache Service
 *
 * Integrates compression, cache warming, and offline storage
 * into a single cohesive system for optimal performance.
 */

import { compression, type CompressedData } from './compression';
import { apiFetch } from './api-client';
import { cacheWarming, WarmTask } from './cache-warming';
import { offlineCache } from './offline-cache';

// ============================================
// 📊 CACHE STATISTICS
// ============================================

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  compressedSize: number;
  compressionRatio: number;
  hitRate: number;
  missRate: number;
  lastWarmed: number | null;
  warmingStatus: 'idle' | 'warming' | 'completed';
}

// ============================================
// 🔧 UNIFIED CACHE SERVICE
// ============================================

class UnifiedCacheService {
  private stats: CacheStats = {
    totalEntries: 0,
    totalSize: 0,
    compressedSize: 0,
    compressionRatio: 0,
    hitRate: 0,
    missRate: 0,
    lastWarmed: null,
    warmingStatus: 'idle',
  };

  private hitCount = 0;
  private missCount = 0;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.setupDefaultTasks();
  }

  // ============================================
  // 📥 GET/SET WITH COMPRESSION
  // ============================================

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await offlineCache.get(key);

      if (!raw) {
        this.missCount++;
        this.updateHitRate();
        return null;
      }

      this.hitCount++;
      this.updateHitRate();

      // Check if data is compressed
      const data = raw as any;
      if (data && data.compressed && data.algorithm) {
        // Decompress (already returns the parsed object, no extra JSON.parse)
        return compression.decompress<T>(data as CompressedData);
      }

      return raw as T;
    } catch (error) {
      console.error(`Cache get error for ${key}:`, error);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    options: {
      compress?: boolean;
      ttl?: number;
      priority?: 'critical' | 'high' | 'normal' | 'low';
    } = {},
  ): Promise<void> {
    try {
      const { compress = true, ttl, priority = 'normal' } = options;

      let dataToStore: any = value;

      // Compress if enabled and data is large enough.
      // Pass value directly: compression.compress already stringifies once.
      if (compress) {
        const compressed = compression.compress(value);

        if (compressed.compressed) {
          dataToStore = {
            data: compressed.data,
            compressed: true,
            algorithm: compressed.algorithm,
            originalSize: compressed.originalSize,
            compressedSize: compressed.compressedSize,
            ratio: compressed.ratio,
          };
        }
      }

      // Store in offline cache. Third param is the cache TYPE (expiration
      // preset), not a TTL — passing String(ttl) polluted the type index
      // with values like "5000"/"undefined" and silently ignored TTL.
      const prior = await offlineCache.get(key).catch(() => undefined);
      await offlineCache.set(key, dataToStore, 'default');

      // Update stats (dedupe: only count new keys)
      if (prior == null) this.stats.totalEntries++;
      this.stats.totalSize += JSON.stringify(value).length;
      if (dataToStore.compressed) {
        this.stats.compressedSize += dataToStore.compressedSize;
        this.updateCompressionRatio();
      }
    } catch (error) {
      console.error(`Cache set error for ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    await offlineCache.delete(key);
    this.stats.totalEntries = Math.max(0, this.stats.totalEntries - 1);
  }

  async clear(): Promise<void> {
    await offlineCache.clear();
    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      hitRate: 0,
      missRate: 0,
      lastWarmed: null,
      warmingStatus: 'idle',
    };
    this.hitCount = 0;
    this.missCount = 0;
  }

  // ============================================
  // 🚀 CACHE WARMING INTEGRATION
  // ============================================

  private setupDefaultTasks() {
    // Critical: Current traffic data
    cacheWarming.register({
      id: 'traffic-current',
      name: 'Tráfico actual',
      priority: 'critical',
      fetch: async () => {
        const response = await apiFetch('/api/routing/traffic');
        return response.json();
      },
      cacheKey: 'traffic:current',
      cacheType: 'traffic',
      skipIfCached: true,
      timeout: 5000,
    });

    // Critical: Merchant profile
    cacheWarming.register({
      id: 'merchant-profile',
      name: 'Perfil del comerciante',
      priority: 'critical',
      fetch: async () => {
        const response = await apiFetch('/api/merchants/me');
        return response.json();
      },
      cacheKey: 'merchant:profile',
      cacheType: 'default',
      skipIfCached: true,
      timeout: 5000,
    });

    // High: Traffic predictions
    cacheWarming.register({
      id: 'traffic-predictions',
      name: 'Predicciones de tráfico',
      priority: 'high',
      fetch: async () => {
        const response = await apiFetch('/api/routing/traffic/eta');
        return response.json();
      },
      cacheKey: 'traffic:predictions',
      cacheType: 'predictions',
      skipIfCached: true,
      timeout: 8000,
    });

    // High: Traffic alerts
    cacheWarming.register({
      id: 'traffic-alerts',
      name: 'Alertas de tráfico',
      priority: 'high',
      fetch: async () => {
        const response = await apiFetch('/api/routing/alerts');
        return response.json();
      },
      cacheKey: 'traffic:alerts',
      cacheType: 'alerts',
      skipIfCached: true,
      timeout: 5000,
    });

    // Normal: Route suggestions
    cacheWarming.register({
      id: 'route-suggestions',
      name: 'Sugerencias de ruta',
      priority: 'normal',
      fetch: async () => {
        // Will be populated with actual routes
        return [];
      },
      cacheKey: 'routes:suggestions',
      cacheType: 'suggestions',
      skipIfCached: false,
      timeout: 10000,
    });

    // Normal: Available drivers
    cacheWarming.register({
      id: 'available-drivers',
      name: 'Repartidores disponibles',
      priority: 'normal',
      fetch: async () => {
        const response = await apiFetch('/api/drivers/available');
        return response.json();
      },
      cacheKey: 'drivers:available',
      cacheType: 'default',
      skipIfCached: false,
      timeout: 5000,
    });
  }

  /**
   * Warm cache on app startup
   */
  async warmCache(): Promise<void> {
    this.stats.warmingStatus = 'warming';
    this.emit('warming:start');

    try {
      await cacheWarming.warmAll();
      this.stats.lastWarmed = Date.now();
      this.stats.warmingStatus = 'completed';
      this.emit('warming:complete');
    } catch (error) {
      console.error('Cache warming failed:', error);
      this.stats.warmingStatus = 'idle';
      this.emit('warming:error', error);
    }
  }

  // ============================================
  // 📊 STATS & MONITORING
  // ============================================

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateHitRate() {
    const total = this.hitCount + this.missCount;
    this.stats.hitRate = total > 0 ? this.hitCount / total : 0;
    this.stats.missRate = total > 0 ? this.missCount / total : 0;
  }

  private updateCompressionRatio() {
    if (this.stats.totalSize > 0) {
      this.stats.compressionRatio = 1 - this.stats.compressedSize / this.stats.totalSize;
    }
  }

  // ============================================
  // 🔔 EVENT SYSTEM
  // ============================================

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Event listener error for ${event}:`, error);
      }
    });
  }

  // ============================================
  // 🧹 CLEANUP
  // ============================================

  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cleaned = await offlineCache.cleanup();
    this.stats.totalEntries = Math.max(0, this.stats.totalEntries - cleaned);
    return cleaned;
  }

  /**
   * Get storage estimate
   */
  async getStorageEstimate(): Promise<{
    used: number;
    available: number;
    percentage: number;
  }> {
    if (typeof navigator !== 'undefined' && 'storage' in navigator) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          available: estimate.quota || 0,
          percentage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0,
        };
      } catch {
        return { used: 0, available: 0, percentage: 0 };
      }
    }
    return { used: 0, available: 0, percentage: 0 };
  }
}

// Export singleton
export const unifiedCache = new UnifiedCacheService();

// Export React hook
export function useUnifiedCache() {
  return {
    get: unifiedCache.get.bind(unifiedCache),
    set: unifiedCache.set.bind(unifiedCache),
    delete: unifiedCache.delete.bind(unifiedCache),
    clear: unifiedCache.clear.bind(unifiedCache),
    warmCache: unifiedCache.warmCache.bind(unifiedCache),
    getStats: unifiedCache.getStats.bind(unifiedCache),
    cleanup: unifiedCache.cleanup.bind(unifiedCache),
    on: unifiedCache.on.bind(unifiedCache),
  };
}
