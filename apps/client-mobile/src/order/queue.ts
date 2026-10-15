import { drainQueue } from '@kiwi/mobile-core';
import type { Op } from '@kiwi/mobile-core';

// Structural shape of the queue engine (createQueueEngine) so this module stays
// decoupled from mobile-core internals while remaining type-safe.
type QueueEngine = {
  enqueue(kind: Op['kind'], orderId: string, payload?: any): Promise<Op>;
  size(): Promise<number>;
  peek(): Promise<Op | null>;
  complete(id: string): Promise<void>;
  fail(id: string, permanent: boolean): Promise<void>;
};

export interface OrdersApi {
  createAuthed(body: any, idempotencyKey: string): Promise<any>;
  createGuest(body: any, idempotencyKey: string): Promise<any>;
}

export interface SubmitResult {
  queued: boolean;
  order?: any;
}

export interface OrderQueue {
  submit(
    checkoutId: string,
    body: any,
    authed: boolean,
    idempotencyKey?: string,
  ): Promise<SubmitResult>;
  flush(): Promise<number>;
}

const genKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Network failures (status 0) and 5xx/timeout/rate-limit are retryable;
// any other 4xx is permanent and must surface to the caller.
const isRetryable = (status: number) =>
  status === 0 || status >= 500 || status === 408 || status === 429;

export function createOrderQueue(engine: QueueEngine, ordersApi: OrdersApi): OrderQueue {
  const create = (body: any, authed: boolean, idempotencyKey: string) =>
    authed
      ? ordersApi.createAuthed(body, idempotencyKey)
      : ordersApi.createGuest(body, idempotencyKey);

  return {
    async submit(checkoutId, body, authed, idempotencyKey = genKey()) {
      try {
        const order = await create(body, authed, idempotencyKey);
        return { queued: false, order };
      } catch (e: any) {
        const status = typeof e?.status === 'number' ? e.status : 0;
        if (!isRetryable(status)) throw e;
        await engine.enqueue('create', checkoutId, {
          checkoutId,
          body,
          authed,
          idempotencyKey,
        });
        return { queued: true };
      }
    },
    async flush() {
      return drainQueue(
        engine,
        {
          accept: async () => {},
          reject: async () => {},
          updateStatus: async () => {},
          create: (payload) => create(payload.body, payload.authed, payload.idempotencyKey),
        },
        () => {},
      );
    },
  };
}
