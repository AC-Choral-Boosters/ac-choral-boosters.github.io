# Setup Guide

Simple steps to stand up the booster club site. Do them in order. Total time: about 2 to 3 hours, spread over a couple of sessions.

**Who does what**
- **You (developer):** Parts 1 to 6
- **Editor:** only Part 7 (a Google account and the Sheet)

**Does the editor need GitHub or OAuth?** No. With this design he edits only the Google Sheet and Drive folder. There is no GitHub account, login screen, or OAuth app to manage. (See the appendix if you ever switch to an admin screen.)

---

## Part 1: Club accounts (15 min)

Use club-owned accounts so the site survives volunteer turnover.

1. Create a club Google account (for example `boosters.example@gmail.com`), or use an existing one.
2. Create a free GitHub organization (github.com > your avatar > Your organizations > New organization > Free). Name it after the club.
3. Add yourself as Owner. Add a second board member as Owner too, so you're not the only key holder.
4. Store both logins in the club's shared password manager or with the treasurer.

---

## Part 2: Google Drive folder (10 min)

1. Signed in as the club account, create a folder named **Meeting Documents**.
2. Optional: add subfolders by school year (2026-27).
3. Share > General access > **Anyone with the link: Viewer**.
4. Share the folder with the editor as **Editor** so he can upload.
5. Copy the folder URL. You'll paste it into the Sheet's Settings tab.

**Per-meeting links:** for each agenda or minutes file, the editor right-clicks > Share > Copy link (the folder's "anyone with the link" setting carries over).

---

## Part 3: Google Sheet (20 min)

1. In Google Drive (club account), New > File upload > `Booster_Club_Site_Template.xlsx`.
2. Open it > File > **Save as Google Sheets**. Delete the uploaded .xlsx.
3. Rename it "Booster Club Website Content".
4. Fill in the **Settings** tab (club name, email, Drive folder URL). Replace the sample rows in other tabs, or leave them as examples marked `visible = FALSE`.
5. **Protect the header row** on every tab: select row 1 > right-click > View more cell actions > Protect range > Set permissions > Only you. This stops accidental column renames that would break the build.
6. **Publish to the web:** File > Share > Publish to web.
    - Choose **Entire Document**, format **Web page**, check **Automatically republish when changes are made**, click Publish.
7. **Get each tab's CSV link:**
    - Click the tab; the browser URL ends in `#gid=123456`. Note the number.
    - From the Publish dialog, copy the published link; it contains `/d/e/<PUB_ID>/pubhtml`.
    - Build each CSV URL like this:
      `https://docs.google.com/spreadsheets/d/e/<PUB_ID>/pub?gid=<GID>&single=true&output=csv`
    - Open each URL in a browser; a CSV file should download or display.
8. Put the six URLs in `site.config.json` (Claude Code creates this file in phase 4).

Note: published data can lag a few minutes behind edits. Combined with hourly builds, changes appear within about 1 hour.

---

## Part 4: Build the site with Claude Code (1 to 2 hours)

1. In the club GitHub org, create a **public** repo (for example `booster-site`). Public is required for free GitHub Pages and is fine here; nothing secret lives in it.
2. Clone it locally. Add `SPEC.md`, `CLAUDE.md`, `SETUP.md`, and the template file to the root. Commit.
3. Open Claude Code in that folder and paste:

   > Read CLAUDE.md and SPEC.md. Build phase 1 only, run the build, commit, then stop and summarize what you did and any questions before phase 2.

4. Review each phase's commit, then say "continue with phase N."
5. At phase 4, give Claude Code your six CSV URLs.

---

## Part 5: Turn on GitHub Pages (10 min)

1. Repo > Settings > Pages > Build and deployment > Source: **GitHub Actions**.
2. Push to `main` (or Actions tab > deploy workflow > **Run workflow**).
3. When it finishes, the site is live at `https://<org>.github.io/<repo>/` (until the custom domain is set).
4. Confirm the workflow shows the hourly schedule under the Actions tab.

---

## Part 6: Custom domain (20 min + DNS wait)

1. Buy a domain (Cloudflare Registrar, Namecheap, Porkbun, or Squarespace Domains). Register it to the club account.
2. In the GitHub org: Settings > Pages > **Add a domain** and verify it (prevents domain takeover).
3. At your DNS provider, add records (confirm current values in GitHub Pages docs):
    - Apex (`example.org`): four A records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
    - `www`: CNAME to `<org>.github.io`
4. Repo > Settings > Pages > Custom domain: enter the domain, Save.
5. When DNS resolves (minutes to a few hours), check **Enforce HTTPS**.
6. No code change is needed. The next deploy picks up the domain automatically (no `CNAME` file is used).

---

## Part 7: Editor handoff (20 min, with him)

1. Share the Google Sheet with his Google account as **Editor**. (Header rows stay protected.)
2. Confirm he can upload to the Drive folder.
3. Walk through three practice edits together:
    - Change a link URL on the **Links** tab
    - Add a meeting row with an agenda link on the **Meetings** tab
    - Turn the banner on and off on the **Settings** tab (`banner_enabled` TRUE/FALSE)
4. Give him `EDITOR_GUIDE.md` (Claude Code writes it in phase 7) as a PDF or a pinned Google Doc.
5. Set expectations: **changes show up within about an hour.** If he needs something urgent, he texts you and you click Run workflow.

**Images and videos:** he pastes YouTube links in the **Videos** tab himself. For pictures, he sends them to you; you resize to under 300 KB, add to `public/images/`, and he references the filename in the **Content** tab.

---

## Ongoing maintenance (5 min a month)

- **Build failures:** GitHub emails you when a scheduled run fails. The last good site stays live, so check the Actions log and fix the Sheet row or tab it names.
- **60-day rule:** GitHub disables scheduled workflows in public repos after 60 days without repo activity. A monthly keepalive step tries to prevent this, but GitHub does not guarantee it works. If the Actions tab ever shows the Deploy workflow as disabled, click it and choose **Enable workflow** (see README).
- **Yearly:** renew the domain; review Owners in the GitHub org and Google account access when the board changes.

---

## Appendix: if you ever switch to an admin screen (GitHub + OAuth)

Only needed if he outgrows the Sheet (for example, wants to upload images himself). Rough steps:

1. Editor creates a free GitHub account with 2FA; you add him to the repo as a collaborator with Write access.
2. Add Sveltia CMS at `/admin` with a config matching the content model.
3. Create a GitHub OAuth App (org Settings > Developer settings > OAuth Apps), callback URL pointing to the auth worker.
4. Deploy Sveltia's `sveltia-cms-auth` Cloudflare Worker (free tier) with the OAuth client ID and secret as Worker secrets.
5. Set the worker URL as `base_url` in the CMS config.

You own the OAuth app and worker under the club org and Cloudflare account; he only ever signs in with his GitHub login. Removing access later is one click (remove the collaborator).
