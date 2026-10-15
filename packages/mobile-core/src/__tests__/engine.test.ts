import { createMemoryStore } from '../queue/memory-store';
import { createQueueEngine } from '../queue/engine';

const clock = () => 1000;

test('FIFO order by createdAt', async () => {
  const e = createQueueEngine(createMemoryStore(), clock);
  await e.enqueue('status', 'o1', { status: 'picked_up' });
  await e.enqueue('accept', 'o2');
  const first = await e.peek();
  expect(first).toMatchObject({ kind: 'status', orderId: 'o1' });
});

test('complete removes the op', async () => {
  const e = createQueueEngine(createMemoryStore(), clock);
  const op = await e.enqueue('accept', 'o1');
  await e.complete(op.id);
  expect(await e.size()).toBe(0);
});

test('permanent failure drops the op; transient keeps it with attempts+1', async () => {
  const e = createQueueEngine(createMemoryStore(), clock);
  const op = await e.enqueue('status', 'o1', { status: 'picked_up' });
  await e.fail(op.id, false);
  expect((await e.peek())!.attempts).toBe(1);
  await e.fail(op.id, true);
  expect(await e.size()).toBe(0);
});
