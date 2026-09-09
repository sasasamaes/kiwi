'use client';

/**
 * 🥝 KIWI - Cache Warming Service
 *
 * Pre-loads critical data on app startup to ensure
 * instant availability even in offline mode.
 */

import { offlineCache, CACHE_EXPIRATION } from './offline-cache';

export type WarmPriority = 'critical' | 'high' | 'normal' | 'low';
export type WarmStatus = 'pending' | 'warming' | 'completed' | 'failed' | 'skipped';

export interface WarmTask {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Priority level */
  priority: WarmPriority;

  /** Function to fetch data */
  fetch: () => Promise<any>;

  /** Cache key for storing result */
  cacheKey: string;

  /** Cache type for expiration */
  cacheType: keyof typeof CACHE_EXPIRATION;

  /** Whether to skip if already cached */
  skipIfCached?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Retry attempts */
  retries?: number;

  /** Dependencies (other task IDs) */
  dependencies?: string[];

  /** Status */
  status: WarmStatus;

  /** Start time */
  startedAt?: number;

  /** End time */
  completedAt?: number;

  /** Error message if failed */
  error?: string;

  /** Result data */
  result?: any;
}

interface CacheWarmingOptions {
  /** Maximum concurrent warming tasks */
  maxConcurrent?: number;

  /** Default timeout for tasks (ms) */
  defaultTimeout?: number;

  /** Default retry attempts */
  defaultRetries?: number;

  /** Whether to log progress */
  verbose?: boolean;

  /** Callback when a task completes */
  onTaskComplete?: (task: WarmTask) => void;

  /** Callback when all tasks complete */
  onComplete?: (results: WarmTask[]) => void;

  /** Callback for progress updates */
  onProgress?: (completed: number, total: number) => void;
}

interface WarmProgress {
  /** Total tasks */
  total: number;

  /** Completed tasks */
  completed: number;

  /** Failed tasks */
  failed: number;

  /** Skipped tasks */
  skipped: number;

  /** Currently warming */
  inProgress: number;

  /** Overall status */
  status: 'idle' | 'warming' | 'completed';

  /** Start time */
  startedAt?: number;

  /** End time */
  completedAt?: number;

  /** Duration in ms */
  duration?: number;
}

class CacheWarmingService {
  private tasks: Map<string, WarmTask> = new Map();
  private progress: WarmProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    inProgress: 0,
    status: 'idle',
  };
  private options: CacheWarmingOptions;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(options: CacheWarmingOptions = {}) {
    this.options = {
      maxConcurrent: 3,
      defaultTimeout: 10000,
      defaultRetries: 2,
      verbose: true,
      ...options,
    };
  }

  /**
   * Register a warming task
   */
  register(task: Omit<WarmTask, 'status'>): void {
    if (this.tasks.has(task.id)) {
      console.warn(`🥝 Warming task '${task.id}' already registered — overwriting`);
    }
    this.tasks.set(task.id, {
      ...task,
      status: 'pending',
    });

    this.progress.total = this.tasks.size;

    if (this.options.verbose) {
      console.log(`🥝 Registered warming task: ${task.name} (${task.priority})`);
    }
  }

  /**
   * Register multiple tasks
   */
  registerMany(tasks: Array<Omit<WarmTask, 'status'>>): void {
    tasks.forEach((task) => this.register(task));
  }

  /**
   * Unregister a task
   */
  unregister(id: string): void {
    this.tasks.delete(id);
    this.progress.total = this.tasks.size;
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      inProgress: 0,
      status: 'idle',
    };
  }

  /**
   * Get tasks by priority
   */
  private getTasksByPriority(priority: WarmPriority): WarmTask[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.priority === priority && t.status === 'pending',
    );
  }

  /**
   * Check if task dependencies are met.
   * 'skipped' counts as satisfied: it means the data is already cached,
   * which is exactly what the dependent needs. Requiring only 'completed'
   * deadlocked dependents of skipIfCached tasks forever.
   */
  private areDependenciesMet(task: WarmTask): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every((depId) => {
      const dep = this.tasks.get(depId);
      return !!dep && (dep.status === 'completed' || dep.status === 'skipped');
    });
  }

  /**
   * Warm a single task
   */
  private async warmTask(task: WarmTask): Promise<any> {
    if (task.status !== 'pending') {
      return task.result;
    }

    // Check dependencies
    if (!this.areDependenciesMet(task)) {
      if (this.options.verbose) {
        console.log(`⏳ Waiting for dependencies: ${task.name}`);
      }
      return null;
    }

    // Check if already cached
    if (task.skipIfCached) {
      const cached = await offlineCache.get(task.cacheKey);
      if (cached !== null) {
        if (this.options.verbose) {
          console.log(`⏭️ Skipping (cached): ${task.name}`);
        }

        this.tasks.set(task.id, {
          ...task,
          status: 'skipped',
          result: cached,
        });

        this.progress.skipped++;
        this.emit('taskSkipped', task);
        return cached;
      }
    }

    // Start warming
    const startTime = Date.now();
    this.tasks.set(task.id, {
      ...task,
      status: 'warming',
      startedAt: startTime,
    });

    this.progress.inProgress++;
    this.emit('taskStarted', task);

    if (this.options.verbose) {
      console.log(`🔥 Warming: ${task.name}`);
    }

    try {
      // Create timeout promise (timer cleared on settle: otherwise it
      // fires after success and rejects unobserved).
      const timeout = task.timeout || this.options.defaultTimeout!;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout')), timeout);
      });

      // Create fetch promise with retries
      const fetchWithRetries = async (attempt: number): Promise<any> => {
        try {
          return await task.fetch();
        } catch (error) {
          if (attempt < (task.retries || this.options.defaultRetries!)) {
            if (this.options.verbose) {
              console.log(`🔄 Retry ${attempt + 1} for: ${task.name}`);
            }
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            return fetchWithRetries(attempt + 1);
          }
          throw error;
        }
      };

      // Race between fetch and timeout
      let result: any;
      try {
        result = await Promise.race([fetchWithRetries(0), timeoutPromise]);
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }

      // Cache the result
      await offlineCache.set(task.cacheKey, result, task.cacheType);

      // Mark as completed
      const completedTask: WarmTask = {
        ...task,
        status: 'completed',
        completedAt: Date.now(),
        result,
      };

      this.tasks.set(task.id, completedTask);
      this.progress.completed++;
      this.progress.inProgress--;

      this.emit('taskCompleted', completedTask);
      this.options.onTaskComplete?.(completedTask);

      const duration = Date.now() - startTime;
      if (this.options.verbose) {
        console.log(`✅ Warmed: ${task.name} (${duration}ms)`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark as failed
      const failedTask: WarmTask = {
        ...task,
        status: 'failed',
        completedAt: Date.now(),
        error: errorMessage,
      };

      this.tasks.set(task.id, failedTask);
      this.progress.failed++;
      this.progress.inProgress--;

      this.emit('taskFailed', failedTask);

      if (this.options.verbose) {
        console.error(`❌ Failed to warm: ${task.name} - ${errorMessage}`);
      }

      return null;
    }
  }

  /**
   * Warm all registered tasks
   */
  async warmAll(): Promise<WarmProgress> {
    if (this.progress.status === 'warming') {
      if (this.options.verbose) {
        console.log('⚠️ Warming already in progress');
      }
      return this.progress;
    }

    // Reset progress AND failed tasks: statuses persist on the task
    // objects, so without this a retry run would find zero 'pending'
    // tasks and silently do nothing. Completed/skipped stay as-is.
    for (const [id, task] of this.tasks) {
      if (task.status === 'failed') {
        this.tasks.set(id, { ...task, status: 'pending', error: undefined });
      }
    }

    this.progress = {
      total: this.tasks.size,
      completed: 0,
      failed: 0,
      skipped: 0,
      inProgress: 0,
      status: 'warming',
      startedAt: Date.now(),
    };

    this.emit('warmingStarted');

    if (this.options.verbose) {
      console.log(`🚀 Starting cache warming (${this.tasks.size} tasks)`);
    }

    // Process tasks by priority order
    const priorityOrder: WarmPriority[] = ['critical', 'high', 'normal', 'low'];

    for (const priority of priorityOrder) {
      const tasks = this.getTasksByPriority(priority);

      if (tasks.length === 0) continue;

      if (this.options.verbose) {
        console.log(`📋 Processing ${priority} priority tasks (${tasks.length})`);
      }

      // Process tasks with concurrency limit
      const chunks = this.chunkArray(tasks, this.options.maxConcurrent!);

      for (const chunk of chunks) {
        await Promise.all(chunk.map((task) => this.warmTask(task)));

        // Report progress
        this.options.onProgress?.(
          this.progress.completed + this.progress.failed + this.progress.skipped,
          this.progress.total,
        );
      }
    }

    // Complete
    this.progress.status = 'completed';
    this.progress.completedAt = Date.now();
    this.progress.duration = this.progress.completedAt - this.progress.startedAt!;

    this.emit('warmingCompleted');
    this.options.onComplete?.(Array.from(this.tasks.values()));

    if (this.options.verbose) {
      console.log(`🎉 Cache warming completed in ${this.progress.duration}ms`);
      console.log(`   ✅ Completed: ${this.progress.completed}`);
      console.log(`   ⏭️ Skipped: ${this.progress.skipped}`);
      console.log(`   ❌ Failed: ${this.progress.failed}`);
    }

    return this.progress;
  }

  /**
   * Get current progress
   */
  getProgress(): WarmProgress {
    return { ...this.progress };
  }

  /**
   * Get task status
   */
  getTask(id: string): WarmTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getTasks(): WarmTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
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
export const cacheWarming = new CacheWarmingService({
  verbose: process.env.NODE_ENV === 'development',
});

export type { CacheWarmingOptions, WarmProgress };
