import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { getSchemaVersion, migrate } from './migrate';
import * as schema from './schema';

function freshDb() {
  return drizzle(new Database(':memory:'), { schema });
}

describe('migrate', () => {
  test('brings a fresh database to the current schema version', () => {
    const db = freshDb();
    expect(getSchemaVersion(db)).toBe(0);

    migrate(db);

    expect(getSchemaVersion(db)).toBe(4);
  });

  test('is a no-op on an up-to-date database', () => {
    const db = freshDb();
    migrate(db);

    migrate(db);

    expect(getSchemaVersion(db)).toBe(4);
  });
});
