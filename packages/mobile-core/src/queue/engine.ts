import type { Op, OpKind, QueueStore } from './types';

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function createQueueEngine(store: QueueStore, clock: () => number) {
  const sorted = async () => (await store.all()).sort((a, b) => a.createdAt - b.createdAt);
  return {
    async enqueue(kind: OpKind, orderId: string, payload?: any): Promise<Op> {
      const op: Op = { id: newId(), kind, orderId, payload, createdAt: clock(), attempts: 0 };
      await store.add(op);
      return op;
    },
    async peek(): Promise<Op | null> {
      return (await sorted())[0] ?? null;
    },
    async complete(id: string): Promise<void> {
      await store.remove(id);
    },
    async fail(id: string, permanent: boolean): Promise<void> {
      const op = (await store.all()).find((o) => o.id === id);
      if (!op) return;
      if (permanent) {
        await store.remove(id);
        return;
      }
      await store.update({ ...op, attempts: op.attempts + 1 });
    },
    async size(): Promise<number> {
      return (await store.all()).length;
    },
  };
}
