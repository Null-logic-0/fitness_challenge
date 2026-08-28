# 5-Minute Challenge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-BC52EE.svg)](https://astro.build)

Pull-ups + dips. One timer. Maximum reps. A competitive fitness platform built like a technology product: measurable, data-driven, and international from day one.

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Internationalization](#internationalization)
- [Auth & data model](#auth--data-model)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

- **The 5-minute timer** — a get-ready countdown, live rep counting for pull-ups and dips, undo, and pace/projection math, all client-side with zero framework runtime. A no-timer path exists too: anyone who already recorded an attempt on their own can just type in the count and drop in the video link.
- **Guest exploration, gated saving** — anyone can run the timer without an account. Finishing while signed out preserves the attempt through registration/login and restores it automatically, so nothing is lost.
- **Video-verified results** — every submission requires a YouTube link as proof; results are immutable once submitted (improving a score means a new attempt, not editing an old one).
- **Global leaderboard** — filterable by scope (global/country), time window, and category, with infinite scroll and distinct loading/empty/error states.
- **Athlete profiles** — public, shareable pages with personal bests, attempt history, and a progression chart.
- **Challenge a friend** — generate a shareable invite tied to a specific result; accepting and completing an invite both go through audited RPCs.
- **Admin panel** — full CRUD on submitted results (create/edit/delete) gated on `profiles.is_admin`, with every change written to an audit log.
- **Four languages** — English, Georgian, Spanish, and Russian, each with its own indexable route tree and CLDR-correct pluralization/number formatting.
- **SEO-ready** — per-locale sitemap with hreflang alternates, `robots.txt`, JSON-LD structured data, and correct Open Graph/Twitter Card metadata for social sharing.

## Tech stack

- **[Astro](https://astro.build)** — static by default, with a handful of pages opting into server rendering for live per-request Supabase data (island architecture: most pages ship zero JS)
- **JavaScript** (ES modules, no TypeScript, no framework runtime)
- **[Tailwind CSS v4](https://tailwindcss.com)** + **[daisyUI v5](https://daisyui.com)** — custom dark theme, `src/styles/global.css`
- **[Supabase](https://supabase.com)** — Postgres + Auth, accessed with the browser client (`src/db/supabase.js`); access control is enforced by Row Level Security, not by the app
- **[Vitest](https://vitest.dev)** + jsdom — unit tests for every utility, i18n helper, and script module
- **Noto Sans / Noto Sans Georgian / JetBrains Mono** via `@fontsource-variable` (Latin, Cyrillic, Georgian coverage; digits render in a tabular monospace face)

## Getting started

### Prerequisites

- Node.js 22.12 or later
- A [Supabase](https://supabase.com) project (free tier is enough)

### Setup

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Supabase project's URL and publishable (anon) key:
   ```bash
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_KEY=your-anon-key
   ```
   These are safe to expose in the browser bundle — access control is enforced by Postgres Row Level Security, not by keeping this key secret.
3. **Run the database migrations once**, in the Supabase dashboard → SQL Editor, in order: everything under `supabase/migrations/`. Nothing in the app works until these exist — auth still works without them, but sign-up won't create a profile row, and every results/leaderboard/invite query will come back empty.
4. In Supabase Auth settings, decide whether "Confirm email" is on. If it is, `auth-form.js` shows a "check your email" panel after sign-up instead of redirecting straight through — either flow works, this just changes how many clicks it takes.
5. Start the dev server:
   ```bash
   npm run dev
   ```

## Scripts

| Command               | Action                                            |
| :--------------------- | :------------------------------------------------- |
| `npm run dev`           | Start the dev server at `localhost:4321`          |
| `npm run build`         | Build the site to `./dist/` (static + serverless) |
| `npm run preview`       | Preview the production build locally              |
| `npm test`              | Run the unit test suite once                      |
| `npm run test:watch`    | Run the unit test suite in watch mode             |
| `npm run test:coverage` | Run the unit test suite with a coverage report    |

## Project structure

```
src/
  components/   Small, single-purpose Astro components
  layouts/      Layout.astro — head/meta/hreflang/OG/JSON-LD, theme, font loading
  pages/[lang]/ Locale-prefixed routes (index, challenge, leaderboard, submit,
                athletes, login, register, me, settings, admin, results/[id],
                challenge/invite/[token])
  i18n/         Translation dictionaries + locale utilities
  scripts/      Vanilla JS modules: challenge timer, leaderboard filters, auth,
                submission, share, invites, admin panel, settings
  utils/        Intl-based formatting, YouTube URL parsing, country names
  data/         Illustrative mock content for homepage marketing sections only
                (platform stats, engineer pipeline numbers, challenge-card previews)
  db/           Supabase client + query helpers
supabase/
  migrations/   SQL schema, RLS policies, and RPCs — run manually, see Setup above
tests/
  setup.js      Shared jsdom polyfills for the unit test suite
```

Interactive components each own a small script module and ship no more JS than they need. Marketing pages (home, rules, how-it-works) are fully static. Leaderboard, athlete profiles, public results, and invite pages are server-rendered (`export const prerender = false`) so they always reflect live Supabase data and get correct per-page Open Graph metadata when shared.

## Testing

Unit tests cover every utility, i18n helper, and script module (`*.test.js` next to the file it tests), using [Vitest](https://vitest.dev) with a jsdom environment. Supabase and browser APIs the scripts depend on (`<dialog>`, `IntersectionObserver`, `navigator.clipboard`, `HTMLFormElement` named field access) are mocked or polyfilled — see `tests/setup.js`.

```bash
npm test              # run once
npm run test:coverage # with a coverage report
```

Astro components (`.astro` files) and the SQL migrations aren't covered by this suite — they call for different tooling (Astro's container API / end-to-end tests, and pgTAP/integration tests against a real Postgres instance, respectively).

## Internationalization

Four first-class locales, each with its own indexable route tree: `/en`, `/ka`, `/es`, `/ru`. Translations live in `src/i18n/{en,ka,es,ru}.js` behind one shared key structure; `src/i18n/utils.js` provides `useTranslations`, locale-aware routing helpers, and CLDR-correct pluralization (`pluralize`). Numbers, dates, and pace figures always go through `Intl.*` (`src/utils/format.js`) — never manual string formatting.

## Auth & data model

- **Guest exploration, gated saving**: anyone can run the 5-minute timer. Finishing while signed out saves the attempt to `localStorage` (`src/scripts/auth.js`) and prompts register/login; the attempt is restored automatically on `/submit` once a session exists, with no need to redo the challenge.
- **Results are immutable**: `results.total` is a Postgres generated column (`pull_ups + dips`), and there is deliberately no UPDATE/DELETE policy for regular users — see `supabase/migrations/0001_init.sql`. Improving a score means inserting a new row, not editing an old one. Admin corrections go through audited `admin_*` RPCs, which require membership in the `admins` table and always write to `result_audit_log`.
- **Personal best & leaderboard** both read from the `public.leaderboard` view (best non-rejected result per user) — there's no separate, editable "score" field anywhere.
- **YouTube proof**: `src/utils/youtube.js` validates `youtube.com/watch?v=...`, `youtu.be/...`, and `/shorts/...` links and extracts the video id, stored alongside the URL. A `check` constraint on `youtube_video_id` rejects malformed ids at the database level too.
- **Invites**: `/challenge/invite/[token]` reads an invite + the referenced result; accepting and completing go through the `accept_invite`/`complete_invite` RPCs (not raw UPDATEs), so an invite can't be hijacked into pointing at someone else's result.
- **Profile fields**: display name, country, age range, and category (open/men/women, used by the leaderboard filters) are set at registration and editable afterward from `/settings`.

## Deployment

Configured out of the box for [Vercel](https://vercel.com) via `@astrojs/vercel` — prerendered pages (most of the site) are served as static assets, and the pages that opt out with `export const prerender = false` (leaderboard, athlete profiles, results, invites) run as serverless functions.

1. Import the repository into Vercel.
2. Set the `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_KEY` environment variables in the project settings (same values as `.env.local`).
3. Deploy — no other configuration is needed.

Deploying elsewhere: swap the `adapter` line in `astro.config.mjs` for `@astrojs/netlify`, `@astrojs/cloudflare`, or `@astrojs/node`; nothing else needs to change.

## Contributing

Contributions are welcome — bug fixes, translation improvements, and small features are all a good fit.

1. Fork the repository and create a branch off `master`.
2. Follow the existing code style: plain JavaScript (no TypeScript), no framework runtime in `src/scripts/`, and `Intl.*` for all number/date/pluralization formatting rather than hand-rolled strings.
3. If you change a script module in `src/scripts/`, `src/utils/`, `src/i18n/`, or `src/db/`, add or update its `*.test.js` and make sure `npm test` passes.
4. If you change the database schema, add a new file under `supabase/migrations/` rather than editing an existing one — migrations are applied in order and existing ones are treated as immutable history.
5. Keep pull requests focused on a single change, and describe what changed and why in the description.

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/Null-logic-0/fitness_challenge/issues).

## License

Licensed under the [MIT License](LICENSE).
