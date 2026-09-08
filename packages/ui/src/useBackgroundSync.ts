'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  backgroundSync,
  type SyncAction,
  type SyncQueueStats,
  type SyncPriority,
  type ActionType,
} from './background-sync';

interface UseBackgroundSyncOptions {
  /** Auto-process queue on mount */
  autoProcess?: boolean;

  /** Poll interval for queue stats (ms) */
  pollInterval?: number;

  /** Callback when action is enqueued */
  onEnqueued?: (action: SyncAction) => void;

  /** Callback when action completes */
  onSyncComplete?: (action: SyncAction, result: any) => void;

  /** Callback when action fails */
  onSyncFailed?: (action: SyncAction, error: Error) => void;

  /** Callback when queue changes */
  onQueueChange?: (stats: SyncQueueStats) => void;
}

interface UseBackgroundSyncResult {
  /** Queue statistics */
  stats: SyncQueueStats | null;

  /** Whether sync is in progress */
  isSyncing: boolean;

  /** Whether device is online */
  isOnline: boolean;

  /** Enqueue a new action */
  enqueue: <T>(
    type: ActionType,
    data: T,
    options?: {
      priority?: SyncPriority;
      execute?: (data: T) => Promise<any>;
    },
  ) => Promise<SyncAction<T>>;

  /** Manually process the queue */
  processQueue: () => Promise<void>;

  /** Cancel an action */
  cancel: (id: string) => Promise<void>;

  /** Retry a failed action */
  retry: (id: string) => Promise<void>;

  /** Clear completed actions */
  clearCompleted: () => Promise<number>;

  /** Get all actions */
  getAllActions: () => Promise<SyncAction[]>;

  /** Last synced action */
  lastSyncedAction: SyncAction | null;

  /** Last error */
  lastError: Error | null;
}

export function useBackgroundSync(options: UseBackgroundSyncOptions = {}): UseBackgroundSyncResult {
  const [stats, setStats] = useState<SyncQueueStats | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncedAction, setLastSyncedAction] = useState<SyncAction | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  /**
   * Load queue stats
   */
  const loadStats = useCallback(async () => {
    try {
      const newStats = await backgroundSync.getStats();
      setStats(newStats);
      optionsRef.current.onQueueChange?.(newStats);
    } catch (error) {
      console.error('Failed to load sync stats:', error);
    }
  }, []);

  /**
   * Enqueue an action
   */
  const enqueue = useCallback(
    async <T>(
      type: ActionType,
      data: T,
      actionOptions?: {
        priority?: SyncPriority;
        execute?: (data: T) => Promise<any>;
      },
    ): Promise<SyncAction<T>> => {
      const action = await backgroundSync.enqueue(type, data, actionOptions);
      optionsRef.current.onEnqueued?.(action);
      await loadStats();
      return action;
    },
    [loadStats],
  );

  /**
   * Process the queue
   */
  const processQueue = useCallback(async () => {
    await backgroundSync.processQueue();
    await loadStats();
  }, [loadStats]);

  /**
   * Cancel an action
   */
  const cancel = useCallback(
    async (id: string) => {
      await backgroundSync.cancel(id);
      await loadStats();
    },
    [loadStats],
  );

  /**
   * Retry a failed action
   */
  const retry = useCallback(
    async (id: string) => {
      await backgroundSync.retry(id);
      await loadStats();
    },
    [loadStats],
  );

  /**
   * Clear completed actions
   */
  const clearCompleted = useCallback(async () => {
    const count = await backgroundSync.clearCompleted();
    await loadStats();
    return count;
  }, [loadStats]);

  /**
   * Get all actions
   */
  const getAllActions = useCallback(async () => {
    return backgroundSync.getAll();
  }, []);

  useEffect(() => {
    // Set up network listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    // Set up sync listeners
    const unsubscribes = [
      backgroundSync.on('syncStart', () => setIsSyncing(true)),
      backgroundSync.on('syncEnd', () => setIsSyncing(false)),
      backgroundSync.on('synced', ({ action, result }) => {
        setLastSyncedAction(action);
        optionsRef.current.onSyncComplete?.(action, result);
        loadStats();
      }),
      backgroundSync.on('failed', ({ action, error }) => {
        setLastError(error);
        optionsRef.current.onSyncFailed?.(action, error);
        loadStats();
      }),
      backgroundSync.on('queueChange', (newStats) => {
        setStats(newStats);
      }),
    ];

    // Initial load
    loadStats();

    // Set up polling
    const pollInterval = setInterval(loadStats, options.pollInterval || 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribes.forEach((unsub) => unsub());
      clearInterval(pollInterval);
    };
  }, [loadStats, options.pollInterval]);

  return {
    stats,
    isSyncing,
    isOnline,
    enqueue,
    processQueue,
    cancel,
    retry,
    clearCompleted,
    getAllActions,
    lastSyncedAction,
    lastError,
  };
}

/**
 * Hook specifically for order sync with appropriate defaults
 */
export function useOrderSync() {
  return useBackgroundSync({
    pollInterval: 3000,
  });
}

/**
 * Hook for location updates (high frequency)
 */
export function useLocationSync() {
  const { enqueue, ...rest } = useBackgroundSync({
    pollInterval: 2000,
  });

  const updateLocation = useCallback(
    async (location: { lat: number; lng: number }) => {
      return enqueue('location:update', location, {
        priority: 'low',
      });
    },
    [enqueue],
  );

  return {
    updateLocation,
    ...rest,
  };
}

/**
 * Hook for payment sync (critical priority)
 */
export function usePaymentSync() {
  return useBackgroundSync({
    pollInterval: 1000,
  });
}

export type { UseBackgroundSyncOptions, UseBackgroundSyncResult };
export type { SyncQueueStats, SyncAction };
