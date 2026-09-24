import { and, desc, eq, isNull, max } from 'drizzle-orm';

import { CARE_EVENT_TYPES, careEvents, plants } from '../db/schema';
import type { Db } from '../db/types';
import { checkPastOrToday, localDay } from './dates';
import { checkPotSize, getPlant, trimToNull } from './plants';

export { CARE_EVENT_TYPES };

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

/**
 * A plant's Care Log (CONTEXT.md): its live Care Events, newest first, as a query so the UI can
 * subscribe with useLiveQuery; listCareEvents runs it.
 */
export function careLogQuery(db: Db, plantId: string) {
  return db
    .select()
    .from(careEvents)
    .where(and(eq(careEvents.plantId, plantId), isNull(careEvents.deletedAt)))
    .orderBy(desc(careEvents.occurredOn), desc(careEvents.createdAt));
}

export function listCareEvents(db: Db, plantId: string): CareEvent[] {
  return careLogQuery(db, plantId).all();
}

/** Every Care Event row, Deleted ones included as tombstones: the care_events table an Export carries (ADR-0002). */
export function listCareEventRows(db: Db): CareEvent[] {
  return db.select().from(careEvents).orderBy(careEvents.createdAt).all();
}

/**
 * Appends a Care Event to a live plant's Care Log. Due-ness derives from the log on the next
 * evaluation; nothing else is stored, except that a repot newer than every other repot sets the
 * plant's Current Pot (CONTEXT.md).
 */
export function logCareEvent(db: Db, input: NewCareEvent, now: Date = new Date()): CareEvent {
  const stamp = now.toISOString();
  const today = localDay(now);
  const event: CareEvent = {
    id: crypto.randomUUID(),
    plantId: input.plantId,
    type: input.type,
    occurredOn: input.occurredOn ?? today,
    note: trimToNull(input.note),
    potSizeCm: input.potSizeCm ?? null,
    soil: trimToNull(input.soil),
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  validateCareEvent(event, today);
  const plant = getPlant(db, event.plantId);
  const { potSizeCm, soil } = event;
  const setsCurrentPot =
    event.type === 'repot' &&
    (potSizeCm !== null || soil !== null) &&
    event.occurredOn >= newestRepotDay(db, plant.id);
  db.transaction((tx) => {
    tx.insert(careEvents).values(event).run();
    if (setsCurrentPot) {
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

/** A live Care Event by id; throws for an unknown or Deleted one. */
export function getCareEvent(db: Db, id: string): CareEvent {
  const event = db
    .select()
    .from(careEvents)
    .where(and(eq(careEvents.id, id), isNull(careEvents.deletedAt)))
    .get();
  if (!event) throw new Error(`No care event ${id}`);
  return event;
}

/** The fields editCareEvent may change; anything else on a patch object is ignored. */
const EDITABLE = [
  'occurredOn',
  'note',
  'potSizeCm',
  'soil',
] as const satisfies readonly (keyof CareEvent)[];

export type CareEventPatch = Partial<Pick<CareEvent, (typeof EDITABLE)[number]>>;

/**
 * Edits a live Care Event: the day it happened, its text, a repot's pot size and soil; its type
 * and plant are fixed. Due-ness re-derives from the Care Log on the next evaluation, while the
 * Current Pot stays as it is, even for the newest repot (CONTEXT.md). Undefined entries leave the
 * field as it is; timestamps and tombstones are never patchable.
 */
export function editCareEvent(
  db: Db,
  id: string,
  patch: CareEventPatch,
  now: Date = new Date(),
): CareEvent {
  const next = getCareEvent(db, id);
  for (const key of EDITABLE) {
    if (patch[key] !== undefined) Object.assign(next, { [key]: patch[key] });
  }
  next.note = trimToNull(next.note);
  next.soil = trimToNull(next.soil);
  next.updatedAt = now.toISOString();
  validateCareEvent(next, localDay(now));
  db.update(careEvents).set(next).where(eq(careEvents.id, id)).run();
  return next;
}

/**
 * The rules a Care Event is logged and edited under: a real day no later than today, text on a
 * Note, and a pot size or soil only on a repot, the size positive.
 */
function validateCareEvent(event: CareEvent, today: string): void {
  checkPastOrToday(event.occurredOn, today);
  if (event.type === 'note' && event.note === null) throw new Error('A Note needs some text');
  if (event.type !== 'repot' && (event.potSizeCm !== null || event.soil !== null)) {
    throw new Error(`Only a repot records a pot size or soil, not a ${event.type}`);
  }
  checkPotSize(event.potSizeCm);
}

/**
 * Deletes a live Care Event (CONTEXT.md, Deleted) as a tombstone, so the deletion survives Export
 * and Import (ADR-0002). Due-ness re-derives from what is left of the Care Log; the Current Pot
 * stays as it is. Throws for an unknown or already Deleted event.
 */
export function deleteCareEvent(db: Db, id: string, now: Date = new Date()): CareEvent {
  const stamp = now.toISOString();
  const tombstone = db
    .update(careEvents)
    .set({ updatedAt: stamp, deletedAt: stamp })
    .where(and(eq(careEvents.id, id), isNull(careEvents.deletedAt)))
    .returning()
    .get();
  if (!tombstone) throw new Error(`No care event ${id}`);
  return tombstone;
}

/** The day of the plant's newest live repot Care Event; '' when there is none. */
function newestRepotDay(db: Db, plantId: string): string {
  const row = db
    .select({ on: max(careEvents.occurredOn) })
    .from(careEvents)
    .where(
      and(
        eq(careEvents.plantId, plantId),
        eq(careEvents.type, 'repot'),
        isNull(careEvents.deletedAt),
      ),
    )
    .get();
  return row?.on ?? '';
}
