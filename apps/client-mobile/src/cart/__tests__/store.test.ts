import { createCartStore, type CartLine } from '../store';

const line = (over: Partial<CartLine> = {}): CartLine => ({
  lineId: 'l1',
  menuItemId: 'i1',
  name: 'Bowl',
  unitPrice: 4500,
  quantity: 1,
  selectedOptions: [],
  ...over,
});

test('add merges same lineId and increments quantity', () => {
  const s = createCartStore({ storage: null });
  s.getState().add(line());
  s.getState().add(line());
  expect(s.getState().lines).toHaveLength(1);
  expect(s.getState().lines[0].quantity).toBe(2);
});

test('add keeps distinct lineIds separate', () => {
  const s = createCartStore({ storage: null });
  s.getState().add(line());
  s.getState().add(line({ lineId: 'l2', menuItemId: 'i2' }));
  expect(s.getState().lines).toHaveLength(2);
});

test('setQty, remove and clear update the cart', () => {
  const s = createCartStore({ storage: null });
  s.getState().add(line());
  s.getState().setQty('l1', 5);
  expect(s.getState().lines[0].quantity).toBe(5);
  s.getState().remove('l1');
  expect(s.getState().lines).toHaveLength(0);
  s.getState().add(line());
  s.getState().clear();
  expect(s.getState().lines).toEqual([]);
});

test('persists to injected storage when provided', async () => {
  let saved: string | null = null;
  const storage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_k: string, v: string) => {
      saved = v;
    }),
  };
  const s = createCartStore({ storage });
  s.getState().add(line());
  await Promise.resolve();
  expect(storage.setItem).toHaveBeenCalled();
  expect(saved).toContain('"l1"');
});
