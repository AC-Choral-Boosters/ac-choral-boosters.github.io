# CLAUDE.md

Project: Booster club hub website. Full requirements are in `SPEC.md`; read it before any work.

## Architecture
Google Sheet (published CSV per tab) -> Astro static build in GitHub Actions (hourly + on push) -> GitHub Pages.
Meeting documents live in Google Drive; the site only links to them.

## Principles
- **Simplicity first.** If a feature is not in SPEC.md, do not add it. Ask instead.
- Static only. No server, database, API routes, SSR adapter, or CMS.
- No client-side JS on public pages (YouTube iframes excepted).
- No payments or forms. External links only.
- Minimal dependencies. Justify any new package in the commit message.

## Data rules
- The Sheet column contract in SPEC.md section 5 is the source of truth. Schemas in `src/lib/schemas.ts`, fixtures in `tests/fixtures/`, and the editor guide must all match it.
- Never render raw HTML from Sheet data. Escape everything.
- Allow only https, http, and mailto links. Validate YouTube URLs and use youtube-nocookie embeds.
- Bad row: skip and warn. Unreachable tab or missing required column: fail the build.
- Dates: accept `YYYY-MM-DD` and `M/D/YYYY`. "Today" means America/Los_Angeles. Display as "Tue, Oct 14, 2026".
- Never hard-code a club URL in a component; it comes from the Sheet.

## Workflow
- Work through SPEC.md section 9 phases in order. Commit after each phase, then stop and summarize.
- After each phase run `npm run build` (with `DATA_SOURCE=fixtures`) and `npx playwright test`; fix failures before moving on.
- Check current Astro, GitHub Actions, and GitHub Pages docs before writing config. Do not rely on memory for version-specific APIs.
- Accessible by default: semantic HTML, alt text, visible focus, descriptive link text, 4.5:1 contrast.
- UI copy and docs: plain language, no em dashes.

## Commands
- `npm run dev` local dev (use `DATA_SOURCE=fixtures` offline)
- `npm run build` production build
- `npm run preview` preview build
- `npx playwright test` tests
