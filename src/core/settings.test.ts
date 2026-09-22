import { openTestDb } from '../test/db';
import { getSettings, updateSettings } from './settings';

describe('settings', () => {
  test('a fresh database carries the default settings', () => {
    const db = openTestDb();

    expect(getSettings(db)).toMatchObject({
      growingStartMonth: 3,
      growingEndMonth: 10,
      digestTime: '09:00',
    });
  });

  test('updating the growing season is visible on the next read', () => {
    const db = openTestDb();

    updateSettings(db, { growingStartMonth: 10, growingEndMonth: 3 });

    expect(getSettings(db)).toMatchObject({
      growingStartMonth: 10,
      growingEndMonth: 3,
      digestTime: '09:00',
    });
  });

  test('a mutation stamps updatedAt as UTC ISO-8601 from the core clock', () => {
    const db = openTestDb();

    updateSettings(db, { growingEndMonth: 9 }, new Date('2026-09-22T07:30:00.000Z'));

    expect(getSettings(db).updatedAt).toBe('2026-09-22T07:30:00.000Z');
  });

  test('rejects a month outside 1-12 and leaves settings untouched', () => {
    const db = openTestDb();

    expect(() => updateSettings(db, { growingStartMonth: 13 })).toThrow(/1 to 12/);

    expect(getSettings(db)).toMatchObject({ growingStartMonth: 3 });
  });
});
