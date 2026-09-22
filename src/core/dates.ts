/**
 * Calendar days as 'YYYY-MM-DD' in the device's local timezone: Care Events are dated by day
 * (ADR-0005) and due-ness is day-granular (spec #8), so the core never reasons in instants here.
 */

export function localDay(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The day `days` after `day` (before, when negative). */
export function shiftDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  // Noon, so a DST hour lost or gained cannot move the result onto another day.
  return localDay(new Date(year, month - 1, date + days, 12));
}

/** Whether `value` is a real calendar day written as 'YYYY-MM-DD'. */
export function isCalendarDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && shiftDays(value, 0) === value;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
