# Booster Club Website: Build Spec (v2)

**Goal:** a simple, mobile-first hub site that informs the public and sends them to the right external site to donate, pay, or buy tickets. **Simplicity is the top priority.**

**Architecture in one line:** the editor updates a Google Sheet; a GitHub Actions workflow rebuilds the static Astro site from that Sheet every hour and publishes it to GitHub Pages.

---

## 1. Scope

**In scope**
- 6 pages: Home (hub), Meetings, Donate, Payments, About, Contact
- All editable content (links, dates, meetings, videos, page text, settings) comes from one Google Sheet
- Meeting agendas and minutes live in a Google Drive folder; the site links to them
- YouTube embeds
- A few small images, added to the repo by the developer

**Out of scope (do not build)**
- Taking payments, carts, or checkout
- Public logins, member areas, comments, contact forms
- Hosting documents on the site
- Blog/news feed, photo galleries
- Any server, database, API route, or SSR adapter
- An admin screen or CMS (the Google Sheet is the CMS)

---

## 2. Roles

| Role | Tools | Responsibilities |
| --- | --- | --- |
| Developer (Ivan) | GitHub repo, Actions, domain | Code, layout, images, fixes |
| Editor (club member) | Google Sheet, Google Drive | Links, dates, meetings, videos, page text, banner |
| Visitor | Browser | Read only |

The editor never needs a GitHub account.

---

## 3. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Site generator | Astro (latest stable) | Static output. No adapter. |
| Styling | Plain CSS with CSS variables | No CSS framework. |
| Data source | Google Sheet, each tab "Published to the web" as CSV | Fetched at build time only. |
| CSV parsing | `papaparse` (or `csv-parse`) | One small dependency. |
| Validation | `zod` (via `astro/zod`) | Per-row validation. |
| Hosting | GitHub Pages | Deployed by GitHub Actions. |
| CI/CD | GitHub Actions | On push, hourly schedule, manual run. |
| Tests | Playwright + @axe-core/playwright | Run against fixture CSVs. |

No client-side JavaScript on public pages, except the YouTube iframe itself.

---

## 4. Data source

### 4.1 Configuration
`site.config.json` (committed, not secret; published CSVs are public anyway):

```json
{
  "sheetTabs": {
    "settings": "https://docs.google.com/spreadsheets/d/e/<PUB_ID>/pub?gid=<GID>&single=true&output=csv",
    "links": "...",
    "events": "...",
    "meetings": "...",
    "videos": "...",
    "content": "..."
  }
}
```

### 4.2 Loader behavior (`src/lib/sheet.ts`)
- Env var `DATA_SOURCE=live|fixtures`. Default `live`. Tests and local dev without internet use `fixtures` (CSV files in `tests/fixtures/`).
- Fetch each tab's CSV once per build; cache in memory for the build.
- Trim whitespace; ignore fully blank rows; header names are case-insensitive.
- Booleans accept `TRUE/FALSE`, `yes/no`, `y/n`, `1/0` (case-insensitive). Blank = default.
- Dates accept `YYYY-MM-DD` and `M/D/YYYY` (Google Sheets default US format).
- **Bad row:** skip it, print a clear warning (`[events] row 7 skipped: start_date "next tues" is not a date`). The build continues.
- **Fatal (fail the build):** a tab cannot be fetched, a required column is missing, or Settings is missing a required key. A failed build leaves the last good site live on GitHub Pages.
- Write a build summary to the Actions log: rows loaded and rows skipped per tab.

### 4.3 Safety rules
- Escape all Sheet text. Never render raw HTML from the Sheet.
- Links: allow only `https://`, `http://`, and `mailto:`. Anything else = row skipped.
- YouTube: accept `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/` URLs; extract the 11-character video ID; render `https://www.youtube-nocookie.com/embed/<ID>`. Anything else = row skipped.
- Images: filename only, must exist in `public/images/`. Missing file = image omitted with a warning.

---

## 5. Sheet tabs (column contract)

Column names below are the exact header row. The provided template (`Booster_Club_Site_Template.xlsx`) matches this contract.

### 5.1 Settings (two columns: `key`, `value`)
| key | Required | Example |
| --- | --- | --- |
| club_name | yes | Example High Boosters |
| tagline | no | Supporting our students since 1998 |
| contact_email | yes | boosters@example.org |
| banner_enabled | yes | FALSE |
| banner_text | no | Tour payment due Friday |
| banner_link | no | https://... |
| drive_folder_url | yes | https://drive.google.com/drive/folders/<ID> |
| drive_embed | no (default FALSE) | TRUE shows the Drive folder inline on Meetings |
| is_501c3 | no | TRUE |
| ein | no | 12-3456789 |
| mailing_address | no | 101 W American Canyon Road 508-115, American Canyon, CA 94503 (line breaks in the cell are kept) |
| instagram_url, facebook_url, youtube_channel_url, twitter_url | no | https://... |

### 5.2 Links
| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| label | text | yes | Button text |
| url | url | yes | External site |
| description | text | no | One line under the button |
| category | donate, payment, tickets, volunteer, document, other | yes | Which page lists it. `document` = official documents (bylaws, IRS letter) stored in Google Drive |
| featured | boolean | no (FALSE) | Show on Home |
| order | number | no (999) | Sort order, low first |
| visible | boolean | no (TRUE) | FALSE hides without deleting |

### 5.3 Events
| Column | Type | Required |
| --- | --- | --- |
| title | text | yes |
| start_date | date | yes |
| end_date | date | no |
| time | text | no (e.g. "6:30 PM") |
| location | text | no |
| description | text | no |
| link_label | text | no |
| link_url | url | no |
| visible | boolean | no (TRUE) |

### 5.4 Meetings
| Column | Type | Required |
| --- | --- | --- |
| date | date | yes |
| title | text | no (default "General Meeting") |
| time | text | no |
| location | text | no |
| agenda_url | url | no |
| minutes_url | url | no |
| notes | text | no |
| visible | boolean | no (TRUE) |

### 5.5 Videos
| Column | Type | Required |
| --- | --- | --- |
| title | text | yes |
| youtube_url | url | yes |
| description | text | no |
| show_on_home | boolean | no (FALSE) |
| order | number | no (999) |
| visible | boolean | no (TRUE) |

### 5.6 Content (page text)
| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| page | home, about, donate, payments, contact | yes | |
| order | number | no (999) | Section order on that page |
| heading | text | no | |
| body | text | no | Blank line = new paragraph; lines starting with "- " become a bullet list; bare URLs and emails auto-link |
| image | filename | no | From `public/images/` |
| image_alt | text | required if image set | |
| visible | boolean | no (TRUE) | |

---

## 6. Pages and acceptance criteria

Shared layout: header (club name, nav), banner when `banner_enabled` is TRUE, footer (contact email, mailing address when set, social links, "501(c)(3) nonprofit, EIN ..." when set).

### Home `/` (hub)
- Content sections where `page = home`
- Featured, visible Links as large tap-friendly buttons, sorted by `order`
- Next 3 upcoming Events (end_date or start_date >= today, Pacific time)
- Next upcoming Meeting with link to Meetings page
- Videos with `show_on_home = TRUE` (max 2)
- External links show an off-site icon and have `rel="noopener"`

### Meetings `/meetings`
- Upcoming meetings (date >= today) first, then past meetings newest first
- Each row: date, time, title, location, "Agenda" and "Minutes" links only when present
- Prominent "All meeting documents" button to `drive_folder_url`
- When `drive_embed` is TRUE: also embed `https://drive.google.com/embeddedfolderview?id=<FOLDER_ID>#list` in an iframe (folder ID parsed from `drive_folder_url`); the button still shows as fallback

### Donate `/donate`
- Content sections where `page = donate`
- Buttons for visible Links with `category = donate`
- 501(c)(3) / EIN line when set

### Payments `/payments`
- Content sections where `page = payments`
- Buttons for visible Links with `category` in (payment, tickets), grouped under "Payments" and "Tickets"
- Visible Links with `category = volunteer` under "Volunteer" if any exist

### About `/about`
- Content sections where `page = about`
- "Official documents" list: visible Links with `category = document`, sorted by `order`, showing label and description (hidden when empty)
- Videos not shown on home, if any (optional section, hidden when empty)

### Contact `/contact`
- Content sections where `page = contact`
- `mailto:` link to `contact_email`, mailing address when set, social links. No form.

### Global
- Mobile-first, readable at 320 px
- Lighthouse accessibility and performance >= 90
- axe: zero serious or critical violations
- Per-page title and meta description; favicon; Open Graph tags
- Empty sections hide cleanly (no empty headings)
- "Last updated" timestamp in footer (build time, Pacific)

---

## 7. Deployment (GitHub Actions)

`.github/workflows/deploy.yml`:
- Triggers: `push` to `main`, `schedule` hourly at minute 17 (`17 * * * *`, avoids top-of-hour congestion), `workflow_dispatch` (manual "Run now")
- Steps: checkout, install, build with `DATA_SOURCE=live`, upload Pages artifact, deploy to Pages. Use the official Astro GitHub Action or the standard Pages actions (check current Astro docs).
- No custom domain yet. `astro.config` reads `site` and `base` from env vars `SITE_URL` and `BASE_PATH`, which the workflow fills from `actions/configure-pages` outputs. Before a domain: `https://<org>.github.io` + `/<repo>`. After a domain is set in repo Settings > Pages: the domain + no base. No code change needed when the domain is added.
- All internal links and asset paths go through `withBase()` in `src/lib/paths.ts`.
- Scheduled workflows in public repos are disabled after 60 days without repo activity. Add a safeguard (for example a monthly keepalive step or documented re-enable check). Check current GitHub docs for the recommended approach.
- Custom domain (later): set in repo Settings > Pages. Check current GitHub docs on whether `public/CNAME` is needed for Actions-based deploys (believed not).

`.github/workflows/test.yml`: on pull request and push, run build + Playwright with `DATA_SOURCE=fixtures`.

---

## 8. Repo layout (target)

```
/
  .github/workflows/deploy.yml  test.yml
  public/  CNAME  favicon.svg  images/
  src/
    lib/sheet.ts  schemas.ts  format.ts  youtube.ts  text.ts
    components/  Header Footer Banner LinkButton EventList MeetingList VideoEmbed ContentSection
    layouts/Base.astro
    pages/  index meetings donate payments about contact (.astro)
    styles/global.css
  tests/  fixtures/*.csv  *.spec.ts
  site.config.json
  CLAUDE.md  SPEC.md  SETUP.md  README.md
```

---

## 9. Build phases (in order, commit after each, stop for review)

1. **Scaffold:** Astro project, base layout, global CSS, nav, footer, 6 empty pages.
2. **Data layer:** `sheet.ts` loader, zod schemas for all 6 tabs, fixture CSVs matching section 5, unit tests for parsing (booleans, both date formats, bad rows skipped, URL and YouTube validation).
3. **Pages:** implement section 6 using fixtures.
4. **Live data:** wire `site.config.json` URLs; confirm a live build works.
5. **Deploy:** both workflows, CNAME, keepalive safeguard.
6. **Tests:** Playwright smoke per page, banner on/off, past events hidden, empty-state checks, axe scan.
7. **Docs:** README (developer: run, test, deploy, add an image) and `EDITOR_GUIDE.md` (one page, plain language: how to edit each tab, how long updates take, what to do if something does not appear).

---

## 10. Definition of done
- `npm run build` passes with fixtures and with live data
- `npx playwright test` passes
- Every acceptance criterion in section 6 checked
- A bad row in the Sheet is skipped without breaking the site
- An unreachable Sheet fails the build and leaves the previous site live
- Editor can update a link, add a meeting, and toggle the banner using only the Sheet and see it live within about an hour
