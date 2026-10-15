import { createMemoryStore } from '../memory-store';
import { createQueueEngine } from '../engine';
import { drainQueue } from '../sync';

const mkEngine = () => createQueueEngine(createMemoryStore(), () => Date.now());

test('drains accept then status in order', async () => {
  const e = mkEngine();
  await e.enqueue('accept', 'o1');
  await e.enqueue('status', 'o1', { status: 'in_transit_to_pickup' });
  const calls: string[] = [];
  const api = {
    accept: async (id: string) => {
      calls.push('accept:' + id);
    },
    reject: async () => {},
    updateStatus: async (id: string, s: string) => {
      calls.push('status:' + id + ':' + s);
    },
  } as any;
  const done = await drainQueue(e, api, () => {});
  expect(calls).toEqual(['accept:o1', 'status:o1:in_transit_to_pickup']);
  expect(done).toBe(2);
  expect(await e.size()).toBe(0);
});

test('a 400 conflict drops the op and reports it', async () => {
  const e = mkEngine();
  await e.enqueue('status', 'o1', { status: 'picked_up' });
  const conflicts: any[] = [];
  const api = {
    accept: async () => {},
    reject: async () => {},
    updateStatus: async () => {
      throw { status: 400 };
    },
  } as any;
  await drainQueue(e, api, (c) => conflicts.push(c));
  expect(await e.size()).toBe(0);
  expect(conflicts).toHaveLength(1);
});

test('a network error keeps the op for a later retry', async () => {
  const e = mkEngine();
  await e.enqueue('accept', 'o1');
  const api = {
    accept: async () => {
      throw new TypeError('Network request failed');
    },
    reject: async () => {},
    updateStatus: async () => {},
  } as any;
  await drainQueue(e, api, () => {});
  expect(await e.size()).toBe(1);
});
