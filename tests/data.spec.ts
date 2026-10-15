// Unit tests for the Sheet data layer (no browser needed).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { isSafeUrl, parseBoolean, parseDate } from '../src/lib/schemas';
import { parseCsv, parseSettings, parseTab, SheetError } from '../src/lib/sheet';
import { youtubeEmbedUrl, youtubeId } from '../src/lib/youtube';

const fixture = (tab: string) => readFileSync(join(process.cwd(), 'tests', 'fixtures', `${tab}.csv`), 'utf8');

test.describe('booleans', () => {
  test('accept TRUE/FALSE, yes/no, y/n, 1/0 in any case', () => {
    for (const value of ['TRUE', 'true', 'Yes', 'y', 'Y', '1', ' TRUE ']) expect(parseBoolean(value)).toBe(true);
    for (const value of ['FALSE', 'false', 'NO', 'n', '0']) expect(parseBoolean(value)).toBe(false);
  });

  test('reject anything else', () => {
    for (const value of ['maybe', 'on', '2', 'tru']) expect(parseBoolean(value)).toBeUndefined();
  });

  test('blank uses the column default', () => {
    const csv = 'label,url,category,featured,visible\nDonate,https://example.org,donate,,\n';
    const [row] = parseTab('links', csv).rows;
    expect(row?.featured).toBe(false);
    expect(row?.visible).toBe(true);
  });

  test('a bad boolean skips the row', () => {
    const csv = 'label,url,category,featured\nDonate,https://example.org,donate,sometimes\n';
    const result = parseTab('links', csv);
    expect(result.rows).toHaveLength(0);
    expect(result.warnings).toEqual(['[links] row 2 skipped: featured "sometimes" is not TRUE or FALSE']);
  });
});

test.describe('dates', () => {
  test('accept YYYY-MM-DD and M/D/YYYY', () => {
    expect(parseDate('2026-10-14')).toBe('2026-10-14');
    expect(parseDate('10/14/2026')).toBe('2026-10-14');
    expect(parseDate('1/5/2027')).toBe('2027-01-05');
    expect(parseDate('2028-2-29')).toBe('2028-02-29');
  });

  test('reject other formats and impossible dates', () => {
    for (const value of ['next tues', '14/10/2026', '2026/10/14', 'Oct 14 2026', '2/30/2026', '2027-02-29', '']) {
      expect(parseDate(value)).toBeUndefined();
    }
  });

  test('a bad date skips the row with a clear warning', () => {
    const result = parseTab('events', fixture('events'));
    expect(result.warnings).toContain(
      '[events] row 8 skipped: start_date "next tues" is not a date (use 2026-10-14 or 10/14/2026)',
    );
    expect(result.rows.map((e) => e.title)).not.toContain('Bad Date Event');
  });
});

test.describe('links', () => {
  test('allow only https, http, and mailto', () => {
    expect(isSafeUrl('https://example.org')).toBe(true);
    expect(isSafeUrl('http://example.org/page?x=1')).toBe(true);
    expect(isSafeUrl('mailto:boosters@example.org')).toBe(true);
    for (const value of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://example.org', 'example.org', '/about']) {
      expect(isSafeUrl(value)).toBe(false);
    }
  });

  test('an unsafe link skips the row', () => {
    const result = parseTab('links', fixture('links'));
    expect(result.rows.map((l) => l.label)).not.toContain('Bad Script Link');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/^\[links\] row 10 skipped: url "javascript:alert\(1\)" is not a valid link/);
  });

  test('category must be a known value', () => {
    const csv = 'label,url,category\nDonate,https://example.org,Donate\nShop,https://example.org,store\n';
    const result = parseTab('links', csv);
    expect(result.rows.map((l) => l.category)).toEqual(['donate']);
    expect(result.warnings[0]).toContain('row 3 skipped: category "store" must be one of');
  });
});

test.describe('YouTube', () => {
  test('extract the video ID from supported link styles', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=eRsGyueVLvQ')).toBe('eRsGyueVLvQ');
    expect(youtubeId('https://youtube.com/watch?v=eRsGyueVLvQ&t=10s')).toBe('eRsGyueVLvQ');
    expect(youtubeId('https://m.youtube.com/watch?v=eRsGyueVLvQ')).toBe('eRsGyueVLvQ');
    expect(youtubeId('https://youtu.be/R6MlUcmOul8?si=abc')).toBe('R6MlUcmOul8');
    expect(youtubeId('https://www.youtube.com/shorts/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ');
    expect(youtubeId('https://www.youtube.com/embed/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ');
  });

  test('reject other sites and malformed IDs', () => {
    for (const value of [
      'https://vimeo.com/123456',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/@channel',
      'https://evil.example/watch?v=eRsGyueVLvQ',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(youtubeId(value)).toBeUndefined();
    }
  });

  test('embeds use youtube-nocookie', () => {
    expect(youtubeEmbedUrl('eRsGyueVLvQ')).toBe('https://www.youtube-nocookie.com/embed/eRsGyueVLvQ');
    const result = parseTab('videos', fixture('videos'));
    expect(result.rows.map((v) => v.embedUrl)).toEqual([
      'https://www.youtube-nocookie.com/embed/eRsGyueVLvQ',
      'https://www.youtube-nocookie.com/embed/R6MlUcmOul8',
      'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
    ]);
    expect(result.warnings).toEqual(['[videos] row 5 skipped: youtube_url "https://vimeo.com/123456" is not a YouTube video link']);
  });
});

test.describe('CSV handling', () => {
  test('trims cells, ignores blank rows, and keeps Sheet row numbers', () => {
    const csv = '﻿Title , Start_Date\n  Concert  , 2099-01-01 \n,\n\nBad,nope\n';
    const { headers, rows } = parseCsv('events', csv);
    expect(headers).toEqual(['title', 'start_date']);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.cells).toEqual({ title: 'Concert', start_date: '2099-01-01' });

    const result = parseTab('events', csv);
    expect(result.warnings).toEqual([
      '[events] row 5 skipped: start_date "nope" is not a date (use 2026-10-14 or 10/14/2026)',
    ]);
  });

  test('header names are case-insensitive and extra columns are ignored', () => {
    const csv = 'TITLE,YouTube_URL,Notes For Me\nClip,https://youtu.be/R6MlUcmOul8,ignore me\n';
    expect(parseTab('videos', csv).rows).toHaveLength(1);
  });

  test('a missing required column fails the build', () => {
    expect(() => parseTab('links', 'label,url\nDonate,https://example.org\n')).toThrow(SheetError);
    expect(() => parseTab('links', 'label,url\nDonate,https://example.org\n')).toThrow(
      '[links] required column "category" is missing',
    );
  });

  test('visible = FALSE rows are dropped and counted', () => {
    const result = parseTab('events', fixture('events'));
    expect(result.hidden).toBe(1);
    expect(result.rows.map((e) => e.title)).not.toContain('Hidden Event');
  });
});

test.describe('fixtures load', () => {
  test('every list tab parses with only the expected warnings', () => {
    expect(parseTab('links', fixture('links')).rows).toHaveLength(7);
    expect(parseTab('events', fixture('events')).rows).toHaveLength(5);
    const meetings = parseTab('meetings', fixture('meetings'));
    expect(meetings.rows).toHaveLength(4);
    expect(meetings.warnings).toEqual([]);
    expect(meetings.rows[1]).toMatchObject({ date: '2020-09-29', title: 'General Meeting' });
    expect(parseTab('content', fixture('content')).warnings).toEqual([]);
  });

  test('order defaults to 999', () => {
    const contact = parseTab('links', fixture('links')).rows.find((l) => l.label === 'Email the Board');
    expect(contact?.order).toBe(999);
  });
});

test.describe('content', () => {
  test('image needs alt text', () => {
    const csv = 'page,heading,image,image_alt\nhome,Welcome,choir.jpg,\n';
    const result = parseTab('content', csv);
    expect(result.rows).toHaveLength(0);
    expect(result.warnings).toEqual(['[content] row 2 skipped: image_alt is required when image is set']);
  });

  test('a missing image file is left out with a warning, and the section stays', () => {
    const csv = 'page,heading,image,image_alt\nhome,Welcome,missing.jpg,A photo\n';
    const result = parseTab('content', csv, { imageExists: () => false });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.image).toBeUndefined();
    expect(result.warnings[0]).toContain('image "missing.jpg" is not in public/images/');
  });

  test('image must be a file name, not a path or URL', () => {
    const csv = 'page,image,image_alt\nhome,../secret.jpg,x\nhome,https://example.org/a.jpg,x\n';
    expect(parseTab('content', csv).rows).toHaveLength(0);
  });

  test('line breaks in body are kept', () => {
    const about = parseTab('content', fixture('content')).rows.find((c) => c.heading === 'Board');
    expect(about?.body).toBe('- President: Name\n- Treasurer: Name\n- Secretary: Name');
  });
});

test.describe('settings', () => {
  test('fixture settings load with defaults and line breaks kept', () => {
    const { settings, warnings } = parseSettings(fixture('settings'));
    expect(warnings).toEqual([]);
    expect(settings).toMatchObject({
      club_name: 'AC Choral Boosters',
      contact_email: 'boosters@example.org',
      banner_enabled: false,
      drive_embed: false,
      is_501c3: true,
    });
    expect(settings.mailing_address).toBe('101 W American Canyon Road 508-115\nAmerican Canyon, CA 94503');
    expect(settings.twitter_url).toBeUndefined();
  });

  test('a missing required setting fails the build', () => {
    const csv = 'key,value\nclub_name,Boosters\ncontact_email,a@example.org\nbanner_enabled,FALSE\n';
    expect(() => parseSettings(csv)).toThrow('[settings] required setting "drive_folder_url" is missing or blank');
  });

  test('a bad required setting fails the build', () => {
    const csv =
      'key,value\nclub_name,Boosters\ncontact_email,not-an-email\nbanner_enabled,FALSE\ndrive_folder_url,https://drive.google.com/x\n';
    expect(() => parseSettings(csv)).toThrow('[settings] row 3 contact_email: "not-an-email" is not an email address');
  });

  test('a bad optional setting is ignored with a warning', () => {
    const csv =
      'key,value\nclub_name,Boosters\ncontact_email,a@example.org\nbanner_enabled,no\ndrive_folder_url,https://drive.google.com/x\nbanner_link,https://<square.example.org/pay>\nfavorite_color,blue\n';
    const { settings, warnings } = parseSettings(csv);
    expect(settings.banner_link).toBeUndefined();
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('row 6 banner_link: "https://<square.example.org/pay>" is not a valid link');
    expect(warnings[1]).toBe('[settings] row 7 skipped: "favorite_color" is not a known setting');
  });
});
