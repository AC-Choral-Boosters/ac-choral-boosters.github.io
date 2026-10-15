// Unit tests for page helpers: body text formatting, dates, and list queries (no browser needed).
import { expect, test } from '@playwright/test';
import { formatDateRange, formatSheetDate, todayPacific } from '../src/lib/format';
import type { Event, Meeting } from '../src/lib/schemas';
import { driveFolderId, splitMeetings, upcomingEvents } from '../src/lib/sheet';
import { linkify, parseBody } from '../src/lib/text';

test.describe('body text', () => {
  test('blank lines split paragraphs; single line breaks stay in the paragraph', () => {
    expect(parseBody('One\nTwo\n\nThree')).toEqual([
      { type: 'paragraph', lines: [[{ text: 'One' }], [{ text: 'Two' }]] },
      { type: 'paragraph', lines: [[{ text: 'Three' }]] },
    ]);
  });

  test('lines starting with "- " become a bullet list', () => {
    expect(parseBody('Board:\n- President: A\n- Treasurer: B')).toEqual([
      { type: 'paragraph', lines: [[{ text: 'Board:' }]] },
      { type: 'list', items: [[{ text: 'President: A' }], [{ text: 'Treasurer: B' }]] },
    ]);
  });

  test('bare URLs and emails become links, without trailing punctuation', () => {
    expect(linkify('Visit https://example.org/a?b=1. Or email us@example.org!')).toEqual([
      { text: 'Visit ' },
      { text: 'https://example.org/a?b=1', href: 'https://example.org/a?b=1' },
      { text: '. Or email ' },
      { text: 'us@example.org', href: 'mailto:us@example.org' },
      { text: '!' },
    ]);
  });

  test('HTML in the body stays plain text', () => {
    expect(parseBody('<script>alert(1)</script>')).toEqual([
      { type: 'paragraph', lines: [[{ text: '<script>alert(1)</script>' }]] },
    ]);
  });
});

test.describe('dates', () => {
  test('display as "Tue, Oct 14, 2026"', () => {
    expect(formatSheetDate('2026-10-14')).toBe('Wed, Oct 14, 2026');
    expect(formatDateRange('2099-04-10', '2099-04-13')).toBe('Fri, Apr 10, 2099 to Mon, Apr 13, 2099');
    expect(formatDateRange('2099-04-10', '2099-04-10')).toBe('Fri, Apr 10, 2099');
  });

  test('"today" is the Pacific date, even late at night UTC', () => {
    // 2026-10-15 05:00 UTC is still Oct 14 in California.
    expect(todayPacific(new Date('2026-10-15T05:00:00Z'))).toBe('2026-10-14');
    expect(todayPacific(new Date('2026-10-15T08:00:00Z'))).toBe('2026-10-15');
  });
});

test.describe('queries', () => {
  const event = (title: string, start_date: string, end_date?: string): Event => ({
    title,
    start_date,
    end_date,
    visible: true,
  });
  const meeting = (date: string): Meeting => ({ date, title: 'General Meeting', visible: true });

  test('upcoming events include today and multi-day events still running, soonest first', () => {
    const events = [
      event('Later', '2026-12-01'),
      event('Over', '2026-10-13'),
      event('Today', '2026-10-14'),
      event('Running', '2026-10-10', '2026-10-16'),
    ];
    expect(upcomingEvents(events, '2026-10-14').map((e) => e.title)).toEqual(['Running', 'Today', 'Later']);
  });

  test('meetings split into upcoming (soonest first) and past (newest first)', () => {
    const { upcoming, past } = splitMeetings(
      [meeting('2026-09-01'), meeting('2026-11-01'), meeting('2026-10-14'), meeting('2026-08-01')],
      '2026-10-14',
    );
    expect(upcoming.map((m) => m.date)).toEqual(['2026-10-14', '2026-11-01']);
    expect(past.map((m) => m.date)).toEqual(['2026-09-01', '2026-08-01']);
  });

  test('Drive folder ID comes from the folder link', () => {
    expect(driveFolderId('https://drive.google.com/drive/folders/19jtohE2V6zyIrDZBLXNupPKJVcQ11ee-?usp=sharing')).toBe(
      '19jtohE2V6zyIrDZBLXNupPKJVcQ11ee-',
    );
    expect(driveFolderId('https://drive.google.com/drive/u/0/folders/abc_123')).toBe('abc_123');
    expect(driveFolderId('https://drive.google.com/file/d/abc/view')).toBeUndefined();
  });
});
