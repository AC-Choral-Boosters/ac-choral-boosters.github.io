// Row schemas for each Sheet tab. These must match the column contract in SPEC.md section 5.
// Cells arrive as trimmed strings; blank cells arrive as undefined.
import { z } from 'astro/zod';
import { youtubeId, youtubeEmbedUrl } from './youtube';

// ---------- Field helpers ----------

const TRUE_WORDS = ['true', 'yes', 'y', '1'];
const FALSE_WORDS = ['false', 'no', 'n', '0'];

/** Accepts TRUE/FALSE, yes/no, y/n, 1/0 (any case). Returns true, false, or undefined if not a boolean. */
export function parseBoolean(raw: string): boolean | undefined {
  const value = raw.trim().toLowerCase();
  if (TRUE_WORDS.includes(value)) return true;
  if (FALSE_WORDS.includes(value)) return false;
  return undefined;
}

/** Accepts "2026-10-14" or "10/14/2026". Returns "2026-10-14", or undefined if not a real date. */
export function parseDate(raw: string): string | undefined {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  let year: number, month: number, day: number;
  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (us) [year, month, day] = [Number(us[3]), Number(us[1]), Number(us[2])];
  else return undefined;

  // Reject impossible dates such as 2/30/2026.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return undefined;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Only https, http, and mailto links are allowed. */
export function isSafeUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol === 'mailto:') return url.pathname.length > 0;
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

const required = z.string({ error: 'is required' });

const optionalText = z.string().optional();

const boolean = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return fallback;
      const parsed = parseBoolean(value);
      if (parsed === undefined) {
        ctx.addIssue({ code: 'custom', message: `"${value}" is not TRUE or FALSE` });
        return z.NEVER;
      }
      return parsed;
    });

const date = z.string({ error: 'is required' }).transform((value, ctx) => {
  const parsed = parseDate(value);
  if (parsed === undefined) {
    ctx.addIssue({ code: 'custom', message: `"${value}" is not a date (use 2026-10-14 or 10/14/2026)` });
    return z.NEVER;
  }
  return parsed;
});

const url = z.string({ error: 'is required' }).refine(isSafeUrl, {
  error: (issue) => `"${issue.input}" is not a valid link (must start with https://, http://, or mailto:)`,
});

const order = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return 999;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: 'custom', message: `"${value}" is not a number` });
      return z.NEVER;
    }
    return parsed;
  });

const oneOf = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string({ error: 'is required' })
    .transform((value) => value.toLowerCase())
    .pipe(z.enum(values, { error: (issue) => `"${issue.input}" must be one of: ${values.join(', ')}` }));

// ---------- Settings (key/value tab) ----------

export const settingsSchema = z.object({
  club_name: required,
  tagline: optionalText,
  contact_email: z.email({ error: (issue) => `"${issue.input}" is not an email address` }),
  banner_enabled: boolean(false),
  banner_text: optionalText,
  banner_link: url.optional(),
  drive_folder_url: url,
  drive_embed: boolean(false),
  is_501c3: boolean(false),
  ein: optionalText,
  mailing_address: optionalText,
  instagram_url: url.optional(),
  facebook_url: url.optional(),
  youtube_channel_url: url.optional(),
  twitter_url: url.optional(),
});
export type Settings = z.infer<typeof settingsSchema>;

/** Settings keys that must be present with a value. A missing or bad value fails the build. */
export const REQUIRED_SETTINGS = ['club_name', 'contact_email', 'banner_enabled', 'drive_folder_url'] as const;

// ---------- List tabs ----------

export const LINK_CATEGORIES = ['donate', 'payment', 'tickets', 'volunteer', 'document', 'other'] as const;

export const linkSchema = z.object({
  label: required,
  url,
  description: optionalText,
  category: oneOf(LINK_CATEGORIES),
  featured: boolean(false),
  order,
  visible: boolean(true),
});
export type Link = z.infer<typeof linkSchema>;

export const eventSchema = z.object({
  title: required,
  start_date: date,
  end_date: date.optional(),
  time: optionalText,
  location: optionalText,
  description: optionalText,
  link_label: optionalText,
  link_url: url.optional(),
  visible: boolean(true),
});
export type Event = z.infer<typeof eventSchema>;

export const meetingSchema = z.object({
  date,
  title: z.string().default('General Meeting'),
  time: optionalText,
  location: optionalText,
  agenda_url: url.optional(),
  minutes_url: url.optional(),
  notes: optionalText,
  visible: boolean(true),
});
export type Meeting = z.infer<typeof meetingSchema>;

export const videoSchema = z
  .object({
    title: required,
    youtube_url: z.string({ error: 'is required' }),
    description: optionalText,
    show_on_home: boolean(false),
    order,
    visible: boolean(true),
  })
  .transform((row, ctx) => {
    const id = youtubeId(row.youtube_url);
    if (id === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['youtube_url'],
        message: `"${row.youtube_url}" is not a YouTube video link`,
      });
      return z.NEVER;
    }
    return { ...row, videoId: id, embedUrl: youtubeEmbedUrl(id) };
  });
export type Video = z.infer<typeof videoSchema>;

export const CONTENT_PAGES = ['home', 'about', 'donate', 'payments', 'contact'] as const;

export const contentSchema = z
  .object({
    page: oneOf(CONTENT_PAGES),
    order,
    heading: optionalText,
    body: optionalText,
    image: z
      .string()
      .regex(/^[\w.-]+$/, { error: (issue) => `"${issue.input}" must be a file name only, like choir.jpg` })
      .optional(),
    image_alt: optionalText,
    visible: boolean(true),
  })
  .refine((row) => row.image === undefined || row.image_alt !== undefined, {
    path: ['image_alt'],
    error: 'is required when image is set',
  });
export type ContentSection = z.infer<typeof contentSchema>;

/** Schema and required header columns for each list tab. */
export const LIST_TABS = {
  links: { schema: linkSchema, requiredColumns: ['label', 'url', 'category'] },
  events: { schema: eventSchema, requiredColumns: ['title', 'start_date'] },
  meetings: { schema: meetingSchema, requiredColumns: ['date'] },
  videos: { schema: videoSchema, requiredColumns: ['title', 'youtube_url'] },
  content: { schema: contentSchema, requiredColumns: ['page'] },
} as const;
export type ListTab = keyof typeof LIST_TABS;
