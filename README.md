# AC Choral Boosters website

Static site for the American Canyon High School Choral Boosters. Content comes from a published Google Sheet; GitHub Actions rebuilds the site every hour and publishes it to GitHub Pages.

See `SPEC.md` for requirements and `SETUP.md` for first-time setup. A fuller developer guide comes in phase 7.

## Deploys

- `.github/workflows/deploy.yml` builds from the live Sheet and publishes to GitHub Pages on every push to `main`, every hour at minute 17, and on demand (Actions tab > **Deploy** > **Run workflow**).
- `.github/workflows/test.yml` builds from the sample data in `tests/fixtures/` and runs the tests on every push and pull request.
- If a build fails (for example, the Sheet is unreachable or a required column was renamed), nothing is deployed and the last good site stays live. GitHub emails the repo owners about failed runs.

## Keeping the hourly schedule on

GitHub turns off scheduled workflows in public repositories after 60 days without repository activity. Any push counts as activity.

Once a month the Deploy workflow re-enables itself through GitHub's API to try to prevent this. GitHub does not document this as a guaranteed fix, so check now and then:

1. Open the repo's **Actions** tab and click **Deploy**.
2. If GitHub shows a banner saying the workflow was disabled, click **Enable workflow**.

The site stays online while the schedule is off; it just stops picking up Sheet edits until the workflow is re-enabled or someone pushes.
