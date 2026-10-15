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
