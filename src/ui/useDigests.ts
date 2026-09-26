import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { scheduleDigests, type Digest, type PendingNotifications } from '@/src/core/digest';
import { db } from '@/src/db/client';
import { plantsNeedYou } from '@/src/ui/words';
import { useAfterWritesOrForeground } from '@/src/ui/useAfterWrites';

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

function schedule({ day, time, displayNames }: Digest): Promise<string> {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const last = displayNames.length - 1;
  return Notifications.scheduleNotificationAsync({
    identifier: `digest-${day}`,
    content: {
      title: plantsNeedYou(displayNames.length),
      body:
        last === 0
          ? displayNames[0]
          : `${displayNames.slice(0, last).join(', ')} and ${displayNames[last]}`,
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

let lastReplan = Promise.resolve();

/**
 * Plans the digests again once the last replan is done, so an older plan never lands on a newer
 * one.
 */
function replan(): void {
  lastReplan = lastReplan
    .then(() => scheduleDigests(db, pending))
    .catch((error) => console.warn('Could not schedule the Daily Digests', error));
}

/**
 * Keeps the pending Daily Digests a projection of the database (ADR-0001): planned at launch,
 * after every burst of writes, and back in the foreground, where the day may have turned.
 */
export function useDigests(): void {
  useAfterWritesOrForeground(replan);
  useEffect(replan, []);
}
