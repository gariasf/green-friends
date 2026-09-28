import type { Db } from '../db/types';
import { forecastCare, needsAttention } from './care';
import { localDay, localTime, shiftDays } from './dates';
import { getSettings } from './settings';

/**
 * The Daily Digest (CONTEXT.md): one notification, at the digest time, on each day at least one
 * plant Needs Attention. Pending notifications are a projection of the database (ADR-0001):
 * planned again from the Care Log whenever care state changes, never stored.
 */

/**
 * iOS keeps an app's 64 soonest pending local notifications and drops the rest.
 * ponytail: a phone not opened through 64 digests goes quiet; a background task could replan.
 */
const DIGEST_CAP = 64;

/**
 * How far ahead the planner looks: one whole turn of the Seasons. Care first Due later than that
 * waits for a later plan.
 */
const HORIZON_DAYS = 366;

/**
 * One Daily Digest: the day it fires, at `time` ('HH:MM', local), for the plants that Need
 * Attention that day, most Overdue first.
 */
export type Digest = { day: string; time: string; displayNames: string[] };

/**
 * The Daily Digests to have pending at `now`: the soonest DIGEST_CAP days ahead on which at least
 * one plant will Need Attention if nothing more is logged, today among them while its digest time
 * is still ahead and today's has not already shown. Recomputed on every change, the window rolls
 * forward.
 */
export function planDigests(db: Db, now: Date = new Date(), shownToday = false): Digest[] {
  const { digestTime: time } = getSettings(db);
  const careOn = forecastCare(db);
  const today = localDay(now);
  // ponytail: moving the digest time earlier than now, before today's has shown, drops today's;
  // fine while nobody retimes it daily.
  let day = !shownToday && localTime(now) < time ? today : shiftDays(today, 1);
  const digests: Digest[] = [];
  for (let n = 0; n < HORIZON_DAYS && digests.length < DIGEST_CAP; n++, day = shiftDays(day, 1)) {
    const displayNames = careOn(day)
      .filter(needsAttention)
      .map((plant) => plant.displayName);
    if (displayNames.length > 0) digests.push({ day, time, displayNames });
  }
  return digests;
}

/**
 * The device's pending notifications, injected so the core stays plain TypeScript (ADR-0001): the
 * app hands in expo-notifications, tests a fake. The app schedules nothing but Daily Digests.
 */
export type PendingNotifications = {
  /** Cancels every pending notification and schedules `digests` in their place. */
  replace(digests: Digest[]): Promise<void>;
  /**
   * The digest last remembered, across launches: the device's own, never in an Export, since it
   * says what this phone has shown. Undefined until the first plan.
   */
  remembered(): Pick<Digest, 'day' | 'time'> | undefined;
  remember(digest: Pick<Digest, 'day' | 'time'> | undefined): void;
};

/**
 * Recomputes the projection: what is pending becomes the Daily Digests planned at `now`. It
 * remembers the soonest planned, or today's once its time has passed, so that a digest time moved
 * later on the same day never shows today's twice.
 */
export async function scheduleDigests(
  db: Db,
  pending: PendingNotifications,
  now: Date = new Date(),
): Promise<void> {
  const last = pending.remembered();
  const shownToday = last?.day === localDay(now) && last.time <= localTime(now);
  const digests = planDigests(db, now, shownToday);
  await pending.replace(digests);
  const soonest = digests[0] && { day: digests[0].day, time: digests[0].time };
  pending.remember(shownToday ? last : soonest);
}
