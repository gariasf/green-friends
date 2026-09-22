import { daysBetween, localDay, shiftDays, shiftMonths } from './dates';

describe('calendar days', () => {
  test('localDay is the calendar day where the device is, not the UTC day', () => {
    // Just after local midnight and just before the next one: a day computed through UTC gets at
    // least one of these wrong in any timezone off UTC (tests run in Pacific/Auckland).
    expect(localDay(new Date(2026, 8, 22, 0, 30))).toBe('2026-09-22');
    expect(localDay(new Date(2026, 8, 22, 23, 30))).toBe('2026-09-22');
  });

  test('shiftDays crosses month and year boundaries', () => {
    expect(shiftDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  test('shiftMonths keeps the day of the month, clamped to the last day of a shorter month', () => {
    expect(shiftMonths('2025-03-31', 24)).toBe('2027-03-31');
    expect(shiftMonths('2025-08-31', 18)).toBe('2027-02-28');
    expect(shiftMonths('2024-01-31', 1)).toBe('2024-02-29');
  });

  test('daysBetween counts calendar days, unmoved by the DST change in between', () => {
    // Pacific/Auckland enters DST on 2026-09-27: that "day" is 23 hours long.
    expect(daysBetween('2026-09-26', '2026-09-28')).toBe(2);
    expect(daysBetween('2026-09-28', '2026-09-26')).toBe(-2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });
});
