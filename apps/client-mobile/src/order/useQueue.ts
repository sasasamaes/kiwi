import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createQueueEngine } from '@kiwi/mobile-core';
import type { QueueStore } from '@kiwi/mobile-core';
import { ordersApi } from '../api/orders';
import { http } from '../api/http';
import { createOrderQueue } from './queue';

export const OPS_SCHEMA =
  'CREATE TABLE IF NOT EXISTS ops (id TEXT PRIMARY KEY, kind TEXT, order_id TEXT, payload TEXT, created_at INTEGER, attempts INTEGER)';

export function createSqliteStore(db: SQLiteDatabase): QueueStore {
  return {
    all: async () =>
      (await db.getAllAsync<any>('SELECT * FROM ops')).map((r) => ({
        id: r.id,
        kind: r.kind,
        orderId: r.order_id,
        payload: r.payload ? JSON.parse(r.payload) : undefined,
        createdAt: r.created_at,
        attempts: r.attempts,
      })),
    add: async (op) => {
      await db.runAsync(
        'INSERT INTO ops (id, kind, order_id, payload, created_at, attempts) VALUES (?,?,?,?,?,?)',
        [
          op.id,
          op.kind,
          op.orderId,
          op.payload ? JSON.stringify(op.payload) : null,
          op.createdAt,
          op.attempts,
        ],
      );
    },
    remove: async (id) => {
      await db.runAsync('DELETE FROM ops WHERE id = ?', [id]);
    },
    update: async (op) => {
      await db.runAsync('UPDATE ops SET attempts = ? WHERE id = ?', [op.attempts, op.id]);
    },
  };
}

const db = SQLite.openDatabaseSync('kiwi-client.db');
db.execSync(OPS_SCHEMA);

const engine = createQueueEngine(createSqliteStore(db), () => Date.now());
const queue = createOrderQueue(engine, ordersApi(http));

export const orderQueue = queue;

export function flush(): Promise<number> {
  return queue.flush();
}
