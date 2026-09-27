// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * 🥝 KIWI - Offline Cache Service for Traffic Features
 *
 * Provides intelligent caching for traffic data to ensure the app works
 * in areas with poor internet connectivity (like rural Nicoya).
 *
 * Uses IndexedDB for persistent storage with automatic expiration.
 */

import { apiFetch } from './api-client';

const DB_NAME = 'kiwi-traffic-cache';
const DB_VERSION = 1;
const STORE_NAME = 'traffic-data';

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
  traffic: 5 * 60 * 1000, // 5 minutes for real-time traffic
  predictions: 30 * 60 * 1000, // 30 minutes for predictions
  alerts: 2 * 60 * 1000, // 2 minutes for alerts
  history: 60 * 60 * 1000, // 1 hour for historical data
  suggestions: 10 * 60 * 1000, // 10 minutes for route suggestions
  default: 15 * 60 * 1000, // 15 minutes default
};

interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  type: string;
  metadata?: Record<string, any>;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  entriesByType: Record<string, number>;
}

class OfflineCacheService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available (server-side)'));
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('🥝 IndexedDB cache initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('🥝 Created IndexedDB store:', STORE_NAME);
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get a cached value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry: CacheEntry<T> | undefined = request.result;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if entry has expired
        if (Date.now() > entry.expiresAt) {
          console.log(`🥝 Cache expired for key: ${key}`);
          this.delete(key).catch((err) => console.error('Failed to delete expired entry:', err));
          resolve(null);
          return;
        }

        console.log(`🥝 Cache hit for key: ${key}`);
        resolve(entry.data);
      };

      request.onerror = () => {
        console.error('Failed to get from cache:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Store a value in the cache
   */
  async set<T = any>(
    key: string,
    data: T,
    type: string = 'default',
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const expirationTime =
        CACHE_EXPIRATION[type as keyof typeof CACHE_EXPIRATION] || CACHE_EXPIRATION.default;

      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + expirationTime,
        type,
        metadata,
      };

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => {
        console.log(`🥝 Cached data for key: ${key} (expires in ${expirationTime / 1000}s)`);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to set cache:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a cached value
   */
  async delete(key: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        console.log(`🥝 Deleted cache entry: ${key}`);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete from cache:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
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
        console.log('🥝 Cleared all cache entries');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear cache:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
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
        const entries: CacheEntry[] = request.result || [];

        const stats: CacheStats = {
          totalEntries: entries.length,
          totalSize: JSON.stringify(entries).length,
          oldestEntry:
            entries.length > 0 ? new Date(Math.min(...entries.map((e) => e.timestamp))) : null,
          newestEntry:
            entries.length > 0 ? new Date(Math.max(...entries.map((e) => e.timestamp))) : null,
          entriesByType: {},
        };

        // Count entries by type
        entries.forEach((entry) => {
          stats.entriesByType[entry.type] = (stats.entriesByType[entry.type] || 0) + 1;
        });

        resolve(stats);
      };

      request.onerror = () => {
        console.error('Failed to get cache stats:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<number> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          const entry: CacheEntry = cursor.value;

          if (Date.now() > entry.expiresAt) {
            cursor.delete();
            deletedCount++;
          }

          cursor.continue();
        } else {
          console.log(`🥝 Cleaned up ${deletedCount} expired cache entries`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('Failed to cleanup cache:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Fetch with cache fallback
   * Tries to fetch from network first, falls back to cache if offline
   */
  async fetchWithCache<T = any>(
    url: string,
    cacheKey: string,
    cacheType: string = 'default',
    options?: RequestInit,
  ): Promise<{ data: T; fromCache: boolean }> {
    // Try network first (absolute URL + auth via apiFetch)
    try {
      const response = await apiFetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Cache the successful response
      await this.set(cacheKey, data, cacheType, {
        url,
        status: response.status,
      });

      return { data, fromCache: false };
    } catch (error) {
      console.log(`🥝 Network request failed for ${url}, trying cache...`);

      // Try cache fallback
      const cachedData = await this.get<T>(cacheKey);

      if (cachedData !== null) {
        console.log(`🥝 Serving from cache: ${cacheKey}`);
        return { data: cachedData, fromCache: true };
      }

      // Re-throw the error if no cache available
      throw error;
    }
  }

  /**
   * Check if we're online
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  /**
   * Get cached data regardless of expiration (for offline use)
   */
  async getStale<T = any>(key: string): Promise<T | null> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry: CacheEntry<T> | undefined = request.result;
        resolve(entry?.data || null);
      };

      request.onerror = () => {
        console.error('Failed to get stale cache:', request.error);
        reject(request.error);
      };
    });
  }
}

// Create singleton instance
export const offlineCache = new OfflineCacheService();

// Auto-initialize on import (client-side only, once even across HMR re-imports)
if (typeof window !== 'undefined') {
  offlineCache.initialize().catch(console.error);

  const g = globalThis as any;
  if (!g.__kiwiCacheCleanupTimer) {
    // Run cleanup every 5 minutes
    g.__kiwiCacheCleanupTimer = setInterval(
      () => {
        offlineCache.cleanup().catch(console.error);
      },
      5 * 60 * 1000,
    );
  }
}

// Export types and utilities
export type { CacheEntry, CacheStats };
export { CACHE_EXPIRATION };

/**
 * Higher-order function to add offline caching to any async function
 */
export function withOfflineCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    cacheKey: (args: Parameters<T>) => string;
    cacheType?: string;
    staleWhileRevalidate?: boolean;
  },
): T {
  return (async (...args: Parameters<T>) => {
    const key = options.cacheKey(args);

    // Try to get fresh data
    try {
      const result = await fn(...args);

      // Cache the result
      await offlineCache.set(key, result, options.cacheType || 'default');

      return result;
    } catch (error) {
      // If network fails, try cache
      if (options.staleWhileRevalidate) {
        const staleData = await offlineCache.getStale(key);
        if (staleData !== null) {
          console.log(`🥝 Serving stale data for: ${key}`);
          return staleData;
        }
      }

      throw error;
    }
  }) as T;
}
