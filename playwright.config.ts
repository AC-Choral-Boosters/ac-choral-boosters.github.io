import { defineConfig } from '@playwright/test';

// Unit tests for the data layer run in Node and need no browser.
// Page tests (phase 6) will add a web server and browser projects here.
export default defineConfig({
  testDir: 'tests',
  reporter: 'list',
});
