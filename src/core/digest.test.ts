import { MONSTERA, gardenDb, noon } from '../test/garden';
import { logCareEvent } from './careLog';
import { planDigests, scheduleDigests, type Digest, type PendingNotifications } from './digest';
import { archivePlant, createPlant, NO_SCHEDULE, type CareSchedule } from './plants';
import { updateSettings } from './settings';

/** A local moment in 2026, as the planner takes `now`. */
const at = (month: number, day: number, hour: number, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute);

describe('Daily Digest planner', () => {
  test('a day with nothing Due gets no digest: the first comes on the day care falls Due', () => {
    const db = gardenDb();
    // Watered every 7 days from its creation: Due Sep 29.
    createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));

    const [first] = planDigests(db, at(9, 22, 18));

    expect(first).toEqual({ day: '2026-09-29', time: '09:00', plants: ['Monstera'] });
  });

  test('Overdue care keeps a digest on every day until it is logged, the soonest 64 at most', () => {
    const db = gardenDb();
    createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));

    const digests = planDigests(db, at(9, 22, 18));

    // 64 days from Sep 29 to Dec 1, every one of them: iOS keeps no more than 64 pending.
    expect(digests).toHaveLength(64);
    expect(digests[0].day).toBe('2026-09-29');
    expect(digests[63].day).toBe('2026-12-01');
  });

  test("today's digest is planned only while the digest time is still ahead", () => {
    const db = gardenDb();
    // Watering Due since Sep 8.
    createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));

    expect(planDigests(db, at(9, 29, 8, 59))[0].day).toBe('2026-09-29');
    expect(planDigests(db, at(9, 29, 9, 0))[0].day).toBe('2026-09-30');
  });

  test('digests fire at the digest time chosen in settings', () => {
    const db = gardenDb();
    createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));

    updateSettings(db, { digestTime: '07:30' });

    // At 08:00 today's 07:30 has passed, where the default 09:00 would not have.
    expect(planDigests(db, at(9, 29, 8))[0]).toEqual({
      day: '2026-09-30',
      time: '07:30',
      plants: ['Monstera'],
    });
  });

  test('a digest names the plants that Need Attention that day, most Overdue first', () => {
    const db = gardenDb();
    // Watering Due Sep 8, Sep 22 and Sep 27.
    createPlant(db, { speciesId: MONSTERA, nickname: 'Window' }, noon(2026, 9, 1));
    createPlant(db, { speciesId: MONSTERA, nickname: 'Shelf' }, noon(2026, 9, 15));
    createPlant(db, { speciesId: MONSTERA, nickname: 'Desk' }, noon(2026, 9, 20));

    const digests = planDigests(db, at(9, 22, 8));

    expect(digests[0]).toMatchObject({ day: '2026-09-22', plants: ['Window', 'Shelf'] });
    expect(digests[5]).toMatchObject({ day: '2026-09-27', plants: ['Window', 'Shelf', 'Desk'] });
  });

  test('logging the Due care leaves no digest until care falls Due again', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));

    logCareEvent(db, { plantId: plant.id, type: 'water' }, noon(2026, 9, 29));

    // Watered again Oct 6; fertilizing (monthly) first Due Oct 22.
    expect(planDigests(db, at(9, 29, 18))[0].day).toBe('2026-10-06');
  });

  test('an Archived plant brings no digest', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));

    archivePlant(db, plant.id);

    expect(planDigests(db, at(9, 29, 8))).toEqual([]);
  });

  test('fertilizing brings no digest while Paused and brings one back on the first Growing day; the season months move both', () => {
    const db = gardenDb();
    const schedule: CareSchedule = {
      ...NO_SCHEDULE,
      fertilizingGrowingDays: 30,
      fertilizingDormantDays: null,
    };
    // Fed monthly from its creation (Due Oct 22), Paused from November (Growing is March-October).
    createPlant(db, { nickname: 'Fern', schedule }, noon(2026, 9, 22));

    const byDefault = planDigests(db, at(9, 22, 18)).map((digest) => digest.day);
    expect(byDefault.slice(9, 11)).toEqual(['2026-10-31', '2027-03-01']);

    updateSettings(db, { growingEndMonth: 11 });

    const longerGrowing = planDigests(db, at(9, 22, 18)).map((digest) => digest.day);
    expect(longerGrowing.slice(39, 41)).toEqual(['2026-11-30', '2027-03-01']);
  });

  test('care first Due more than a year ahead waits for a later plan', () => {
    const db = gardenDb();
    // Repotted every 24 months and nothing else: first Due Sep 22, 2028.
    createPlant(
      db,
      { nickname: 'Cactus', schedule: { ...NO_SCHEDULE, repottingMonths: 24 } },
      noon(2026, 9, 22),
    );

    expect(planDigests(db, at(9, 22, 18))).toEqual([]);
  });
});

describe('Daily Digest projection', () => {
  /** A fake of the device's pending notifications. */
  function device() {
    let pending: Digest[] = [];
    const notifications: PendingNotifications = {
      replace: async (digests) => void (pending = digests),
    };
    return { notifications, pending: () => pending.map((digest) => digest.day) };
  }

  test('scheduling replaces what is pending with the digests planned at that moment', async () => {
    const db = gardenDb();
    const phone = device();
    // Watering Due since Sep 8, fertilizing (monthly) first Due Oct 1.
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));
    await scheduleDigests(db, phone.notifications, at(9, 29, 8));
    expect(phone.pending().slice(0, 2)).toEqual(['2026-09-29', '2026-09-30']);

    logCareEvent(db, { plantId: plant.id, type: 'water' }, at(9, 29, 8, 30));
    await scheduleDigests(db, phone.notifications, at(9, 29, 8, 30));

    expect(phone.pending()[0]).toBe('2026-10-01');
  });
});
