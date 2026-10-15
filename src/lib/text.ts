// Turns a Content tab "body" cell into structured blocks for safe rendering (no raw HTML).
// Rules (SPEC.md 5.6): a blank line starts a new paragraph; lines starting with "- " become
// a bullet list; bare URLs and email addresses become links.
import { isSafeUrl } from './schemas';

export type Inline = { text: string } | { text: string; href: string };
/** A line of inline pieces. */
export type Line = Inline[];
export type Block = { type: 'paragraph'; lines: Line[] } | { type: 'list'; items: Line[] };

// URLs stop before trailing punctuation so "see https://example.org." links without the period.
const LINK_PATTERN = /(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]'])|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** Splits text into plain pieces and link pieces. */
export function linkify(text: string): Line {
  const pieces: Line = [];
  let last = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const [found, url, email] = match;
    const href = url ?? `mailto:${email}`;
    if (!isSafeUrl(href)) continue;
    if (match.index > last) pieces.push({ text: text.slice(last, match.index) });
    pieces.push({ text: found, href });
    last = match.index + found.length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last) });
  return pieces;
}

/** Parses a body cell into paragraphs and bullet lists. */
export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  const chunks = body.replace(/\r\n?/g, '\n').split(/\n\s*\n/);

  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    let paragraph: string[] = [];
    let list: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph.map(linkify) });
      paragraph = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ type: 'list', items: list.map(linkify) });
      list = [];
    };

    for (const line of lines) {
      if (line.startsWith('- ')) {
        flushParagraph();
        list.push(line.slice(2).trim());
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushList();
  }
  return blocks;
}
