// @ts-check
import { defineConfig } from 'astro/config';

// The deploy workflow sets SITE_URL and BASE_PATH from GitHub Pages (actions/configure-pages):
// - No custom domain yet: SITE_URL=https://<org>.github.io, BASE_PATH=/<repo>
// - Custom domain set in repo Settings > Pages: SITE_URL=https://<domain>, BASE_PATH empty
// Local dev and tests use neither, so the site is served from "/".
const site = process.env.SITE_URL || undefined;
const base = process.env.BASE_PATH || undefined;

export default defineConfig({ site, base });
