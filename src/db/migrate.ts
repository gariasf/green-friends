import { sql } from 'drizzle-orm';

import migrationBundle from '../../drizzle/migrations';
import type { Db } from './types';

const migrations: Record<string, string> = migrationBundle.migrations;

/** Ordered SQL of every migration drizzle-kit has generated (drizzle/*.sql, bundled by babel inline-import). */
const steps = migrationBundle.journal.entries.map((entry) => {
  const step = migrations[`m${String(entry.idx).padStart(4, '0')}`];
  if (!step) throw new Error(`Missing migration ${entry.tag}: run npm run db:generate`);
  return step;
});

/**
 * Forward-only migrations. The schema version is SQLite's PRAGMA user_version: the number of
 * migrations applied. It is written into every Export header (ADR-0002).
 */
export function migrate(db: Db): void {
  for (let version = getSchemaVersion(db); version < steps.length; version++) {
    db.transaction((tx) => {
      for (const statement of steps[version].split('--> statement-breakpoint')) {
        tx.run(sql.raw(statement));
      }
      tx.run(sql.raw(`PRAGMA user_version = ${version + 1}`));
    });
  }
}

export function getSchemaVersion(db: Db): number {
  return db.get<{ user_version: number }>(sql`PRAGMA user_version`).user_version;
}
