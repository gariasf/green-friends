import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';
import type { Db } from './types';

/**
 * The app's single on-device database. Only src/core mutation functions may write to it.
 * The change listener is what lets screens re-read after those writes: Drizzle's useLiveQuery,
 * and useAfterWrites (src/ui) for screens over several tables.
 */
const expo = openDatabaseSync('green-friends.db', { enableChangeListener: true });
export const db: Db = drizzle(expo, { schema });
