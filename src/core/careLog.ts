import { and, desc, eq, isNull, max, ne } from 'drizzle-orm';

import { CARE_EVENT_TYPES, careEvents, plants } from '../db/schema';
import type { Db } from '../db/types';
import { checkPastOrToday, localDay } from './dates';
import { checkPotSize, getPlant, trimToNull } from './plants';

export type CareEvent = typeof careEvents.$inferSelect;
export type CareEventType = (typeof CARE_EVENT_TYPES)[number];

export type NewCareEvent = {
  plantId: string;
  type: CareEventType;
  /** The local calendar day it happened ('YYYY-MM-DD', ADR-0005); today when omitted, never future. */
  occurredOn?: string;
  /** Free text; required for a Note. */
  note?: string | null;
  /** Repot only: the new pot size (cm) and soil, which also become the Current Pot when this is the newest repot. */
  potSizeCm?: number | null;
  soil?: string | null;
};

/** A plant's Care Log (CONTEXT.md): its live Care Events, newest first. */
export function listCareEvents(db: Db, plantId: string): CareEvent[] {
  return db
    .select()
    .from(careEvents)
    .where(and(eq(careEvents.plantId, plantId), isNull(careEvents.deletedAt)))
    .orderBy(desc(careEvents.occurredOn), desc(careEvents.createdAt))
    .all();
}

/**
 * Appends a Care Event to a live plant's Care Log. Due-ness derives from the log on the next
 * evaluation; nothing else is stored, except that a repot newer than every other repot sets the
 * plant's Current Pot (CONTEXT.md).
 */
export function logCareEvent(db: Db, input: NewCareEvent, now: Date = new Date()): CareEvent {
  const stamp = now.toISOString();
  const today = localDay(now);
  const occurredOn = input.occurredOn ?? today;
  checkPastOrToday(occurredOn, today);
  const note = trimToNull(input.note);
  const potSizeCm = input.potSizeCm ?? null;
  const soil = trimToNull(input.soil);
  if (input.type === 'note' && note === null) throw new Error('A Note needs some text');
  if (input.type !== 'repot' && (potSizeCm !== null || soil !== null)) {
    throw new Error(`Only a repot records a pot size or soil, not a ${input.type}`);
  }
  checkPotSize(potSizeCm);
  const plant = getPlant(db, input.plantId);
  const event: CareEvent = {
    id: crypto.randomUUID(),
    plantId: plant.id,
    type: input.type,
    occurredOn,
    note,
    potSizeCm,
    soil,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  db.transaction((tx) => {
    tx.insert(careEvents).values(event).run();
    const newPot = potSizeCm !== null || soil !== null;
    if (event.type === 'repot' && newPot && occurredOn >= newestRepotDay(tx, plant.id, event.id)) {
      tx.update(plants)
        .set({
          potSizeCm: potSizeCm ?? plant.potSizeCm,
          soil: soil ?? plant.soil,
          updatedAt: stamp,
        })
        .where(eq(plants.id, plant.id))
        .run();
    }
  });
  return event;
}

/** The day of the plant's latest live repot other than `except`; '' when there is none. */
function newestRepotDay(db: Db, plantId: string, except: string): string {
  const row = db
    .select({ on: max(careEvents.occurredOn) })
    .from(careEvents)
    .where(
      and(
        eq(careEvents.plantId, plantId),
        eq(careEvents.type, 'repot'),
        ne(careEvents.id, except),
        isNull(careEvents.deletedAt),
      ),
    )
    .get();
  return row?.on ?? '';
}
