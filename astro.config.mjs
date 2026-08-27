// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://5minchallenge.com',
  trailingSlash: 'never',
  // Static by default (every page prerenders) — a handful of pages that
  // need live per-request Supabase data or per-result OG metadata opt out
  // with `export const prerender = false` (leaderboard, results/[id],
  // challenge/invite/[token]). The Node adapter is the most portable
  // choice when no specific host is targeted; swap for @astrojs/vercel or
  // @astrojs/netlify if deploying to one of those instead — the only
  // change needed is this `adapter` line.
  adapter: node({ mode: 'standalone' }),
  vite: {
    plugins: [tailwindcss()],
  },
});
