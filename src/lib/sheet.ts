// Loads every Sheet tab once per build, validates each row, and reports what was loaded.
// DATA_SOURCE=live (default) fetches the published CSV URLs in site.config.json.
// DATA_SOURCE=fixtures reads tests/fixtures/<tab>.csv instead (tests and offline dev).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import type { z } from 'astro/zod';
import {
  LIST_TABS,
  REQUIRED_SETTINGS,
  settingsSchema,
  type ContentSection,
  type Event,
  type Link,
  type ListTab,
  type Meeting,
  type Settings,
  type Video,
} from './schemas';

export const TABS = ['settings', 'links', 'events', 'meetings', 'videos', 'content'] as const;
export type Tab = (typeof TABS)[number];

export interface SheetData {
  settings: Settings;
  links: Link[];
  events: Event[];
  meetings: Meeting[];
  videos: Video[];
  content: ContentSection[];
}

export interface TabResult<T> {
  rows: T[];
  /** Rows dropped because visible = FALSE. */
  hidden: number;
  /** One message per skipped row or ignored value. */
  warnings: string[];
}

/** Thrown for problems that must fail the build (unreachable tab, missing column, missing setting). */
export class SheetError extends Error {
  name = 'SheetError';
}

// ---------- CSV parsing ----------

interface RawRow {
  /** Row number as the editor sees it in the Sheet (header is row 1). */
  rowNumber: number;
  cells: Record<string, string | undefined>;
}

/**
 * Parses CSV text into rows keyed by lowercase header name.
 * Cells are trimmed; blank cells become undefined; fully blank rows are dropped.
 */
export function parseCsv(tab: string, csv: string): { headers: string[]; rows: RawRow[] } {
  const result = Papa.parse<string[]>(csv.replace(/^﻿/, ''), { header: false, skipEmptyLines: false });
  const [headerRow, ...dataRows] = result.data;
  if (!headerRow) throw new SheetError(`[${tab}] tab is empty (no header row)`);

  const headers = headerRow.map((h) => h.trim().toLowerCase());
  const rows: RawRow[] = [];
  dataRows.forEach((values, index) => {
    const cells: RawRow['cells'] = {};
    let blank = true;
    headers.forEach((header, col) => {
      if (!header) return;
      const value = (values[col] ?? '').trim();
      cells[header] = value === '' ? undefined : value;
      if (value !== '') blank = false;
    });
    if (!blank) rows.push({ rowNumber: index + 2, cells });
  });
  return { headers, rows };
}

function describeIssue(issue: z.core.$ZodIssue): string {
  const column = issue.path.length > 0 ? String(issue.path[0]) : '';
  return column ? `${column} ${issue.message}` : issue.message;
}

// ---------- Settings tab ----------

/** Parses the Settings tab (columns: key, value). Missing or bad required keys throw SheetError. */
export function parseSettings(csv: string): { settings: Settings; warnings: string[] } {
  const { headers, rows } = parseCsv('settings', csv);
  for (const column of ['key', 'value']) {
    if (!headers.includes(column)) throw new SheetError(`[settings] required column "${column}" is missing`);
  }

  const warnings: string[] = [];
  const shape = settingsSchema.shape;
  const values: Record<string, string> = {};
  const errors: string[] = [];
  const invalidKeys = new Set<string>();

  for (const { rowNumber, cells } of rows) {
    const key = cells.key?.toLowerCase();
    const value = cells.value;
    if (!key) {
      warnings.push(`[settings] row ${rowNumber} skipped: key is blank`);
      continue;
    }
    if (!(key in shape)) {
      warnings.push(`[settings] row ${rowNumber} skipped: "${key}" is not a known setting`);
      continue;
    }
    if (value === undefined) continue;

    const parsed = shape[key as keyof typeof shape].safeParse(value);
    if (parsed.success) {
      values[key] = value;
    } else {
      const message = `[settings] row ${rowNumber} ${key}: ${parsed.error.issues[0]?.message ?? 'is not valid'}`;
      if ((REQUIRED_SETTINGS as readonly string[]).includes(key)) {
        errors.push(message);
        invalidKeys.add(key);
      } else warnings.push(`${message} (ignored)`);
    }
  }

  for (const key of REQUIRED_SETTINGS) {
    if (values[key] === undefined && !invalidKeys.has(key)) {
      errors.push(`[settings] required setting "${key}" is missing or blank`);
    }
  }
  if (errors.length > 0) throw new SheetError(errors.join('\n'));

  // Only values that passed above remain, so this cannot fail; it converts them and fills defaults.
  return { settings: settingsSchema.parse(values), warnings };
}

// ---------- List tabs ----------

export interface ParseOptions {
  /** Used by the Content tab to check that an image file exists in public/images/. */
  imageExists?: (fileName: string) => boolean;
}

type RowOf<K extends ListTab> = z.output<(typeof LIST_TABS)[K]['schema']>;

/** Parses a list tab. Bad rows are skipped with a warning; a missing required column throws SheetError. */
export function parseTab<K extends ListTab>(tab: K, csv: string, options: ParseOptions = {}): TabResult<RowOf<K>> {
  const { schema, requiredColumns } = LIST_TABS[tab];
  const { headers, rows } = parseCsv(tab, csv);
  for (const column of requiredColumns) {
    if (!headers.includes(column)) throw new SheetError(`[${tab}] required column "${column}" is missing`);
  }

  const result: TabResult<RowOf<K>> = { rows: [], hidden: 0, warnings: [] };
  for (const { rowNumber, cells } of rows) {
    const parsed = schema.safeParse(cells);
    if (!parsed.success) {
      const reasons = parsed.error.issues.map(describeIssue).join('; ');
      result.warnings.push(`[${tab}] row ${rowNumber} skipped: ${reasons}`);
      continue;
    }
    const row = parsed.data as RowOf<K>;
    if (!row.visible) {
      result.hidden++;
      continue;
    }
    if (tab === 'content' && options.imageExists) {
      const section = row as ContentSection;
      if (section.image !== undefined && !options.imageExists(section.image)) {
        result.warnings.push(
          `[content] row ${rowNumber}: image "${section.image}" is not in public/images/ (image left out)`,
        );
        section.image = undefined;
        section.image_alt = undefined;
      }
    }
    result.rows.push(row);
  }
  return result;
}

// ---------- Loading ----------

interface SiteConfig {
  sheetTabs: Record<Tab, string>;
}

/** A stalled request fails the build instead of hanging it. */
const FETCH_TIMEOUT_MS = 30_000;

function fixturePath(tab: Tab): string {
  return join(process.cwd(), 'tests', 'fixtures', `${tab}.csv`);
}

async function fetchTab(tab: Tab, source: 'live' | 'fixtures', config: SiteConfig | undefined): Promise<string> {
  if (source === 'fixtures') {
    const path = fixturePath(tab);
    if (!existsSync(path)) throw new SheetError(`[${tab}] fixture file not found: ${path}`);
    return readFileSync(path, 'utf8');
  }

  const url = config?.sheetTabs?.[tab];
  if (!url) throw new SheetError(`[${tab}] no CSV URL in site.config.json (sheetTabs.${tab})`);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    throw new SheetError(`[${tab}] could not reach the Sheet: ${(error as Error).message}`);
  }
  if (!response.ok) throw new SheetError(`[${tab}] could not fetch the Sheet (HTTP ${response.status})`);
  const text = await response.text();
  if (/^\s*</.test(text)) {
    throw new SheetError(`[${tab}] got a web page instead of CSV. Is the Sheet still published to the web?`);
  }
  return text;
}

function readConfig(): SiteConfig {
  const path = join(process.cwd(), 'site.config.json');
  return JSON.parse(readFileSync(path, 'utf8')) as SiteConfig;
}

function dataSource(): 'live' | 'fixtures' {
  const value = (process.env.DATA_SOURCE ?? 'live').toLowerCase();
  if (value !== 'live' && value !== 'fixtures') {
    throw new SheetError(`DATA_SOURCE must be "live" or "fixtures", not "${value}"`);
  }
  return value;
}

async function loadAll(): Promise<SheetData> {
  const source = dataSource();
  const config = source === 'live' ? readConfig() : undefined;
  const texts = await Promise.all(TABS.map((tab) => fetchTab(tab, source, config)));
  const csv = Object.fromEntries(TABS.map((tab, i) => [tab, texts[i]])) as Record<Tab, string>;

  const imagesDir = join(process.cwd(), 'public', 'images');
  const options: ParseOptions = { imageExists: (name) => existsSync(join(imagesDir, name)) };

  const settings = parseSettings(csv.settings);
  const links = parseTab('links', csv.links);
  const events = parseTab('events', csv.events);
  const meetings = parseTab('meetings', csv.meetings);
  const videos = parseTab('videos', csv.videos);
  const content = parseTab('content', csv.content, options);

  const lists = { links, events, meetings, videos, content };
  const warnings = [...settings.warnings, ...Object.values(lists).flatMap((r) => r.warnings)];
  for (const warning of warnings) console.warn(`WARNING ${warning}`);

  console.log(`\nSheet data (${source}):`);
  for (const [tab, result] of Object.entries(lists)) {
    const skipped = result.warnings.filter((w) => w.includes(' skipped:')).length;
    console.log(`  ${tab.padEnd(9)} ${result.rows.length} loaded, ${skipped} skipped, ${result.hidden} hidden`);
  }
  console.log(`  settings  ${settings.warnings.length} warning(s)\n`);

  return {
    settings: settings.settings,
    links: links.rows,
    events: events.rows,
    meetings: meetings.rows,
    videos: videos.rows,
    content: content.rows,
  };
}

let cache: Promise<SheetData> | undefined;

/** Returns all Sheet data. Fetched once per build; every page shares the same result. */
export function loadSheet(): Promise<SheetData> {
  cache ??= loadAll();
  return cache;
}

// ---------- Queries used by pages ----------

/** Sorts by the "order" column, low first. Ties keep Sheet order. */
export function byOrder<T extends { order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.order - b.order);
}

/** Content sections for one page, in order. */
export function sectionsFor(content: ContentSection[], page: ContentSection['page']): ContentSection[] {
  return byOrder(content.filter((section) => section.page === page));
}

/** Links in the given categories, in order. */
export function linksIn(links: Link[], ...categories: Link['category'][]): Link[] {
  return byOrder(links.filter((link) => categories.includes(link.category)));
}

/** Events that have not ended yet (end_date or start_date on or after today), soonest first. */
export function upcomingEvents(events: Event[], today: string): Event[] {
  return events
    .filter((event) => (event.end_date ?? event.start_date) >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

/** Upcoming meetings (today or later) soonest first, then past meetings newest first. */
export function splitMeetings(meetings: Meeting[], today: string): { upcoming: Meeting[]; past: Meeting[] } {
  return {
    upcoming: meetings.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    past: meetings.filter((m) => m.date < today).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** Folder ID from a Drive folder link such as https://drive.google.com/drive/folders/<ID>?usp=sharing. */
export function driveFolderId(url: string): string | undefined {
  return /\/folders\/([A-Za-z0-9_-]+)/.exec(url)?.[1];
}
