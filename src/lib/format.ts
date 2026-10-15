// Date display helpers. All "today" and display logic uses Pacific time.
export const TIME_ZONE = 'America/Los_Angeles';

/** "Tue, Oct 14, 2026" */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date);
}

/** "Tue, Oct 14, 2026, 3:17 PM PDT" (used for the footer "Last updated" line) */
export function formatTimestamp(date: Date): string {
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: TIME_ZONE,
  }).format(date);
  return `${formatDate(date)}, ${time}`;
}

/** Today's date in Pacific time as "2026-10-14" (comparable with Sheet dates). */
export function todayPacific(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TIME_ZONE,
  }).format(now);
}

/** "2026-10-14" -> "Wed, Oct 14, 2026". Noon UTC is the same calendar day in Pacific time. */
export function formatSheetDate(isoDate: string): string {
  return formatDate(new Date(`${isoDate}T12:00:00Z`));
}

/** One date, or "Sat, Apr 10, 2099 to Tue, Apr 13, 2099" for a range. */
export function formatDateRange(start: string, end?: string): string {
  if (!end || end === start) return formatSheetDate(start);
  return `${formatSheetDate(start)} to ${formatSheetDate(end)}`;
}
