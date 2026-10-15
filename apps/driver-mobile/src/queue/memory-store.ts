import type { Op, QueueStore } from './types';

export function createMemoryStore(): QueueStore {
  let ops: Op[] = [];
  return {
    all: async () => [...ops],
    add: async (op) => {
      ops.push(op);
    },
    remove: async (id) => {
      ops = ops.filter((o) => o.id !== id);
    },
    update: async (op) => {
      ops = ops.map((o) => (o.id === op.id ? op : o));
    },
  };
}
