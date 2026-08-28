// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://5minchallenge.com',
  trailingSlash: 'never',
  // Static by default (every page prerenders) — a handful of pages that
  // need live per-request Supabase data or per-result OG metadata opt out
  // with `export const prerender = false` (leaderboard, results/[id],
  // challenge/invite/[token]). Deployed on Vercel: prerendered pages are
  // served as static assets and the opted-out ones run as serverless
  // functions — no extra config needed beyond this adapter line and the
  // PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_KEY env vars in the Vercel
  // project settings.
  adapter: vercel(),
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en-US', ka: 'ka-GE', es: 'es-ES', ru: 'ru-RU' },
      },
      // Skip the locale-less "/" redirect shim (its own <link rel="canonical">
      // already points at /en) and the noindex-marked personal/private pages
      // (admin, settings, me) — a sitemap should only list canonical,
      // indexable URLs.
      filter: (page) => {
        const path = new URL(page).pathname;
        return path !== '/' && !/\/(admin|settings|me)(\/|$)/.test(path);
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
