import { localDay, shiftDays } from './dates';

describe('calendar days', () => {
  test('localDay is the calendar day where the device is, not the UTC day', () => {
    expect(localDay(new Date(2026, 8, 22, 0, 30))).toBe('2026-09-22');
  });

  test('shiftDays crosses month and year boundaries', () => {
    expect(shiftDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDays('2025-12-31', 1)).toBe('2026-01-01');
  });
});
