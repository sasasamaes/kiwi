import { createIdempotencyManager } from '../idempotency';

let n = 0;

test('key is stable for the same checkout and changes after reset', () => {
  const m = createIdempotencyManager(() => `k${++n}`);
  const a = m.keyFor('c1');
  const b = m.keyFor('c1');
  expect(a).toBe(b); // retry: same key
  m.reset('c1');
  expect(m.keyFor('c1')).not.toBe(a); // new order: new key
});

test('different checkouts get different keys', () => {
  const m = createIdempotencyManager(() => `k${++n}`);
  expect(m.keyFor('c2')).not.toBe(m.keyFor('c3'));
});

test('reset on an unknown checkout is a no-op', () => {
  const m = createIdempotencyManager(() => `k${++n}`);
  expect(() => m.reset('nope')).not.toThrow();
});
