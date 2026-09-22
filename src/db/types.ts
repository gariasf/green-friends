import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Any synchronous Drizzle SQLite handle over this schema: expo-sqlite in the app (src/db/client.ts),
 * better-sqlite3 in tests (src/test/db.ts). Core functions take this as their first argument.
 */
export type Db = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
