import { useStore } from 'zustand';
import * as SQLite from 'expo-sqlite';
import { createCartStore, type CartState } from './store';

// Cart is persisted in SQLite (same DB used by the offline order queue) so it
// survives app restarts. The pure store factory is reused as-is by injecting a
// SQLite-backed key/value adapter.
const db = SQLite.openDatabaseSync('kiwi-cliente.db');
db.execSync('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)');

const storage = {
  async getItem(key: string): Promise<string | null> {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [
      key,
    ]);
    return row?.value ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value]);
  },
};

export const cartStore = createCartStore({ storage });

export const useCart = <T>(selector: (s: CartState) => T): T => useStore(cartStore, selector);
