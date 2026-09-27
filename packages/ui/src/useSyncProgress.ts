// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  syncProgress,
  type SyncProgressItem,
  type SyncProgressState,
  type SyncOperation,
} from './sync-progress';

interface UseSyncProgressOptions {
  /** Auto-refresh interval (ms) */
  refreshInterval?: number;

  /** Callback for progress updates */
  onProgress?: (state: SyncProgressState) => void;

  /** Callback when sync completes */
  onComplete?: (state: SyncProgressState) => void;

  /** Callback when sync fails */
  onFailed?: (item: SyncProgressItem, error: string) => void;
}

interface UseSyncProgressResult {
  /** Current sync state */
  state: SyncProgressState;

  /** Whether sync is in progress */
  isSyncing: boolean;

  /** Overall progress percentage */
  overallProgress: number;

  /** Active items count */
  activeCount: number;

  /** Completed items count */
  completedCount: number;

  /** Failed items count */
  failedCount: number;

  /** Total items count */
  totalCount: number;

  /** Overall speed */
  speed: string;

  /** Estimated time remaining */
  estimatedTime: string;

  /** Start tracking a sync operation */
  startSync: (
    id: string,
    name: string,
    operation: SyncOperation,
    totalBytes?: number,
    metadata?: Record<string, any>,
  ) => SyncProgressItem;

  /** Update progress for an item */
  updateProgress: (id: string, transferred: number, total?: number) => void;

  /** Complete a sync item */
  completeSync: (id: string) => void;

  /** Fail a sync item */
  failSync: (id: string, error: string) => void;

  /** Cancel a sync item */
  cancelSync: (id: string) => void;

  /** Get progress for a specific item */
  getItem: (id: string) => SyncProgressItem | undefined;

  /** Get all items */
  getItems: () => SyncProgressItem[];

  /** Reset all progress */
  reset: () => void;

  /** Formatted overall progress */
  formattedProgress: string;

  /** Formatted total transferred */
  formattedTransferred: string;

  /** Formatted total bytes */
  formattedTotal: string;
}

export function useSyncProgress(options: UseSyncProgressOptions = {}): UseSyncProgressResult {
  const [state, setState] = useState<SyncProgressState>(syncProgress.getState());

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Update state from service
  useEffect(() => {
    const updateState = () => {
      setState(syncProgress.getState());
    };

    const unsubscribes = [
      syncProgress.on('stateChanged', updateState),
      syncProgress.on('syncStarted', () => {
        updateState();
      }),
      syncProgress.on('syncProgress', () => {
        updateState();
      }),
      syncProgress.on('syncCompleted', (item) => {
        updateState();
        optionsRef.current.onComplete?.(syncProgress.getState());
      }),
      syncProgress.on('syncFailed', ({ item, error }) => {
        updateState();
        optionsRef.current.onFailed?.(item, error);
      }),
      syncProgress.on('syncAllComplete', (state) => {
        optionsRef.current.onComplete?.(state);
      }),
    ];

    // Initial state
    updateState();

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, []);

  // Periodic refresh for speed updates
  useEffect(() => {
    const interval = setInterval(() => {
      setState(syncProgress.getState());
    }, options.refreshInterval || 1000);

    return () => clearInterval(interval);
  }, [options.refreshInterval]);

  // Derived values
  const isSyncing = state.status === 'syncing';
  const overallProgress = state.overallProgress;
  const activeCount = state.activeItems;
  const completedCount = state.completedItems;
  const failedCount = state.failedItems;
  const totalCount = state.totalItems;

  // Formatted values
  const speed = syncProgress.formatSpeed(state.overallSpeed);
  const estimatedTime = syncProgress.formatTime(state.estimatedRemaining);
  const formattedProgress = `${Math.round(overallProgress)}%`;
  const formattedTransferred = syncProgress.formatBytes(state.totalTransferred);
  const formattedTotal = syncProgress.formatBytes(state.totalBytes);

  // Actions
  const startSync = useCallback(
    (
      id: string,
      name: string,
      operation: SyncOperation,
      totalBytes?: number,
      metadata?: Record<string, any>,
    ) => {
      return syncProgress.startSync(id, name, operation, totalBytes, metadata);
    },
    [],
  );

  const updateProgress = useCallback((id: string, transferred: number, total?: number) => {
    syncProgress.updateProgress(id, transferred, total);
  }, []);

  const completeSync = useCallback((id: string) => {
    syncProgress.completeSync(id);
  }, []);

  const failSync = useCallback((id: string, error: string) => {
    syncProgress.failSync(id, error);
  }, []);

  const cancelSync = useCallback((id: string) => {
    syncProgress.cancelSync(id);
  }, []);

  const getItem = useCallback((id: string) => {
    return syncProgress.getProgress(id);
  }, []);

  const getItems = useCallback(() => {
    return Array.from(syncProgress.getState().items.values());
  }, []);

  const reset = useCallback(() => {
    syncProgress.reset();
  }, []);

  return {
    state,
    isSyncing,
    overallProgress,
    activeCount,
    completedCount,
    failedCount,
    totalCount,
    speed,
    estimatedTime,
    startSync,
    updateProgress,
    completeSync,
    failSync,
    cancelSync,
    getItem,
    getItems,
    reset,
    formattedProgress,
    formattedTransferred,
    formattedTotal,
  };
}

/**
 * Hook for tracking a single sync operation
 */
export function useSingleSyncProgress(id: string) {
  const { getItem, updateProgress, completeSync, failSync, cancelSync } = useSyncProgress();
  const item = getItem(id);

  const start = useCallback(
    (
      name: string,
      operation: SyncOperation,
      totalBytes?: number,
      metadata?: Record<string, any>,
    ) => {
      return syncProgress.startSync(id, name, operation, totalBytes, metadata);
    },
    [id],
  );

  return {
    item,
    isSyncing: item?.status === 'syncing',
    progress: item?.progress || 0,
    speed: item ? syncProgress.formatSpeed(item.speed) : '0 B/s',
    estimatedTime: item ? syncProgress.formatTime(item.estimatedRemaining) : '',
    start,
    update: (transferred: number, total?: number) => updateProgress(id, transferred, total),
    complete: () => completeSync(id),
    fail: (error: string) => failSync(id, error),
    cancel: () => cancelSync(id),
  };
}

export type { UseSyncProgressOptions, UseSyncProgressResult };
export type { SyncProgressItem, SyncProgressState, SyncOperation };
