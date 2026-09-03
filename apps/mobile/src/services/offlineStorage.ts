import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@kiwi_cache_';
const QUEUE_PREFIX = '@kiwi_queue_';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface QueueAction {
  id: string;
  type: string;
  endpoint: string;
  method: string;
  body?: any;
  timestamp: number;
  retries: number;
}

// ============================================
// CACHE OPERATIONS
// ============================================

export const offlineCache = {
  async set<T>(key: string, data: T, ttlMs: number = CACHE_EXPIRY_MS): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttlMs,
    };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  },

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() > entry.expiry) {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  },

  async clear(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  },

  async getStats(): Promise<{ count: number; keys: string[] }> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    return { count: cacheKeys.length, keys: cacheKeys };
  },
};

// ============================================
// QUEUE OPERATIONS (for offline actions)
// ============================================

export const offlineQueue = {
  async enqueue(action: Omit<QueueAction, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const queue = await this.getQueue();
    const newAction: QueueAction = {
      ...action,
      id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(newAction);
    await AsyncStorage.setItem(`${QUEUE_PREFIX}actions`, JSON.stringify(queue));
  },

  async getQueue(): Promise<QueueAction[]> {
    try {
      const raw = await AsyncStorage.getItem(`${QUEUE_PREFIX}actions`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async remove(actionId: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter((a) => a.id !== actionId);
    await AsyncStorage.setItem(`${QUEUE_PREFIX}actions`, JSON.stringify(filtered));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(`${QUEUE_PREFIX}actions`);
  },

  async getCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },
};

// ============================================
// ORDER CACHE (driver-specific)
// ============================================

export const orderCache = {
  async saveAvailableOrders(orders: any[]): Promise<void> {
    await offlineCache.set('available_orders', orders, 2 * 60 * 1000); // 2 min cache
  },

  async getAvailableOrders(): Promise<any[] | null> {
    return offlineCache.get('available_orders');
  },

  async saveActiveOrders(orders: any[]): Promise<void> {
    await offlineCache.set('active_orders', orders, 1 * 60 * 1000); // 1 min cache
  },

  async getActiveOrders(): Promise<any[] | null> {
    return offlineCache.get('active_orders');
  },

  async saveEarnings(earnings: any): Promise<void> {
    await offlineCache.set('earnings', earnings, 5 * 60 * 1000);
  },

  async getEarnings(): Promise<any | null> {
    return offlineCache.get('earnings');
  },

  async saveDriverProfile(profile: any): Promise<void> {
    await offlineCache.set('driver_profile', profile, 10 * 60 * 1000);
  },

  async getDriverProfile(): Promise<any | null> {
    return offlineCache.get('driver_profile');
  },

  async saveSchedule(schedule: any[]): Promise<void> {
    await offlineCache.set('schedule', schedule, 15 * 60 * 1000);
  },

  async getSchedule(): Promise<any[] | null> {
    return offlineCache.get('schedule');
  },
};
