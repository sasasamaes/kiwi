// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * 🥝 KIWI - Sync Progress Service
 *
 * Tracks and reports sync progress across the app.
 * Provides real-time updates on data synchronization status.
 */

export type SyncOperation = 'upload' | 'download' | 'both';
export type SyncProgressStatus = 'idle' | 'syncing' | 'completed' | 'failed' | 'paused';

export interface SyncProgressItem {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Operation type */
  operation: SyncOperation;

  /** Status */
  status: SyncProgressStatus;

  /** Progress percentage (0-100) */
  progress: number;

  /** Bytes transferred */
  transferred: number;

  /** Total bytes */
  total: number;

  /** Transfer speed (bytes per second) */
  speed: number;

  /** Estimated time remaining (ms) */
  estimatedRemaining: number;

  /** Start timestamp */
  startedAt: number;

  /** End timestamp */
  completedAt?: number;

  /** Error message if failed */
  error?: string;

  /** Metadata */
  metadata?: Record<string, any>;
}

interface SyncProgressState {
  /** All sync items */
  items: Map<string, SyncProgressItem>;

  /** Overall status */
  status: SyncProgressStatus;

  /** Overall progress (0-100) */
  overallProgress: number;

  /** Total items */
  totalItems: number;

  /** Completed items */
  completedItems: number;

  /** Failed items */
  failedItems: number;

  /** Active items */
  activeItems: number;

  /** Total bytes transferred */
  totalTransferred: number;

  /** Total bytes */
  totalBytes: number;

  /** Overall speed (bytes per second) */
  overallSpeed: number;

  /** Overall estimated time remaining (ms) */
  estimatedRemaining: number;

  /** Start timestamp */
  startedAt?: number;

  /** Last update timestamp */
  lastUpdateAt: number;
}

interface SyncProgressOptions {
  /** Update interval for progress (ms) */
  updateInterval?: number;

  /** Callback for progress updates */
  onProgress?: (state: SyncProgressState) => void;

  /** Callback when sync completes */
  onComplete?: (state: SyncProgressState) => void;

  /** Callback when sync fails */
  onFailed?: (item: SyncProgressItem, error: string) => void;

  /** Callback when item completes */
  onItemComplete?: (item: SyncProgressItem) => void;

  /** Enable speed calculation */
  enableSpeedCalculation?: boolean;

  /** Speed calculation window (ms) */
  speedCalculationWindow?: number;
}

class SyncProgressService {
  private state: SyncProgressState;
  private options: SyncProgressOptions;
  private updateTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private speedHistory: Map<string, Array<{ timestamp: number; bytes: number }>> = new Map();

  constructor(options: SyncProgressOptions = {}) {
    this.options = {
      updateInterval: 100,
      enableSpeedCalculation: true,
      speedCalculationWindow: 5000,
      ...options,
    };

    this.state = {
      items: new Map(),
      status: 'idle',
      overallProgress: 0,
      totalItems: 0,
      completedItems: 0,
      failedItems: 0,
      activeItems: 0,
      totalTransferred: 0,
      totalBytes: 0,
      overallSpeed: 0,
      estimatedRemaining: 0,
      lastUpdateAt: Date.now(),
    };
  }

  /**
   * Start tracking a sync operation
   */
  startSync(
    id: string,
    name: string,
    operation: SyncOperation,
    totalBytes: number = 0,
    metadata?: Record<string, any>,
  ): SyncProgressItem {
    const item: SyncProgressItem = {
      id,
      name,
      operation,
      status: 'syncing',
      progress: 0,
      transferred: 0,
      total: totalBytes,
      speed: 0,
      estimatedRemaining: 0,
      startedAt: Date.now(),
      metadata,
    };

    this.state.items.set(id, item);
    this.updateState();
    this.startUpdateTimer();

    this.emit('syncStarted', item);
    return item;
  }

  /**
   * Update progress for a sync item
   */
  updateProgress(id: string, transferred: number, total?: number): void {
    const item = this.state.items.get(id);
    if (!item) return;

    // Update transferred bytes
    const previousTransferred = item.transferred;
    item.transferred = transferred;

    // Update total if provided
    if (total !== undefined) {
      item.total = total;
    }

    // Calculate progress
    if (item.total > 0) {
      item.progress = Math.min(100, (transferred / item.total) * 100);
    }

    // Calculate speed
    if (this.options.enableSpeedCalculation) {
      const now = Date.now();
      const history = this.speedHistory.get(id) || [];

      history.push({ timestamp: now, bytes: transferred });

      // Keep only recent history
      const windowStart = now - this.options.speedCalculationWindow!;
      const recentHistory = history.filter((h) => h.timestamp >= windowStart);
      this.speedHistory.set(id, recentHistory);

      // Calculate speed from recent history
      if (recentHistory.length >= 2) {
        const first = recentHistory[0];
        const last = recentHistory[recentHistory.length - 1];
        const timeDiff = (last.timestamp - first.timestamp) / 1000;
        const bytesDiff = last.bytes - first.bytes;

        if (timeDiff > 0) {
          item.speed = bytesDiff / timeDiff;
        }
      }
    }

    // Estimate remaining time
    if (item.speed > 0 && item.total > 0) {
      const remaining = item.total - item.transferred;
      item.estimatedRemaining = (remaining / item.speed) * 1000;
    }

    this.updateState();
    this.emit('syncProgress', item);
  }

  /**
   * Mark a sync item as completed
   */
  completeSync(id: string): void {
    const item = this.state.items.get(id);
    if (!item) return;

    item.status = 'completed';
    item.progress = 100;
    item.completedAt = Date.now();
    item.estimatedRemaining = 0;

    // Clean up speed history
    this.speedHistory.delete(id);

    this.updateState();
    this.emit('syncCompleted', item);
    this.options.onItemComplete?.(item);

    // Check if all items complete
    this.checkAllComplete();
  }

  /**
   * Mark a sync item as failed
   */
  failSync(id: string, error: string): void {
    const item = this.state.items.get(id);
    if (!item) return;

    item.status = 'failed';
    item.error = error;
    item.completedAt = Date.now();
    item.estimatedRemaining = 0;

    // Clean up speed history
    this.speedHistory.delete(id);

    this.updateState();
    this.emit('syncFailed', { item, error });
    this.options.onFailed?.(item, error);

    // Check if all items complete
    this.checkAllComplete();
  }

  /**
   * Pause a sync item
   */
  pauseSync(id: string): void {
    const item = this.state.items.get(id);
    if (!item || item.status !== 'syncing') return;

    item.status = 'paused';
    this.updateState();
    this.emit('syncPaused', item);
  }

  /**
   * Resume a sync item
   */
  resumeSync(id: string): void {
    const item = this.state.items.get(id);
    if (!item || item.status !== 'paused') return;

    item.status = 'syncing';
    item.startedAt = Date.now(); // Reset start time for speed calculation
    this.updateState();
    this.emit('syncResumed', item);
  }

  /**
   * Cancel a sync item
   */
  cancelSync(id: string): void {
    const item = this.state.items.get(id);
    if (!item) return;

    item.status = 'failed';
    item.error = 'Cancelled by user';
    item.completedAt = Date.now();
    item.estimatedRemaining = 0;

    this.speedHistory.delete(id);
    this.updateState();
    this.emit('syncCancelled', item);

    this.checkAllComplete();
  }

  /**
   * Get current progress for an item
   */
  getProgress(id: string): SyncProgressItem | undefined {
    return this.state.items.get(id);
  }

  /**
   * Get overall state
   */
  getState(): SyncProgressState {
    return { ...this.state };
  }

  /**
   * Get overall progress percentage
   */
  getOverallProgress(): number {
    return this.state.overallProgress;
  }

  /**
   * Check if all items are complete
   */
  private checkAllComplete(): void {
    const allComplete = Array.from(this.state.items.values()).every(
      (item) => item.status === 'completed' || item.status === 'failed',
    );

    if (allComplete && this.state.items.size > 0) {
      this.state.status = this.state.failedItems > 0 ? 'failed' : 'completed';
      this.stopUpdateTimer();
      this.emit('syncAllComplete', this.state);
      this.options.onComplete?.(this.state);
    }
  }

  /**
   * Update overall state
   */
  private updateState(): void {
    const items = Array.from(this.state.items.values());

    this.state.totalItems = items.length;
    this.state.completedItems = items.filter((i) => i.status === 'completed').length;
    this.state.failedItems = items.filter((i) => i.status === 'failed').length;
    this.state.activeItems = items.filter((i) => i.status === 'syncing').length;
    this.state.totalTransferred = items.reduce((sum, i) => sum + i.transferred, 0);
    this.state.totalBytes = items.reduce((sum, i) => sum + i.total, 0);
    this.state.lastUpdateAt = Date.now();

    // Calculate overall progress
    if (this.state.totalBytes > 0) {
      this.state.overallProgress = (this.state.totalTransferred / this.state.totalBytes) * 100;
    } else if (this.state.totalItems > 0) {
      this.state.overallProgress = (this.state.completedItems / this.state.totalItems) * 100;
    }

    // Calculate overall speed
    this.state.overallSpeed = items.reduce((sum, i) => sum + i.speed, 0);

    // Calculate overall estimated remaining
    if (this.state.overallSpeed > 0) {
      const remaining = this.state.totalBytes - this.state.totalTransferred;
      this.state.estimatedRemaining = (remaining / this.state.overallSpeed) * 1000;
    }

    // Update status
    if (this.state.activeItems > 0) {
      this.state.status = 'syncing';
    } else if (this.state.completedItems > 0 || this.state.failedItems > 0) {
      this.state.status = this.state.failedItems > 0 ? 'failed' : 'completed';
    } else {
      this.state.status = 'idle';
    }

    // Set start time on first sync
    if (!this.state.startedAt && this.state.status === 'syncing') {
      this.state.startedAt = Date.now();
    }

    this.emit('stateChanged', this.state);
    this.options.onProgress?.(this.state);
  }

  /**
   * Start update timer
   */
  private startUpdateTimer(): void {
    if (this.updateTimer) return;

    this.updateTimer = setInterval(() => {
      this.updateState();
    }, this.options.updateInterval);
  }

  /**
   * Stop update timer
   */
  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Reset all progress
   */
  reset(): void {
    this.stopUpdateTimer();
    this.speedHistory.clear();

    this.state = {
      items: new Map(),
      status: 'idle',
      overallProgress: 0,
      totalItems: 0,
      completedItems: 0,
      failedItems: 0,
      activeItems: 0,
      totalTransferred: 0,
      totalBytes: 0,
      overallSpeed: 0,
      estimatedRemaining: 0,
      lastUpdateAt: Date.now(),
    };

    this.emit('stateReset');
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
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format speed to human readable
   */
  formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 B/s';

    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));

    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Format time to human readable
   */
  formatTime(ms: number): string {
    if (ms <= 0) return 'Completado';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

// Create singleton instance
export const syncProgress = new SyncProgressService();

export type { SyncProgressState, SyncProgressOptions };
