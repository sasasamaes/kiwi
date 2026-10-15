import { create } from 'zustand';
import { applyEvent, type BoardEvent } from './board';

export interface BoardState {
  orders: any[];
  // Id of the most recently seen brand-new order, whether it arrived by socket
  // or by the polling fallback. The board watches this to ring the alert.
  lastCreatedId: string | null;
  setAll(list: any[]): void;
  dispatch(e: BoardEvent): void;
  reset(): void;
}

// Single source of truth for the KDS board. One socket in the app layout feeds
// it (via `useOrdersRealtime`) and the screen also reconciles it with the
// `ordersApi.incoming()` polling fallback.
export const useBoard = create<BoardState>((set) => ({
  orders: [],
  lastCreatedId: null,
  setAll: (list) =>
    set((s) => {
      const next = Array.isArray(list) ? list : [];
      const known = new Set(s.orders.map((o) => o.id));
      const fresh = next.filter((o) => o && o.id && !known.has(o.id));
      if (fresh.length === 0) return { orders: next };
      const newest = fresh.reduce((a, b) =>
        new Date(a.createdAt ?? 0).getTime() >= new Date(b.createdAt ?? 0).getTime() ? a : b,
      );
      return { orders: next, lastCreatedId: newest.id };
    }),
  dispatch: (e) =>
    set((s) => {
      const existed = s.orders.some((o) => o.id === e.order.id);
      const orders = applyEvent(s.orders, e);
      const lastCreatedId = e.type === 'create' && !existed ? e.order.id : s.lastCreatedId;
      return { orders, lastCreatedId };
    }),
  reset: () => set({ orders: [], lastCreatedId: null }),
}));
