'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheWarming, type WarmTask, type WarmProgress, type WarmPriority } from './cache-warming';

interface UseCacheWarmingOptions {
  /** Auto-start warming on mount */
  autoStart?: boolean;

  /** Callback when warming completes */
  onComplete?: (progress: WarmProgress) => void;

  /** Callback for progress updates */
  onProgress?: (completed: number, total: number) => void;

  /** Callback when a task completes */
  onTaskComplete?: (task: WarmTask) => void;
}

interface UseCacheWarmingResult {
  /** Current progress */
  progress: WarmProgress;

  /** Whether warming is in progress */
  isWarming: boolean;

  /** Whether warming is complete */
  isComplete: boolean;

  /** Start warming */
  startWarming: () => Promise<WarmProgress>;

  /** Register a warming task */
  registerTask: (task: Omit<WarmTask, 'status'>) => void;

  /** Register multiple tasks */
  registerTasks: (tasks: Array<Omit<WarmTask, 'status'>>) => void;

  /** Get task status */
  getTask: (id: string) => WarmTask | undefined;

  /** All tasks */
  tasks: WarmTask[];

  /** Progress percentage */
  progressPercent: number;

  /** Elapsed time in ms */
  elapsedTime: number;

  /** Estimated time remaining in ms */
  estimatedRemaining: number;
}

export function useCacheWarming(options: UseCacheWarmingOptions = {}): UseCacheWarmingResult {
  const [progress, setProgress] = useState<WarmProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    inProgress: 0,
    status: 'idle',
  });
  const [tasks, setTasks] = useState<WarmTask[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Update progress from service
  useEffect(() => {
    const updateProgress = () => {
      setProgress(cacheWarming.getProgress());
      setTasks(cacheWarming.getTasks());
    };

    const unsubscribes = [
      cacheWarming.on('taskStarted', updateProgress),
      cacheWarming.on('taskCompleted', (task) => {
        updateProgress();
        optionsRef.current.onTaskComplete?.(task);
      }),
      cacheWarming.on('taskFailed', updateProgress),
      cacheWarming.on('taskSkipped', updateProgress),
      cacheWarming.on('warmingStarted', updateProgress),
      cacheWarming.on('warmingCompleted', (tasks) => {
        updateProgress();
        optionsRef.current.onComplete?.(cacheWarming.getProgress());
      }),
    ];

    // Initial update
    updateProgress();

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, []);

  // Timer for elapsed time
  useEffect(() => {
    if (progress.status !== 'warming' || !progress.startedAt) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - progress.startedAt!);
    }, 100);

    return () => clearInterval(interval);
  }, [progress.status, progress.startedAt]);

  // Calculate progress percentage
  const progressPercent =
    progress.total > 0
      ? ((progress.completed + progress.failed + progress.skipped) / progress.total) * 100
      : 0;

  // Calculate estimated time remaining
  const estimatedRemaining =
    progress.completed > 0 && progress.startedAt
      ? (elapsedTime / progress.completed) *
        (progress.total - progress.completed - progress.inProgress)
      : 0;

  // Start warming
  const startWarming = useCallback(async (): Promise<WarmProgress> => {
    return cacheWarming.warmAll();
  }, []);

  // Register a task
  const registerTask = useCallback((task: Omit<WarmTask, 'status'>) => {
    cacheWarming.register(task);
    setTasks(cacheWarming.getTasks());
  }, []);

  // Register multiple tasks
  const registerTasks = useCallback((tasks: Array<Omit<WarmTask, 'status'>>) => {
    cacheWarming.registerMany(tasks);
    setTasks(cacheWarming.getTasks());
  }, []);

  // Get a task
  const getTask = useCallback((id: string) => {
    return cacheWarming.getTask(id);
  }, []);

  // Auto-start on mount
  useEffect(() => {
    if (options.autoStart && progress.status === 'idle' && progress.total > 0) {
      startWarming();
    }
  }, [options.autoStart, progress.status, progress.total, startWarming]);

  return {
    progress,
    isWarming: progress.status === 'warming',
    isComplete: progress.status === 'completed',
    startWarming,
    registerTask,
    registerTasks,
    getTask,
    tasks,
    progressPercent,
    elapsedTime,
    estimatedRemaining,
  };
}

/**
 * Hook for default Kiwi cache warming tasks
 */
export function useKiwiCacheWarming(options: UseCacheWarmingOptions = {}) {
  const warming = useCacheWarming(options);

  useEffect(() => {
    // Register default Kiwi tasks
    warming.registerTasks([
      {
        id: 'traffic-current',
        name: 'Tráfico actual',
        priority: 'critical',
        fetch: async () => {
          const response = await fetch('/api/routing/traffic?lat=10.1483&lng=-85.4527');
          return response.json();
        },
        cacheKey: 'traffic-current-nicoya',
        cacheType: 'traffic',
        skipIfCached: true,
        timeout: 5000,
      },
      {
        id: 'traffic-predictions',
        name: 'Predicciones de tráfico',
        priority: 'high',
        fetch: async () => {
          const response = await fetch('/api/routing/predictions/hourly?lat=10.1483&lng=-85.4527');
          return response.json();
        },
        cacheKey: 'traffic-predictions-nicoya',
        cacheType: 'predictions',
        skipIfCached: true,
        timeout: 8000,
      },
      {
        id: 'traffic-alerts',
        name: 'Alertas de tráfico',
        priority: 'high',
        fetch: async () => {
          const response = await fetch('/api/routing/alerts?lat=10.1483&lng=-85.4527');
          return response.json();
        },
        cacheKey: 'traffic-alerts-nicoya',
        cacheType: 'alerts',
        skipIfCached: true,
        timeout: 5000,
      },
      {
        id: 'route-suggestions',
        name: 'Sugerencias de ruta',
        priority: 'normal',
        fetch: async () => {
          const response = await fetch('/api/routing/suggestions?lat=10.1483&lng=-85.4527');
          return response.json();
        },
        cacheKey: 'route-suggestions-nicoya',
        cacheType: 'suggestions',
        skipIfCached: true,
        timeout: 8000,
      },
      {
        id: 'traffic-history',
        name: 'Historial de tráfico',
        priority: 'normal',
        fetch: async () => {
          const response = await fetch('/api/routing/history?period=week');
          return response.json();
        },
        cacheKey: 'traffic-history-week',
        cacheType: 'history',
        skipIfCached: true,
        timeout: 10000,
      },
      {
        id: 'merchant-profile',
        name: 'Perfil del comerciante',
        priority: 'critical',
        fetch: async () => {
          const response = await fetch('/api/merchants/me');
          return response.json();
        },
        cacheKey: 'merchant-profile',
        cacheType: 'default',
        skipIfCached: true,
        timeout: 5000,
      },
      {
        id: 'driver-location',
        name: 'Ubicación del repartidor',
        priority: 'low',
        fetch: async () => {
          // This would be the driver's current location
          return { lat: 10.1483, lng: -85.4527 };
        },
        cacheKey: 'driver-location',
        cacheType: 'default',
        skipIfCached: false,
        timeout: 2000,
      },
    ]);
  }, []);

  return warming;
}

/**
 * Hook for showing cache warming progress UI
 */
export function useCacheWarmingProgress() {
  const { progress, isWarming, isComplete, elapsedTime, estimatedRemaining } = useCacheWarming();

  const getStatusMessage = (): string => {
    if (isComplete) {
      return '¡Datos listos!';
    }

    if (isWarming) {
      if (progress.inProgress > 0) {
        return `Cargando ${progress.inProgress} elemento${progress.inProgress > 1 ? 's' : ''}...`;
      }
      return 'Preparando datos...';
    }

    return 'Inicializando...';
  };

  const getProgressMessage = (): string => {
    if (progress.total === 0) return '';

    const completed = progress.completed + progress.failed + progress.skipped;
    return `${completed} de ${progress.total}`;
  };

  return {
    progress,
    isWarming,
    isComplete,
    elapsedTime,
    estimatedRemaining,
    statusMessage: getStatusMessage(),
    progressMessage: getProgressMessage(),
    progressPercent:
      progress.total > 0
        ? ((progress.completed + progress.failed + progress.skipped) / progress.total) * 100
        : 0,
  };
}

export type { UseCacheWarmingOptions, UseCacheWarmingResult };
export type { WarmTask, WarmProgress, WarmPriority };
