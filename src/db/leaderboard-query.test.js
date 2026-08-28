import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase.js', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from './supabase.js';
import { fetchLeaderboardPage, PAGE_SIZE } from './leaderboard-query.js';

/** A minimal thenable query-builder stand-in for supabase-js's chainable API. */
function mockBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    then: (resolve) => resolve(result),
  };
  return builder;
}

describe('fetchLeaderboardPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries the leaderboard view and ranges by offset/pageSize', async () => {
    const builder = mockBuilder({ data: [{ user_id: '1' }], error: null });
    supabase.from.mockReturnValue(builder);

    await fetchLeaderboardPage({ offset: 25, pageSize: 25 });

    expect(supabase.from).toHaveBeenCalledWith('leaderboard');
    expect(builder.range).toHaveBeenCalledWith(25, 49);
  });

  it('defaults to offset 0 and the exported PAGE_SIZE', async () => {
    const builder = mockBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await fetchLeaderboardPage();

    expect(builder.range).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
  });

  it('does not filter by category, country, or time for the default (global/all/open) request', async () => {
    const builder = mockBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await fetchLeaderboardPage();

    expect(builder.eq).not.toHaveBeenCalled();
    expect(builder.gte).not.toHaveBeenCalled();
  });

  it('filters by category when not "open"', async () => {
    const builder = mockBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await fetchLeaderboardPage({ category: 'men' });

    expect(builder.eq).toHaveBeenCalledWith('category', 'men');
  });

  it('filters by the viewer\'s country when scope is "country"', async () => {
    const builder = mockBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await fetchLeaderboardPage({ scope: 'country', viewerCountry: 'GE' });

    expect(builder.eq).toHaveBeenCalledWith('country', 'GE');
  });

  it('filters to a sentinel that matches nothing when scope is "country" but the viewer has none', async () => {
    const builder = mockBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await fetchLeaderboardPage({ scope: 'country', viewerCountry: null });

    expect(builder.eq).toHaveBeenCalledWith('country', '__none__');
  });

  it('applies a 7-day cutoff for time: "week"', async () => {
    const builder = mockBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);
    const before = Date.now();

    await fetchLeaderboardPage({ time: 'week' });

    expect(builder.gte).toHaveBeenCalledTimes(1);
    const [field, isoDate] = builder.gte.mock.calls[0];
    expect(field).toBe('submitted_at');
    const ageMs = before - new Date(isoDate).getTime();
    expect(ageMs).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
    expect(ageMs).toBeLessThan(7 * 24 * 60 * 60 * 1000 + 5000);
  });

  it('applies a 30-day cutoff for time: "month"', async () => {
    const builder = mockBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);
    const before = Date.now();

    await fetchLeaderboardPage({ time: 'month' });

    const [, isoDate] = builder.gte.mock.calls[0];
    const ageMs = before - new Date(isoDate).getTime();
    expect(ageMs).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000 - 1000);
    expect(ageMs).toBeLessThan(30 * 24 * 60 * 60 * 1000 + 5000);
  });

  it('reports hasMore: true when a full page came back', async () => {
    const fullPage = Array.from({ length: 5 }, (_, i) => ({ user_id: String(i) }));
    supabase.from.mockReturnValue(mockBuilder({ data: fullPage, error: null }));

    const { hasMore, rows } = await fetchLeaderboardPage({ pageSize: 5 });
    expect(hasMore).toBe(true);
    expect(rows).toHaveLength(5);
  });

  it('reports hasMore: false when fewer rows than pageSize came back', async () => {
    supabase.from.mockReturnValue(mockBuilder({ data: [{ user_id: '1' }], error: null }));

    const { hasMore } = await fetchLeaderboardPage({ pageSize: 25 });
    expect(hasMore).toBe(false);
  });

  it('returns an empty rows array (not null) when data is null', async () => {
    supabase.from.mockReturnValue(mockBuilder({ data: null, error: null }));

    const { rows, hasMore } = await fetchLeaderboardPage();
    expect(rows).toEqual([]);
    expect(hasMore).toBe(false);
  });

  it('passes a query error straight through without throwing', async () => {
    const fakeError = { message: 'relation does not exist' };
    supabase.from.mockReturnValue(mockBuilder({ data: null, error: fakeError }));

    const { error, rows } = await fetchLeaderboardPage();
    expect(error).toBe(fakeError);
    expect(rows).toEqual([]);
  });
});
