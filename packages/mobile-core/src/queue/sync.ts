import type { Op } from './types';

type Engine = {
  peek(): Promise<Op | null>;
  complete(id: string): Promise<void>;
  fail(id: string, permanent: boolean): Promise<void>;
};

type OrdersApi = {
  accept(id: string): Promise<any>;
  reject(id: string): Promise<any>;
  updateStatus(id: string, s: any): Promise<any>;
  // Optional, additive: handles `kind: 'create'` ops (offline order creation).
  create?(payload: CreateOpPayload): Promise<any>;
};

export interface CreateOpPayload {
  body: any;
  authed: boolean;
  idempotencyKey: string;
  [key: string]: any;
}

type Conflict = { op: Op; status: number; body: any };

const isPermanent = (status: number) =>
  status >= 400 && status < 500 && status !== 408 && status !== 429;

export async function drainQueue(
  engine: Engine,
  api: OrdersApi,
  onConflict: (c: Conflict) => void,
): Promise<number> {
  let done = 0;
  for (;;) {
    const op = await engine.peek();
    if (!op) break;
    try {
      if (op.kind === 'create') {
        if (!api.create) throw new Error('drainQueue: `create` op requires api.create');
        await api.create(op.payload);
      } else if (op.kind === 'accept') await api.accept(op.orderId);
      else if (op.kind === 'reject') await api.reject(op.orderId);
      else await api.updateStatus(op.orderId, op.payload.status);
      await engine.complete(op.id);
      done++;
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 0;
      if (status && isPermanent(status)) {
        onConflict({ op, status, body: e.body });
        await engine.fail(op.id, true);
      } else {
        await engine.fail(op.id, false);
        break;
      } // network/5xx: stop and retry later
    }
  }
  return done;
}
