/**
 * 🥝 Kiwi Offline Queue
 *
 * Queues API requests when offline and replays them when connectivity returns.
 * Critical for Nicoya where internet connectivity is spotty.
 */

import { apiFetch, resolveApiUrl } from './api-client';

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class OfflineQueue {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private storageKey = 'kiwi_offline_queue';

  constructor() {
    if (typeof window !== 'undefined') {
      // Load persisted queue
      this.loadQueue();

      // Listen for connectivity changes
      window.addEventListener('online', () => {
        console.log('🟢 Back online - processing offline queue');
        this.processQueue();
      });

      window.addEventListener('offline', () => {
        console.log('🔴 Gone offline - queue will store requests');
      });
    }
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`📦 Loaded ${this.queue.length} queued requests`);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Add a request to the offline queue
   */
  enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): string {
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const queuedRequest: QueuedRequest = {
      ...request,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    this.queue.push(queuedRequest);
    this.saveQueue();

    console.log(`📥 Queued request: ${request.method} ${request.url}`);
    return id;
  }

  /**
   * Process all queued requests
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    console.log(`🔄 Processing ${this.queue.length} queued requests...`);

    const processedIds: string[] = [];

    for (const request of this.queue) {
      try {
        // apiFetch resolves the absolute URL and attaches the CURRENT token.
        // Drop any stored Authorization first: it may predate a rotation
        // (or come from an old persisted queue) and would 401 the replay.
        const { Authorization: _stale, ...freshHeaders } = request.headers || {};
        const response = await apiFetch(request.url, {
          method: request.method,
          headers: freshHeaders,
          body: request.body ? JSON.stringify(request.body) : undefined,
        });

        if (response.ok) {
          console.log(`✅ Queued request succeeded: ${request.method} ${request.url}`);
          processedIds.push(request.id);
        } else {
          console.error(`❌ Queued request failed: ${response.status} ${request.url}`);
          request.retryCount++;

          if (request.retryCount >= request.maxRetries) {
            console.error(`🚫 Request exceeded max retries: ${request.url}`);
            processedIds.push(request.id);
          }
        }
      } catch (error) {
        console.error(`❌ Queued request error: ${request.url}`, error);
        request.retryCount++;

        if (request.retryCount >= request.maxRetries) {
          processedIds.push(request.id);
        }
      }
    }

    // Remove processed requests
    this.queue = this.queue.filter((r) => !processedIds.includes(r.id));
    this.saveQueue();

    this.isProcessing = false;
    console.log(`✅ Processed ${processedIds.length} requests, ${this.queue.length} remaining`);
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  }

  /**
   * Get queue status
   */
  getStatus(): { pending: number; isOffline: boolean } {
    return {
      pending: this.queue.length,
      isOffline: this.isOffline(),
    };
  }

  /**
   * Clear all queued requests
   */
  clear(): void {
    this.queue = [];
    this.saveQueue();
    console.log('🗑️ Offline queue cleared');
  }
}

// Export singleton
export const offlineQueue = new OfflineQueue();

/**
 * Enhanced fetch that uses offline queue when offline
 */
export async function offlineFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = options.method || 'GET';
  const headers = options.headers as Record<string, string>;

  // Only JSON string bodies can be queued losslessly. Anything else
  // (FormData, Blob, URLSearchParams…) would crash JSON.parse or replay
  // corrupted — let it go through the normal path instead.
  let body: unknown;
  if (options.body) {
    if (typeof options.body !== 'string') return apiFetch(url, options);
    try {
      body = JSON.parse(options.body);
    } catch {
      return apiFetch(url, options);
    }
  }

  // If offline and it's a mutating request, queue it
  if (offlineQueue.isOffline() && method !== 'GET') {
    const id = offlineQueue.enqueue({
      url: resolveApiUrl(url),
      method,
      body,
      headers,
    });

    // Return a fake success response
    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        id,
        message: "Request queued for when you're back online",
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Otherwise, make the normal request (absolute URL + auth via apiFetch)
  return apiFetch(url, options);
}
