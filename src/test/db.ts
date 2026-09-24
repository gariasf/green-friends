import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { migrate } from '../db/migrate';
import * as schema from '../db/schema';
import type { Db } from '../db/types';

/**
 * The core test seam (spec #8, Testing Decisions): a real, migrated, in-memory SQLite
 * database behind the same Drizzle handle type the app uses.
 */
export function openTestDb(): Db {
  const db = emptyDb();
  migrate(db);
  return db;
}

/** A fresh in-memory database, not yet migrated: schema version 0. */
export function emptyDb(): Db {
  return drizzle(new Database(':memory:'), { schema });
}
