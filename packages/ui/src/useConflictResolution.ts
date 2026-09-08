'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  conflictResolution,
  type Conflict,
  type ConflictStatus,
  type ConflictStrategy,
  type MergeAction,
  type VersionedData,
  type ConflictStats,
} from './conflict-resolution';

export type {
  Conflict,
  ConflictStatus,
  ConflictStrategy,
  MergeAction,
  VersionedData,
  ConflictStats,
};

interface UseConflictResolutionOptions {
  /** Filter by data type */
  dataType?: string;

  /** Filter by status */
  status?: ConflictStatus;

  /** Auto-refresh interval (ms) */
  refreshInterval?: number;

  /** Callback when conflict is detected */
  onConflict?: (conflict: Conflict) => void;

  /** Callback when conflict is resolved */
  onResolved?: (conflict: Conflict) => void;
}

interface UseConflictResolutionResult {
  /** All conflicts matching filters */
  conflicts: Conflict[];

  /** Pending conflicts count */
  pendingCount: number;

  /** Conflict statistics */
  stats: ConflictStats;

  /** Detect a conflict */
  detectConflict: <T>(
    dataId: string,
    dataType: string,
    local: VersionedData<T>,
    remote: VersionedData<T>,
  ) => Conflict<T> | null;

  /** Resolve a conflict */
  resolveConflict: <T>(conflictId: string, action: MergeAction, customData?: T) => Conflict<T>;

  /** Dismiss a conflict */
  dismissConflict: (conflictId: string) => void;

  /** Apply resolution strategy */
  applyStrategy: <T>(conflictId: string) => T;

  /** Clear resolved conflicts */
  clearResolved: () => number;

  /** Clear all conflicts */
  clearAll: () => void;

  /** Refresh conflicts */
  refresh: () => void;

  /** Whether there are pending conflicts */
  hasPendingConflicts: boolean;
}

export function useConflictResolution(
  options: UseConflictResolutionOptions = {},
): UseConflictResolutionResult {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [stats, setStats] = useState<ConflictStats>({
    total: 0,
    pending: 0,
    resolved: 0,
    dismissed: 0,
    byType: {},
    byStrategy: {
      'last-write-wins': 0,
      'first-write-wins': 0,
      manual: 0,
      'auto-merge': 0,
    },
  });

  const optionsRef = useRef(options);
  optionsRef.current = options;

  /**
   * Load conflicts
   */
  const loadConflicts = useCallback(() => {
    const loadedConflicts = conflictResolution.getConflicts({
      status: options.status,
      dataType: options.dataType,
    });
    setConflicts(loadedConflicts);
    setStats(conflictResolution.getStats());
  }, [options.status, options.dataType]);

  /**
   * Detect a conflict
   */
  const detectConflict = useCallback(
    <T>(
      dataId: string,
      dataType: string,
      local: VersionedData<T>,
      remote: VersionedData<T>,
    ): Conflict<T> | null => {
      const conflict = conflictResolution.detectConflict(dataId, dataType, local, remote);
      if (conflict) {
        loadConflicts();
        optionsRef.current.onConflict?.(conflict);
      }
      return conflict;
    },
    [loadConflicts],
  );

  /**
   * Resolve a conflict
   */
  const resolveConflict = useCallback(
    <T>(conflictId: string, action: MergeAction, customData?: T): Conflict<T> => {
      const resolved = conflictResolution.resolveConflict(conflictId, action, customData);
      loadConflicts();
      optionsRef.current.onResolved?.(resolved);
      return resolved;
    },
    [loadConflicts],
  );

  /**
   * Dismiss a conflict
   */
  const dismissConflict = useCallback(
    (conflictId: string) => {
      conflictResolution.dismissConflict(conflictId);
      loadConflicts();
    },
    [loadConflicts],
  );

  /**
   * Apply strategy
   */
  const applyStrategy = useCallback(<T>(conflictId: string): T => {
    return conflictResolution.applyStrategy<T>(conflictId);
  }, []);

  /**
   * Clear resolved
   */
  const clearResolved = useCallback((): number => {
    const count = conflictResolution.clearResolved();
    loadConflicts();
    return count;
  }, [loadConflicts]);

  /**
   * Clear all
   */
  const clearAll = useCallback(() => {
    conflictResolution.clearAll();
    loadConflicts();
  }, [loadConflicts]);

  // Initial load
  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  // Auto-refresh
  useEffect(() => {
    if (!options.refreshInterval) return;

    const interval = setInterval(loadConflicts, options.refreshInterval);
    return () => clearInterval(interval);
  }, [options.refreshInterval, loadConflicts]);

  // Listen for conflict events
  useEffect(() => {
    const unsubscribes = [
      conflictResolution.on('conflictDetected', () => loadConflicts()),
      conflictResolution.on('conflictResolved', () => loadConflicts()),
      conflictResolution.on('conflictDismissed', () => loadConflicts()),
    ];

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [loadConflicts]);

  return {
    conflicts,
    pendingCount: stats.pending,
    stats,
    detectConflict,
    resolveConflict,
    dismissConflict,
    applyStrategy,
    clearResolved,
    clearAll,
    refresh: loadConflicts,
    hasPendingConflicts: stats.pending > 0,
  };
}

/**
 * Hook for a specific conflict
 */
export function useConflict(conflictId: string | null) {
  const [conflict, setConflict] = useState<Conflict | null>(null);

  useEffect(() => {
    if (!conflictId) {
      setConflict(null);
      return;
    }

    const loadConflict = () => {
      const found = conflictResolution.getConflict(conflictId);
      setConflict(found || null);
    };

    loadConflict();

    const unsubscribes = [
      conflictResolution.on('conflictDetected', loadConflict),
      conflictResolution.on('conflictResolved', loadConflict),
      conflictResolution.on('conflictDismissed', loadConflict),
    ];

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [conflictId]);

  return conflict;
}

export type { UseConflictResolutionOptions, UseConflictResolutionResult };
