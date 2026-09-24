import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { scheduleDigests, type Digest, type PendingNotifications } from '@/src/core/digest';
import { db } from '@/src/db/client';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

/** The phone's pending notifications, which hold the Daily Digests and nothing else. */
const pending: PendingNotifications = {
  async replace(digests) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (digests.length === 0 || !(await allowed())) return;
    await Promise.all(digests.map(schedule));
  },
};

/**
 * Whether iOS lets the app notify, asked the first time there is something to remind about: an
 * alert and its sound, never a badge.
 */
async function allowed(): Promise<boolean> {
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  if (granted || !canAskAgain) return granted;
  const request = { ios: { allowAlert: true, allowSound: true } };
  return (await Notifications.requestPermissionsAsync(request)).granted;
}

function schedule({ day, time, plants }: Digest): Promise<string> {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return Notifications.scheduleNotificationAsync({
    identifier: `digest-${day}`,
    content: {
      title: plants.length === 1 ? '1 plant needs you' : `${plants.length} plants need you`,
      body:
        plants.length === 1 ? plants[0] : `${plants.slice(0, -1).join(', ')} and ${plants.at(-1)}`,
    },
    // Calendar fields, not an instant: an instant already past is refused, while a day and time
    // keep to the local clock wherever the phone is.
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      year,
      month,
      day: date,
      hour,
      minute,
    },
  });
}

let projection = Promise.resolve();

/** Plans the digests again, each run after the last, so an older plan never lands on a newer one. */
function project(): void {
  projection = projection
    .then(() => scheduleDigests(db, pending))
    .catch((error) => console.warn('Could not schedule the Daily Digests', error));
}

/**
 * Keeps the pending Daily Digests a projection of the database (ADR-0001): planned at launch,
 * after every burst of writes, and back in the foreground, where the day may have turned.
 */
export function useDigests(): void {
  useAfterWrites(project);
  useEffect(() => {
    project();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') project();
    });
    return () => foreground.remove();
  }, []);
}
