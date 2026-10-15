import { columnFor, sortByOldest, applyEvent } from '../board';

test('maps statuses to KDS columns', () => {
  expect(columnFor('pending')).toBe('new');
  expect(columnFor('assigned')).toBe('preparing');
  expect(columnFor('picked_up')).toBe('ready');
  expect(columnFor('delivered')).toBe('closed');
  expect(columnFor('cancelled')).toBe('closed');
});

test('sorts oldest first', () => {
  const out = sortByOldest([
    { id: 'b', createdAt: 2 },
    { id: 'a', createdAt: 1 },
  ]);
  expect(out.map((o) => o.id)).toEqual(['a', 'b']);
});

test('applyEvent inserts new and updates existing', () => {
  let s: any[] = [];
  s = applyEvent(s, { type: 'create', order: { id: 'o1', status: 'pending' } });
  s = applyEvent(s, { type: 'status', order: { id: 'o1', status: 'assigned' } });
  expect(s).toHaveLength(1);
  expect(s[0].status).toBe('assigned');
});
