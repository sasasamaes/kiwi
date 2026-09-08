'use client';

/**
 * 🥝 KIWI - Conflict Resolution Service
 *
 * Handles concurrent edits when multiple users modify the same data
 * while offline, then sync when reconnected.
 */

export type ConflictStrategy = 'last-write-wins' | 'first-write-wins' | 'manual' | 'auto-merge';
export type ConflictStatus = 'pending' | 'resolved' | 'dismissed';
export type MergeAction = 'keep-local' | 'keep-remote' | 'merge' | 'custom';

export interface VersionedData<T = any> {
  /** Unique identifier */
  id: string;

  /** Data payload */
  data: T;

  /** Version number (incremented on each edit) */
  version: number;

  /** Timestamp of last edit */
  lastModified: number;

  /** User who made the edit */
  editedBy: string;

  /** Device ID where edit was made */
  deviceId: string;

  /** Checksum for integrity verification */
  checksum: string;

  /** Parent version (for conflict detection) */
  parentVersion?: number;
}

export interface Conflict<T = any> {
  /** Unique conflict identifier */
  id: string;

  /** Data ID with conflict */
  dataId: string;

  /** Data type (order, menu, etc.) */
  dataType: string;

  /** Local version */
  local: VersionedData<T>;

  /** Remote version */
  remote: VersionedData<T>;

  /** Resolution strategy */
  strategy: ConflictStrategy;

  /** Status */
  status: ConflictStatus;

  /** Created timestamp */
  createdAt: number;

  /** Resolved timestamp */
  resolvedAt?: number;

  /** Resolution result */
  resolution?: {
    action: MergeAction;
    mergedData?: T;
    resolvedBy?: string;
  };

  /** Auto-merge result (if auto-merge was used) */
  autoMergeResult?: T;
}

interface ConflictResolutionOptions {
  /** Default conflict strategy */
  defaultStrategy?: ConflictStrategy;

  /** Fields to ignore when comparing (timestamps, etc.) */
  ignoreFields?: string[];

  /** Callback when conflict is detected */
  onConflict?: (conflict: Conflict) => void;

  /** Callback when conflict is resolved */
  onResolved?: (conflict: Conflict) => void;

  /** Enable auto-merge for simple conflicts */
  enableAutoMerge?: boolean;

  /** Maximum conflicts to auto-resolve */
  maxAutoResolve?: number;
}

interface ConflictStats {
  total: number;
  pending: number;
  resolved: number;
  dismissed: number;
  byType: Record<string, number>;
  byStrategy: Record<ConflictStrategy, number>;
}

class ConflictResolutionService {
  private conflicts: Map<string, Conflict> = new Map();
  private options: ConflictResolutionOptions;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(options: ConflictResolutionOptions = {}) {
    this.options = {
      defaultStrategy: 'last-write-wins',
      ignoreFields: ['updatedAt', 'syncStatus', 'checksum'],
      enableAutoMerge: true,
      maxAutoResolve: 10,
      ...options,
    };
  }

  /**
   * Generate checksum for data integrity
   */
  private generateChecksum(data: any): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get device ID (generate if not exists)
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
   * Create a versioned data object
   */
  createVersion<T>(
    id: string,
    data: T,
    version: number = 1,
    editedBy: string = 'anonymous',
  ): VersionedData<T> {
    return {
      id,
      data,
      version,
      lastModified: Date.now(),
      editedBy,
      deviceId: this.getDeviceId(),
      checksum: this.generateChecksum(data),
    };
  }

  /**
   * Compare two versions of data
   */
  private compareVersions<T>(
    local: VersionedData<T>,
    remote: VersionedData<T>,
  ): {
    hasConflict: boolean;
    changedFields: string[];
    identical: boolean;
  } {
    const localData = local.data as any;
    const remoteData = remote.data as any;

    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(localData), ...Object.keys(remoteData)]);

    for (const key of allKeys) {
      // Skip ignored fields
      if (this.options.ignoreFields?.includes(key)) continue;

      const localValue = JSON.stringify(localData[key]);
      const remoteValue = JSON.stringify(remoteData[key]);

      if (localValue !== remoteValue) {
        changedFields.push(key);
      }
    }

    // Check if both modified from same parent
    const bothModifiedFromSameParent =
      local.parentVersion !== undefined &&
      remote.parentVersion !== undefined &&
      local.parentVersion === remote.parentVersion;

    // Check if one is ancestor of other
    const isAncestor = local.version < remote.version || remote.version < local.version;

    const hasConflict = changedFields.length > 0 && !isAncestor;
    const identical = changedFields.length === 0;

    return {
      hasConflict,
      changedFields,
      identical,
    };
  }

  /**
   * Detect conflict between local and remote versions
   */
  detectConflict<T>(
    dataId: string,
    dataType: string,
    local: VersionedData<T>,
    remote: VersionedData<T>,
  ): Conflict<T> | null {
    // Check if versions are the same
    if (local.version === remote.version && local.checksum === remote.checksum) {
      return null; // No conflict
    }

    // Check if remote is newer (no conflict, just update)
    if (remote.version > local.version && remote.lastModified > local.lastModified) {
      // Check if local has uncommitted changes
      const localModifiedAfterParent =
        local.parentVersion !== undefined && local.lastModified > (local.parentVersion || 0);

      if (!localModifiedAfterParent) {
        return null; // Remote is newer, no conflict
      }
    }

    // Compare versions
    const comparison = this.compareVersions(local, remote);

    if (comparison.identical) {
      return null; // Same data, no conflict
    }

    if (!comparison.hasConflict) {
      return null; // One is ancestor, no conflict
    }

    // Create conflict
    const conflict: Conflict<T> = {
      id: `conflict_${dataId}_${Date.now()}`,
      dataId,
      dataType,
      local,
      remote,
      strategy: this.options.defaultStrategy!,
      status: 'pending',
      createdAt: Date.now(),
    };

    // Try auto-merge if enabled
    if (this.options.enableAutoMerge) {
      const autoMergeResult = this.tryAutoMerge(local.data, remote.data, comparison.changedFields);
      if (autoMergeResult !== null) {
        conflict.autoMergeResult = autoMergeResult;
      }
    }

    // Store conflict
    this.conflicts.set(conflict.id, conflict);

    // Notify listeners
    this.emit('conflictDetected', conflict);
    this.options.onConflict?.(conflict);

    return conflict;
  }

  /**
   * Try to auto-merge non-conflicting fields
   */
  private tryAutoMerge<T>(local: T, remote: T, changedFields: string[]): T | null {
    try {
      const localData = local as any;
      const remoteData = remote as any;
      const merged = { ...localData };

      // For each changed field, check if we can auto-merge
      for (const field of changedFields) {
        const localValue = localData[field];
        const remoteValue = remoteData[field];

        // If field is an array, merge arrays
        if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
          merged[field] = this.mergeArrays(localValue, remoteValue);
        }
        // If field is an object, deep merge
        else if (
          typeof localValue === 'object' &&
          localValue !== null &&
          typeof remoteValue === 'object' &&
          remoteValue !== null &&
          !Array.isArray(localValue)
        ) {
          merged[field] = this.deepMerge(localValue, remoteValue);
        }
        // Otherwise, can't auto-merge
        else {
          return null;
        }
      }

      return merged as T;
    } catch (error) {
      console.error('Auto-merge failed:', error);
      return null;
    }
  }

  /**
   * Merge two arrays (union by id or index)
   */
  private mergeArrays<T>(local: T[], remote: T[]): T[] {
    const result = [...local];
    const localIds = new Set(local.map((item: any) => item.id || JSON.stringify(item)));

    for (const item of remote) {
      const itemId = (item as any).id || JSON.stringify(item);
      if (!localIds.has(itemId)) {
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends Record<string, any>>(local: T, remote: T): T {
    const result = { ...local } as Record<string, any>;

    for (const key of Object.keys(remote)) {
      if (
        typeof remote[key] === 'object' &&
        remote[key] !== null &&
        typeof local[key] === 'object' &&
        local[key] !== null &&
        !Array.isArray(remote[key])
      ) {
        result[key] = this.deepMerge(local[key], remote[key]);
      } else {
        result[key] = remote[key];
      }
    }

    return result as T;
  }

  /**
   * Resolve a conflict
   */
  resolveConflict<T>(conflictId: string, action: MergeAction, customData?: T): Conflict<T> {
    const conflict = this.conflicts.get(conflictId) as Conflict<T>;

    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    let mergedData: T;

    switch (action) {
      case 'keep-local':
        mergedData = conflict.local.data;
        break;

      case 'keep-remote':
        mergedData = conflict.remote.data;
        break;

      case 'merge':
        if (conflict.autoMergeResult) {
          mergedData = conflict.autoMergeResult;
        } else {
          throw new Error('No auto-merge result available');
        }
        break;

      case 'custom':
        if (!customData) {
          throw new Error('Custom data required for custom resolution');
        }
        mergedData = customData;
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Update conflict
    const resolvedConflict: Conflict<T> = {
      ...conflict,
      status: 'resolved',
      resolvedAt: Date.now(),
      resolution: {
        action,
        mergedData,
        resolvedBy: this.getDeviceId(),
      },
    };

    this.conflicts.set(conflictId, resolvedConflict);

    // Notify listeners
    this.emit('conflictResolved', resolvedConflict);
    this.options.onResolved?.(resolvedConflict);

    return resolvedConflict;
  }

  /**
   * Apply resolution strategy
   */
  applyStrategy<T>(conflictId: string): T {
    const conflict = this.conflicts.get(conflictId) as Conflict<T>;

    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    switch (conflict.strategy) {
      case 'last-write-wins':
        return conflict.local.lastModified > conflict.remote.lastModified
          ? conflict.local.data
          : conflict.remote.data;

      case 'first-write-wins':
        return conflict.local.lastModified < conflict.remote.lastModified
          ? conflict.local.data
          : conflict.remote.data;

      case 'manual':
        throw new Error('Manual resolution required');

      case 'auto-merge':
        if (conflict.autoMergeResult) {
          return conflict.autoMergeResult;
        }
        throw new Error('Auto-merge not available');

      default:
        throw new Error(`Unknown strategy: ${conflict.strategy}`);
    }
  }

  /**
   * Dismiss a conflict (keep current version)
   */
  dismissConflict(conflictId: string): void {
    const conflict = this.conflicts.get(conflictId);

    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    const dismissedConflict = {
      ...conflict,
      status: 'dismissed' as ConflictStatus,
      resolvedAt: Date.now(),
    };

    this.conflicts.set(conflictId, dismissedConflict);
    this.emit('conflictDismissed', dismissedConflict);
  }

  /**
   * Get all conflicts
   */
  getConflicts(filters?: {
    status?: ConflictStatus;
    dataType?: string;
    strategy?: ConflictStrategy;
  }): Conflict[] {
    let conflicts = Array.from(this.conflicts.values());

    if (filters) {
      if (filters.status) {
        conflicts = conflicts.filter((c) => c.status === filters.status);
      }
      if (filters.dataType) {
        conflicts = conflicts.filter((c) => c.dataType === filters.dataType);
      }
      if (filters.strategy) {
        conflicts = conflicts.filter((c) => c.strategy === filters.strategy);
      }
    }

    return conflicts.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): Conflict[] {
    return this.getConflicts({ status: 'pending' });
  }

  /**
   * Get a single conflict
   */
  getConflict(conflictId: string): Conflict | undefined {
    return this.conflicts.get(conflictId);
  }

  /**
   * Get conflict statistics
   */
  getStats(): ConflictStats {
    const conflicts = Array.from(this.conflicts.values());

    const stats: ConflictStats = {
      total: conflicts.length,
      pending: conflicts.filter((c) => c.status === 'pending').length,
      resolved: conflicts.filter((c) => c.status === 'resolved').length,
      dismissed: conflicts.filter((c) => c.status === 'dismissed').length,
      byType: {},
      byStrategy: {
        'last-write-wins': 0,
        'first-write-wins': 0,
        manual: 0,
        'auto-merge': 0,
      },
    };

    // Count by type
    conflicts.forEach((conflict) => {
      stats.byType[conflict.dataType] = (stats.byType[conflict.dataType] || 0) + 1;
    });

    // Count by strategy
    conflicts.forEach((conflict) => {
      stats.byStrategy[conflict.strategy]++;
    });

    return stats;
  }

  /**
   * Clear resolved conflicts
   */
  clearResolved(): number {
    const resolved = this.getConflicts({ status: 'resolved' });
    const dismissed = this.getConflicts({ status: 'dismissed' });

    [...resolved, ...dismissed].forEach((conflict) => {
      this.conflicts.delete(conflict.id);
    });

    return resolved.length + dismissed.length;
  }

  /**
   * Clear all conflicts
   */
  clearAll(): void {
    this.conflicts.clear();
    this.emit('conflictsCleared');
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
}

// Create singleton instance
export const conflictResolution = new ConflictResolutionService();

export type { ConflictResolutionOptions, ConflictStats };
