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

    expect(getSchemaVersion(db)).toBe(7);
  });

  test('is a no-op on an up-to-date database', () => {
    const db = freshDb();
    migrate(db);

    migrate(db);

    expect(getSchemaVersion(db)).toBe(7);
  });

  test('turns around both-set watering and fertilizing Overrides of plants whose Species rests in summer', () => {
    const db = freshDb();
    migrate(db, 6);
    const row = (id: string, speciesId: string | null, water: [number | null, number | null]) => ({
      id,
      speciesId,
      wateringGrowingDays: water[0],
      wateringDormantDays: water[1],
      fertilizingGrowingDays: 60,
      fertilizingDormantDays: 21,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    });
    db.insert(schema.plants)
      .values([
        // Cyclamen, both set: swapped.
        row('cyclamen', 'Q150055', [14, 5]),
        // Albuca watered in one Season only: untouched, fertilizing still swapped.
        row('albuca', 'Q11679534', [10, null]),
        // A Monstera does not rest in summer.
        row('monstera', 'Q161077', [7, 14]),
        row('no-species', null, [7, 14]),
      ])
      .run();

    migrate(db);

    const byId = new Map(
      db
        .select()
        .from(schema.plants)
        .all()
        .map((plant) => [plant.id, plant]),
    );
    expect(byId.get('cyclamen')).toMatchObject({
      wateringGrowingDays: 5,
      wateringDormantDays: 14,
      fertilizingGrowingDays: 21,
      fertilizingDormantDays: 60,
    });
    expect(byId.get('albuca')).toMatchObject({
      wateringGrowingDays: 10,
      wateringDormantDays: null,
      fertilizingGrowingDays: 21,
      fertilizingDormantDays: 60,
    });
    // Stamped with the day the swap shipped, so an old Export turned around on Import ties with it.
    expect(byId.get('cyclamen')!.updatedAt).toBe('2026-09-27T00:00:00.000Z');
    for (const id of ['monstera', 'no-species']) {
      expect(byId.get(id)).toMatchObject({
        wateringGrowingDays: 7,
        wateringDormantDays: 14,
        fertilizingGrowingDays: 60,
        fertilizingDormantDays: 21,
        updatedAt: '2026-09-01T10:00:00.000Z',
      });
    }
  });
});
