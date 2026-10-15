import { createMemoryStore, createQueueEngine } from '@kiwi/mobile-core';
import { createOrderQueue } from '../queue';

const engine = () => createQueueEngine(createMemoryStore(), () => Date.now());

test('online creates immediately', async () => {
  const api = {
    createAuthed: jest.fn(async () => ({ id: 'o1' })),
    createGuest: jest.fn(),
  } as any;
  const q = createOrderQueue(engine(), api);
  const r = await q.submit('c1', { merchantId: 'm1' }, true);
  expect(r).toMatchObject({ queued: false, order: { id: 'o1' } });
  expect(api.createGuest).not.toHaveBeenCalled();
});

test('offline queues the order', async () => {
  const api = {
    createAuthed: jest.fn(async () => {
      throw new TypeError('Network request failed');
    }),
    createGuest: jest.fn(),
  } as any;
  const e = engine();
  const q = createOrderQueue(e, api);
  const r = await q.submit('c1', { merchantId: 'm1' }, true);
  expect(r).toMatchObject({ queued: true });
  expect(await e.size()).toBe(1);
});

test('a 4xx surfaces and is not enqueued', async () => {
  const api = {
    createAuthed: jest.fn(async () => {
      throw { status: 400, body: { message: 'bad' } };
    }),
    createGuest: jest.fn(),
  } as any;
  const e = engine();
  const q = createOrderQueue(e, api);
  await expect(q.submit('c1', { merchantId: 'm1' }, true)).rejects.toMatchObject({ status: 400 });
  expect(await e.size()).toBe(0);
});

test('flush drains a queued order via the injected api', async () => {
  const api = {
    createAuthed: jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ id: 'o2' }),
    createGuest: jest.fn(),
  } as any;
  const e = engine();
  const q = createOrderQueue(e, api);
  await q.submit('c1', { merchantId: 'm1' }, true);
  expect(await e.size()).toBe(1);
  const done = await q.flush();
  expect(done).toBe(1);
  expect(await e.size()).toBe(0);
  expect(api.createAuthed).toHaveBeenCalledTimes(2);
});

test('guest submit uses createGuest', async () => {
  const api = {
    createAuthed: jest.fn(),
    createGuest: jest.fn(async () => ({ id: 'g1' })),
  } as any;
  const q = createOrderQueue(engine(), api);
  const r = await q.submit('c1', { merchantId: 'm1' }, false);
  expect(r).toMatchObject({ queued: false, order: { id: 'g1' } });
  expect(api.createGuest).toHaveBeenCalledWith({ merchantId: 'm1' }, expect.any(String));
});
