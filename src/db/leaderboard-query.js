import { supabase } from './supabase.js';

export const PAGE_SIZE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One shared query builder for the leaderboard view, used both by the
 * server-rendered first page (Leaderboard.astro) and by the client-side
 * infinite-scroll/filter-change fetches (src/scripts/leaderboard.js) — so
 * "page 1 with these filters" always means exactly the same thing in both
 * places.
 * @param {{scope?: 'global'|'country', time?: 'all'|'week'|'month', category?: 'open'|'men'|'women', viewerCountry?: string|null, offset?: number, pageSize?: number}} params
 */
export async function fetchLeaderboardPage({
  scope = 'global',
  time = 'all',
  category = 'open',
  viewerCountry = null,
  offset = 0,
  pageSize = PAGE_SIZE,
} = {}) {
  let query = supabase
    .from('leaderboard')
    .select('user_id, username, display_name, country, category, result_id, pull_ups, dips, total, status, submitted_at')
    .order('total', { ascending: false })
    .order('submitted_at', { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (category !== 'open') {
    query = query.eq('category', category);
  }
  if (scope === 'country') {
    query = query.eq('country', viewerCountry ?? '__none__');
  }
  if (time !== 'all') {
    const days = time === 'week' ? 7 : 30;
    query = query.gte('submitted_at', new Date(Date.now() - days * DAY_MS).toISOString());
  }

  const { data, error } = await query;
  return { rows: data ?? [], error, hasMore: (data?.length ?? 0) === pageSize };
}
