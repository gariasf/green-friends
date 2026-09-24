/**
 * Calendar days as 'YYYY-MM-DD' in the device's local timezone: Care Events are dated by day
 * (ADR-0005) and due-ness is day-granular (spec #8), so the core never reasons in instants here.
 * The one time of day the core knows, the Daily Digest's, is a local 'HH:MM' likewise.
 */

export function localDay(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The local time of day at `at`, as 'HH:MM' (the Daily Digest time's format). */
export function localTime(at: Date): string {
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** The day `days` after `day` (before, when negative). */
export function shiftDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  // Noon, so a DST hour lost or gained cannot move the result onto another day.
  return localDay(new Date(year, month - 1, date + days, 12));
}

/**
 * The same day of the month `months` later; a day the target month lacks becomes its last day
 * (Aug 31 + 18 months = Feb 28).
 */
export function shiftMonths(day: string, months: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const lastOfTarget = new Date(year, month - 1 + months + 1, 0, 12).getDate();
  return localDay(new Date(year, month - 1 + months, Math.min(date, lastOfTarget), 12));
}

/** Calendar days from `from` to `to`, negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  // Both days at UTC midnight, so no DST change in between can leave a fraction.
  return Math.round((utcMidnight(to) - utcMidnight(from)) / 86_400_000);
}

/** Whether `value` is a real calendar day written as 'YYYY-MM-DD'. */
export function isCalendarDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && shiftDays(value, 0) === value;
}

/** Throws unless `day` is a real calendar day no later than `today`: care never happens in the future. */
export function checkPastOrToday(day: string, today: string): void {
  if (!isCalendarDay(day)) throw new Error(`Not a calendar day: ${day}`);
  if (day > today) throw new Error(`${day} is in the future`);
}

function utcMidnight(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
