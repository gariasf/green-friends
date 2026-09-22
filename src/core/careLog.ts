import { and, desc, eq, isNull } from 'drizzle-orm';

import { careEvents } from '../db/schema';
import type { Db } from '../db/types';

export type CareEvent = typeof careEvents.$inferSelect;

/** A plant's Care Log (CONTEXT.md): its live Care Events, newest first. */
export function listCareEvents(db: Db, plantId: string): CareEvent[] {
  return db
    .select()
    .from(careEvents)
    .where(and(eq(careEvents.plantId, plantId), isNull(careEvents.deletedAt)))
    .orderBy(desc(careEvents.occurredOn), desc(careEvents.createdAt))
    .all();
}
