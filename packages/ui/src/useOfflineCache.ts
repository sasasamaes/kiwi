'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineCache, CACHE_EXPIRATION } from './offline-cache';

interface UseOfflineCacheOptions<T> {
  /** Cache key for storing the data */
  cacheKey: string;
  
  /** Function to fetch fresh data */
  fetchFn: () => Promise<T>;
  
  /** Cache type for expiration time */
  cacheType?: keyof typeof CACHE_EXPIRATION;
  
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  
  /** Refetch interval in milliseconds */
  refetchInterval?: number;
  
  /** Callback when data is fetched successfully */
  onSuccess?: (data: T, fromCache: boolean) => void;
  
  /** Callback when fetch fails */
  onError?: (error: Error) => void;
  
  /** Callback when cache is used */
  onCacheHit?: (data: T) => void;
  
  /** Stale time in milliseconds (serve stale while revalidating) */
  staleTime?: number;
  
  /** Enable/disable the query */
  enabled?: boolean;
}

interface UseOfflineCacheResult<T> {
  /** The cached/fetched data */
  data: T | null;
  
  /** Whether data is currently being fetched */
  isLoading: boolean;
  
  /** Whether data is being revalidated in the background */
  isRevalidating: boolean;
  
  /** Whether the data came from cache */
  fromCache: boolean;
  
  /** Whether the device is currently offline */
  isOffline: boolean;
  
  /** Whether the cache entry has expired */
  isStale: boolean;
  
  /** Error message if fetch failed */
  error: string | null;
  
  /** Manually refetch the data */
  refetch: () => Promise<void>;
  
  /** Manually update the cache */
  setCache: (data: T) => Promise<void>;
  
  /** Manually clear the cache */
  clearCache: () => Promise<void>;
  
  /** Last time data was fetched */
  lastFetched: Date | null;
  
  /** Time until cache expires */
  expiresAt: Date | null;
}

export function useOfflineCache<T>({
  cacheKey,
  fetchFn,
  cacheType = 'default',
  autoFetch = true,
  refetchInterval,
  onSuccess,
  onError,
  onCacheHit,
  staleTime = 0,
  enabled = true,
}: UseOfflineCacheOptions<T>): UseOfflineCacheResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  // Check if data is stale
  const isStale = expiresAt ? Date.now() > expiresAt.getTime() - staleTime : true;

  /**
   * Fetch data with cache fallback
   */
  const fetchData = useCallback(async (showLoading = true) => {
    if (!enabled) return;

    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRevalidating(true);
      }
      setError(null);

      // Try network first
      try {
        const freshData = await fetchFnRef.current();
        setData(freshData);
        setFromCache(false);
        setLastFetched(new Date());
        
        // Calculate expiration time
        const expirationTime = CACHE_EXPIRATION[cacheType] || CACHE_EXPIRATION.default;
        setExpiresAt(new Date(Date.now() + expirationTime));
        
        // Cache the fresh data
        await offlineCache.set(cacheKey, freshData, cacheType);
        
        onSuccess?.(freshData, false);
      } catch (fetchError) {
        // Network failed, try cache
        console.log(`🥝 Network failed for ${cacheKey}, trying cache...`);
        
        const cachedData = await offlineCache.get<T>(cacheKey);
        
        if (cachedData !== null) {
          setData(cachedData);
          setFromCache(true);
          onCacheHit?.(cachedData);
          onSuccess?.(cachedData, true);
        } else {
          throw fetchError;
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
      setIsRevalidating(false);
    }
  }, [cacheKey, cacheType, enabled, onSuccess, onError, onCacheHit, staleTime]);

  /**
   * Manually update the cache
   */
  const setCache = useCallback(async (newData: T) => {
    setData(newData);
    await offlineCache.set(cacheKey, newData, cacheType);
  }, [cacheKey, cacheType]);

  /**
   * Manually clear the cache
   */
  const clearCache = useCallback(async () => {
    setData(null);
    setLastFetched(null);
    setExpiresAt(null);
    await offlineCache.delete(cacheKey);
  }, [cacheKey]);

  /**
   * Auto-fetch on mount
   */
  useEffect(() => {
    if (autoFetch && enabled) {
      fetchData();
    }
  }, [autoFetch, enabled, fetchData]);

  /**
   * Set up refetch interval
   */
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(() => {
      fetchData(false); // Don't show loading state for background refetch
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchData]);

  /**
   * Listen for online/offline events
   */
  useEffect(() => {
    const handleOnline = () => {
      console.log('🥝 Back online, refetching data...');
      fetchData(false);
    };

    const handleOffline = () => {
      console.log('🥝 Gone offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData]);

  return {
    data,
    isLoading,
    isRevalidating,
    fromCache,
    isOffline,
    isStale,
    error,
    refetch: () => fetchData(),
    setCache,
    clearCache,
    lastFetched,
    expiresAt,
  };
}

/**
 * Hook specifically for traffic data with appropriate defaults
 */
export function useTrafficCache<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options?: Partial<UseOfflineCacheOptions<T>>
) {
  return useOfflineCache({
    cacheKey,
    fetchFn,
    cacheType: 'traffic',
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook for traffic predictions with longer cache
 */
export function useTrafficPredictionsCache<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options?: Partial<UseOfflineCacheOptions<T>>
) {
  return useOfflineCache({
    cacheKey,
    fetchFn,
    cacheType: 'predictions',
    refetchInterval: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
}

/**
 * Hook for traffic alerts with shorter cache
 */
export function useTrafficAlertsCache<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options?: Partial<UseOfflineCacheOptions<T>>
) {
  return useOfflineCache({
    cacheKey,
    fetchFn,
    cacheType: 'alerts',
    refetchInterval: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

export type { UseOfflineCacheOptions, UseOfflineCacheResult };
