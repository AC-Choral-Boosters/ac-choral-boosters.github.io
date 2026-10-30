# Editor guide

You run the website from one Google Sheet. You never need GitHub.

**How long do changes take?** About one hour. The site rebuilds every hour on its own. If something is urgent, text the developer.

## The tabs

| Tab | What it controls |
| --- | --- |
| Settings | Club name, banner, contact info, social links, and the Crab Dinner switch |
| Links | Every button on the site |
| Events | Upcoming events on the home page |
| Meetings | Meetings page |
| Videos | YouTube videos |
| Content | Headings and paragraphs on each page |

Do not rename the tabs or the top row of column names.

## Buttons (Links tab)

Each row is one button. Fill in `label` (the button text), `url`, and `category`. The category decides which page shows the button:

| Category | Where it shows |
| --- | --- |
| donate | Donate page |
| payment | Payments page, under "Payments" |
| tickets | Payments page, under "Tickets" |
| volunteer | Payments page, under "Volunteer" |
| crab_dinner | Crab Dinner page |
| document | About page, under "Official documents" (bylaws, IRS letter, and other compliance papers) |
| other | Nowhere. Do not use this for buttons you want people to see. |

Spaces and capital letters are fine ("Crab Dinner" works), but the word must match one in the table.

Other columns:
- `description`: one short line under the button.
- `order`: a number. Lower numbers come first.
- `featured`: TRUE puts the button on the home page too.
- `visible`: TRUE shows the button. FALSE hides it without deleting it. Use this as the on/off switch.

There is no limit on how many buttons a page can have.

Links must start with `https://`, `http://`, or `mailto:`. Put your documents in Google Drive, share them so anyone with the link can view, and paste that link.

## Crab Dinner tab

The tab is off until you turn it on. In the Settings tab, add a row:

- key: `crab_dinner_enabled`
- value: `TRUE`

Type the key exactly like that. Set the value to `FALSE` to remove the tab and page (for example, after the dinner).

Then add buttons in the Links tab with category `crab_dinner`: the ticket link, the donation letter, and the sponsorship letter. To add text on the page, add a row in the Content tab with page `crab_dinner`.

## Page text (Content tab)

Each row is one block of text on a page. `page` is home, about, donate, payments, crab_dinner, or contact. In `body`, a blank line starts a new paragraph, and lines that start with `- ` become a bullet list. Links and email addresses turn into clickable links on their own.

## If something does not show up

1. Wait one hour.
2. Check the `visible` column is TRUE (or blank).
3. Check the category spelling against the table above.
4. Check the link starts with `https://` and has no spaces.
5. Check that dates look like `10/14/2026`, and `order` is a plain number.
6. For the Crab Dinner tab, check the Settings row is exactly `crab_dinner_enabled` with value `TRUE`.

A row with a mistake is skipped, and the rest of the site still works. If you are still stuck, text the developer.
