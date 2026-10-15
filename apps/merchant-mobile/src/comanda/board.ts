export type Column = 'new' | 'preparing' | 'ready' | 'closed';

export function columnFor(status: string): Column {
  if (status === 'pending' || status === 'no_driver') return 'new';
  if (status === 'assigned' || status === 'in_transit_to_pickup') return 'preparing';
  if (status === 'picked_up' || status === 'in_transit_to_delivery') return 'ready';
  return 'closed'; // delivered/cancelled
}

export function sortByOldest<T extends { createdAt: number | string }>(orders: T[]): T[] {
  return [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export type BoardEvent = {
  type: 'create' | 'status' | 'taken';
  order: { id: string; status: string };
};

export function applyEvent<T extends { id: string }>(state: T[], e: BoardEvent): T[] {
  const exists = state.some((o) => o.id === e.order.id);
  if (e.type === 'create' && !exists) return [...state, e.order as any];
  if (e.type === 'taken' && !exists) return state;
  return state.map((o) => (o.id === e.order.id ? { ...o, ...e.order } : o));
}
