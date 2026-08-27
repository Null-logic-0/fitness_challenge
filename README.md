# 5-Minute Challenge

Pull-ups + dips. One timer. Maximum reps. A competitive fitness platform built like a technology product: measurable, data-driven, international from day one.

## Stack

- **Astro**, static by default with a Node adapter for the handful of pages that need live per-request data (island architecture — most pages ship zero JS)
- **JavaScript** (ES modules, no TypeScript, no framework runtime)
- **Tailwind CSS v4** + **daisyUI v5** (custom dark theme, `src/styles/global.css`)
- **Supabase** — Postgres + Auth, accessed with the browser client (`src/db/supabase.js`); access control is enforced by Row Level Security, not by the app
- **Noto Sans / Noto Sans Georgian / JetBrains Mono** via `@fontsource-variable` (Latin, Cyrillic, Georgian coverage; digits render in a tabular monospace face)

## Setup

1. `npm install`
2. Copy `.env.local` (already present with the project's URL and publishable key) — no changes needed unless pointing at a different Supabase project.
3. **Run the database migration once**, in the Supabase dashboard → SQL Editor → paste and run `supabase/migrations/0001_init.sql`. Nothing in the app works until this exists (auth still works without it, but signup won't create a profile row, and every results/leaderboard/invite query will come back empty).
4. In Supabase Auth settings, decide whether "Confirm email" is on. If it is, `auth-form.js` shows a "check your email" panel after signup instead of redirecting straight through — either flow works, this just changes how many clicks it takes.
5. `npm run dev`

## Internationalization

Four first-class locales, each with its own indexable route tree: `/en`, `/ka`, `/es`, `/ru`. Translations live in `src/i18n/{en,ka,es,ru}.js` behind one shared key structure; `src/i18n/utils.js` provides `useTranslations`, locale-aware routing helpers, and CLDR-correct pluralization (`pluralize`). Numbers, dates, and pace figures always go through `Intl.*` (`src/utils/format.js`) — never manual string formatting.

## Structure

```
src/
  components/   Small, single-purpose Astro components
  layouts/      Layout.astro — head/meta/hreflang/OG, theme, font loading
  pages/[lang]/ Locale-prefixed routes (index, challenge, leaderboard, submit,
                athletes, login, register, me, results/[id], challenge/invite/[token])
  i18n/         Translation dictionaries + locale utilities
  scripts/      Vanilla JS modules: challenge timer, leaderboard filters, language
                persistence, auth, submission, share, invites
  utils/        Intl-based formatting + YouTube URL parsing
  data/         Illustrative mock content for homepage marketing sections only
                (platform stats, engineer pipeline numbers, challenge-card previews)
  db/           Supabase client
supabase/
  migrations/   SQL schema, RLS policies, and RPCs — run manually, see Setup above
```

Interactive components each own a small script module and ship no more JS than they need. Marketing pages (home, rules, how-it-works) are fully static. Leaderboard, athlete profiles, public results, and invite pages are server-rendered (`export const prerender = false`) so they always reflect live Supabase data and get correct per-page Open Graph metadata when shared.

## Auth & data model

- **Guest exploration, gated saving**: anyone can run the 5-minute timer. Finishing while signed out saves the attempt to `localStorage` (`src/scripts/auth.js`) and prompts register/login; the attempt is restored automatically on `/submit` once a session exists, with no need to redo the challenge.
- **Results are immutable**: `results.total` is a Postgres generated column (`pull_ups + dips`), and there is deliberately no UPDATE/DELETE policy for regular users — see `supabase/migrations/0001_init.sql`. Improving a score means inserting a new row, not editing an old one. Admin corrections go through the `admin_set_result_status()` RPC, which requires membership in the `admins` table and always writes to `result_audit_log`.
- **Personal best & leaderboard** both read from the `public.leaderboard` view (best non-rejected result per user) — there's no separate, editable "score" field anywhere.
- **YouTube proof**: `src/utils/youtube.js` validates `youtube.com/watch?v=...`, `youtu.be/...`, and `/shorts/...` links and extracts the video id, stored alongside the URL. A `check` constraint on `youtube_video_id` rejects malformed ids at the database level too.
- **Invites**: `/challenge/invite/[token]` reads an invite + the referenced result; accepting and completing go through the `accept_invite`/`complete_invite` RPCs (not raw UPDATEs), so an invite can't be hijacked into pointing at someone else's result.

## Commands

| Command           | Action                                       |
| :----------------- | :-------------------------------------------- |
| `npm install`       | Install dependencies                          |
| `npm run dev`       | Start the dev server at `localhost:4321`      |
| `npm run build`     | Build the site to `./dist/` (static + server) |
| `npm run preview`   | Preview the production build locally          |

## Notes for production

- `public/images/og-default.svg` is a placeholder social-share image — swap it for a rendered PNG/JPG before launch (most platforms don't render SVG for Open Graph previews).
- The Node adapter (`@astrojs/node`, standalone mode) is the most portable default when no host is specified. If deploying to Vercel/Netlify/Cloudflare, swap the `adapter` line in `astro.config.mjs` for that platform's adapter — nothing else needs to change.
- `src/data/challenges.js` is illustrative content for the homepage only (platform stats, the "train like an engineer" pipeline numbers, challenge-card previews) — it is not read by any page that shows real user data.
- Category (Men/Women/Open) defaults every signup to "open"; there's no profile-editing UI yet to change it, so the Men/Women leaderboard filters will be empty until that's built.
