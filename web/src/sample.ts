import type { SqlJsStatic } from 'sql.js';

import { plantSeasonOn } from '../../src/core/care';
import { logCareEvent, type CareEventType } from '../../src/core/careLog';
import { localDay, shiftDays } from '../../src/core/dates';
import { setPlantPhoto, type PhotoFiles } from '../../src/core/photos';
import { createPlant } from '../../src/core/plants';
import { getSpecies } from '../../src/core/species';
import { newGardenDatabase, type Garden } from './garden';

type SamplePlant = {
  speciesId: string;
  nickname?: string;
  /** When watering comes Due, in days from today: negative is Overdue. */
  waterDueIn: number;
  fedDaysAgo?: number;
  repot?: { daysAgo: number; potSizeCm: number; soil: string };
  note?: { daysAgo: number; text: string };
  /** A file in sample-photos/, cropped from the App Store screenshots. */
  photo?: string;
};

const PLANTS: SamplePlant[] = [
  {
    speciesId: 'Q161077',
    nickname: 'Monty',
    waterDueIn: -1,
    fedDaysAgo: 1,
    repot: { daysAgo: 150, potSizeCm: 24, soil: 'Aroid mix' },
    photo: 'monty.jpg',
  },
  {
    speciesId: 'Q6754829',
    waterDueIn: -2,
    note: { daysAgo: 6, text: 'Leaves curling at the edges.' },
    photo: 'prayer-plant.jpg',
  },
  { speciesId: 'Q275160', nickname: 'Benji', waterDueIn: 0, fedDaysAgo: 25, photo: 'benji.jpg' },
  { speciesId: 'Q761494', nickname: 'Lily', waterDueIn: 0, photo: 'lily.jpg' },
  { speciesId: 'Q136883', waterDueIn: 1 },
  { speciesId: 'Q161809', nickname: 'Trailing Tom', waterDueIn: 2, fedDaysAgo: 3 },
  { speciesId: 'Q1498748', nickname: 'Figgy', waterDueIn: 3 },
  { speciesId: 'Q1164349', waterDueIn: 4 },
  { speciesId: 'Q157299', waterDueIn: 6, photo: 'jade-plant.jpg' },
  { speciesId: 'Q80079', waterDueIn: 9, photo: 'aloe-vera.jpg' },
  {
    speciesId: 'Q65936984',
    waterDueIn: 11,
    note: { daysAgo: 20, text: 'New pup at the base.' },
  },
  { speciesId: 'Q15312475', nickname: 'Zed', waterDueIn: 14 },
];

const WATERINGS_LOGGED = 4;

const PHOTO_URLS = import.meta.glob<string>('./sample-photos/*.jpg', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** The sample's photos from the dev server, by file name. */
export async function loadSamplePhotos(): Promise<Map<string, Uint8Array>> {
  const entries = await Promise.all(
    Object.entries(PHOTO_URLS).map(async ([path, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`No sample photo at ${url}`);
      const name = path.slice(path.lastIndexOf('/') + 1);
      return [name, new Uint8Array(await response.arrayBuffer())] as const;
    }),
  );
  return new Map(entries);
}

/**
 * A made-up Garden for designing the Web view without a Snapshot (`/app/?sample`, dev only): the
 * catalog's plants with Care Logs laid out from today, so the mix of Overdue, Due and coming up
 * holds on any day. Plants with a file in `photos` (loadSamplePhotos) show it; the rest their
 * initial.
 */
export function openSampleGarden(
  SQL: SqlJsStatic,
  photos: ReadonlyMap<string, Uint8Array> = new Map(),
  now: Date = new Date(),
): Garden {
  const { database, db } = newGardenDatabase(SQL);
  const stored = new Map<string, Uint8Array>();
  const files: PhotoFiles = {
    store: (source, filename) => {
      const bytes = photos.get(source);
      if (!bytes) throw new Error(`No sample photo ${source}`);
      stored.set(filename, bytes);
    },
    write: (filename, bytes) => void stored.set(filename, bytes),
    read: (filename) => {
      const bytes = stored.get(filename);
      if (!bytes) throw new Error(`No file ${filename}`);
      return bytes;
    },
    remove: (filename) => void stored.delete(filename),
    removeAll: () => stored.clear(),
  };
  const today = localDay(now);
  const added = new Date(now.getTime() - 200 * 86_400_000);
  for (const sample of PLANTS) {
    const plant = createPlant(
      db,
      { speciesId: sample.speciesId, nickname: sample.nickname },
      added,
    );
    if (sample.photo && photos.has(sample.photo)) {
      setPlantPhoto(db, files, plant.id, sample.photo, null, added);
    }
    const species = getSpecies(db, sample.speciesId);
    if (!species) throw new Error(`No species ${sample.speciesId} in the catalog`);
    const growing = plantSeasonOn(db, sample.speciesId, today).season === 'growing';
    const interval =
      (growing ? species.wateringGrowingDays : species.wateringDormantDays) ??
      species.wateringGrowingDays;
    if (!interval) continue;
    const log = (type: CareEventType, daysAgo: number, extra = {}) =>
      logCareEvent(
        db,
        { plantId: plant.id, type, occurredOn: shiftDays(today, -daysAgo), ...extra },
        now,
      );
    const lastWateredDaysAgo = interval - sample.waterDueIn;
    for (let index = 0; index < WATERINGS_LOGGED; index++) {
      log('water', lastWateredDaysAgo + index * interval);
    }
    const feedInterval = growing ? species.fertilizingGrowingDays : species.fertilizingDormantDays;
    const fedDaysAgo = sample.fedDaysAgo ?? (feedInterval ? Math.floor(feedInterval / 2) : null);
    if (fedDaysAgo !== null) log('fertilize', fedDaysAgo);
    if (sample.repot) {
      log('repot', sample.repot.daysAgo, {
        potSizeCm: sample.repot.potSizeCm,
        soil: sample.repot.soil,
      });
    }
    if (sample.note) log('note', sample.note.daysAgo, { note: sample.note.text });
  }
  return { db, photo: (filename) => stored.get(filename), close: () => database.close() };
}
