import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { msToNextDay } from '@/src/core/dates';

/**
 * Calls `onWrites` after every burst of database writes, for a screen over several tables, which
 * useLiveQuery (one table) would miss. expo-sqlite reports every changed row; one call per burst
 * (an Import, a deleted plant's Care Log) is enough.
 */
export function useAfterWrites(onWrites: () => void): void {
  useEffect(() => {
    let burst: ReturnType<typeof setTimeout> | undefined;
    const writes = addDatabaseChangeListener(() => {
      clearTimeout(burst);
      burst = setTimeout(onWrites, 50);
    });
    return () => {
      clearTimeout(burst);
      writes.remove();
    };
  }, [onWrites]);
}

/**
 * useAfterWrites, on returning to the foreground and at local midnight too: for what derives from
 * the day as well as the database, since the day may turn while the app is away or left open.
 */
export function useAfterWritesOrForeground(onChange: () => void): void {
  useAfterWrites(onChange);
  useEffect(() => {
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') onChange();
    });
    // A second past midnight, so a timer firing a touch early still lands on the new day. iOS
    // holds timers while the app is away; returning to the foreground covers that.
    let midnight: ReturnType<typeof setTimeout>;
    const untilMidnight = () => {
      midnight = setTimeout(
        () => {
          onChange();
          untilMidnight();
        },
        msToNextDay(new Date()) + 1000,
      );
    };
    untilMidnight();
    return () => {
      foreground.remove();
      clearTimeout(midnight);
    };
  }, [onChange]);
}
