import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

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
 * useAfterWrites, and on returning to the foreground too: for what derives from the day as well as
 * the database, since the day may have turned while the app was away.
 */
export function useAfterWritesOrForeground(onChange: () => void): void {
  useAfterWrites(onChange);
  useEffect(() => {
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') onChange();
    });
    return () => foreground.remove();
  }, [onChange]);
}
