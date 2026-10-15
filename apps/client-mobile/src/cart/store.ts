import { createStore } from 'zustand/vanilla';
import type { SelectedOption } from './math';

export interface CartLine {
  lineId: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
}

export interface CartState {
  lines: CartLine[];
  add(line: CartLine): void;
  remove(lineId: string): void;
  setQty(lineId: string, quantity: number): void;
  clear(): void;
}

export interface CartStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const CART_KEY = 'kiwi_cliente_cart';

export function createCartStore({ storage }: { storage: CartStorage | null }) {
  const store = createStore<CartState>()((set) => ({
    lines: [],
    add: (line) =>
      set((state) => {
        const idx = state.lines.findIndex((l) => l.lineId === line.lineId);
        if (idx >= 0) {
          const lines = state.lines.slice();
          lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + line.quantity };
          return { lines };
        }
        return { lines: [...state.lines, line] };
      }),
    remove: (lineId) => set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),
    setQty: (lineId, quantity) =>
      set((state) => ({
        lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
      })),
    clear: () => set({ lines: [] }),
  }));

  if (storage) {
    void storage.getItem(CART_KEY).then((raw) => {
      if (!raw) return;
      try {
        const lines = JSON.parse(raw) as CartLine[];
        if (Array.isArray(lines)) store.setState({ lines });
      } catch {
        // Corrupt payload: keep the empty cart.
      }
    });
    store.subscribe((state) => {
      void storage.setItem(CART_KEY, JSON.stringify(state.lines));
    });
  }

  return store;
}
