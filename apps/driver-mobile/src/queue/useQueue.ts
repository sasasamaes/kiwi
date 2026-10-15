import * as SQLite from 'expo-sqlite';
import { createSqliteStore, OPS_SCHEMA } from './sqlite-store';
import { createQueueEngine } from './engine';
import { drainQueue } from './sync';
import { ordersApi } from '../api/orders';
import { http } from '../api/client';

const db = SQLite.openDatabaseSync('kiwi-driver.db');
db.execSync(OPS_SCHEMA);
const engine = createQueueEngine(createSqliteStore(db), () => Date.now());
const api = ordersApi(http);

export const queue = {
  enqueue: engine.enqueue,
  size: engine.size,
  async flush() {
    return drainQueue(engine, api, () => {});
  },
};
