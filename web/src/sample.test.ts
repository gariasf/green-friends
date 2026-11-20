import initSqlJs from 'sql.js';
import { expect, test } from 'vitest';

import { listNeedsAttention } from '../../src/core/care';
import { localDay } from '../../src/core/dates';
import { listPlants } from '../../src/core/plants';
import { openSampleGarden } from './sample';

test.each(['2026-01-15T12:00:00', '2026-07-15T12:00:00'])(
  'the sample Garden has 4 plants needing care on %s, in either Season',
  async (at) => {
    const now = new Date(at);

    const garden = openSampleGarden(await initSqlJs(), new Map(), now);

    expect(listPlants(garden.db)).toHaveLength(12);
    expect(listNeedsAttention(garden.db, localDay(now))).toHaveLength(4);
  },
);

test('a sample photo handed in shows on its plant', async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff]);

  const garden = openSampleGarden(await initSqlJs(), new Map([['monty.jpg', bytes]]));

  const monty = listPlants(garden.db).find((plant) => plant.displayName === 'Monty');
  expect(monty?.photo && garden.photo(monty.photo)).toEqual(bytes);
});
