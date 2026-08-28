import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./auth.js', () => ({ getSession: vi.fn() }));
vi.mock('../db/supabase.js', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../db/leaderboard-query.js', () => ({ fetchLeaderboardPage: vi.fn(), PAGE_SIZE: 25 }));

import { getSession } from './auth.js';
import { supabase } from '../db/supabase.js';
import { fetchLeaderboardPage } from '../db/leaderboard-query.js';
import { initials, initLeaderboard } from './leaderboard.js';

describe('initials', () => {
  it('takes the first letter of each of the first two words, uppercased', () => {
    expect(initials('luka tchelidze')).toBe('LT');
  });

  it('handles a single-word name', () => {
    expect(initials('Madonna')).toBe('M');
  });

  it('ignores words beyond the first two', () => {
    expect(initials('a b c d')).toBe('AB');
  });

  it('falls back to "?" for null/undefined', () => {
    expect(initials(null)).toBe('?');
    expect(initials(undefined)).toBe('?');
  });
});

function athlete(overrides = {}) {
  return {
    user_id: 'u1',
    username: 'lukat',
    display_name: 'Luka T',
    country: 'GE',
    pull_ups: 40,
    dips: 50,
    total: 90,
    ...overrides,
  };
}

function buildFixture({ nextOffset = 0, hasMore = false } = {}) {
  document.body.innerHTML = `
    <div id="leaderboard-root" data-lang="en" data-next-offset="${nextOffset}" data-has-more="${hasMore}" data-you-label="You">
      <div data-state="content"></div>
      <div data-state="empty" hidden></div>
      <div data-state="error" hidden></div>
      <table><tbody data-rows></tbody></table>
      <a data-podium-slot="1"><span data-slot-initials></span><span data-slot-name></span><span data-slot-country></span><span data-slot-total></span></a>
      <a data-podium-slot="2"><span data-slot-initials></span><span data-slot-name></span><span data-slot-country></span><span data-slot-total></span></a>
      <a data-podium-slot="3"><span data-slot-initials></span><span data-slot-name></span><span data-slot-country></span><span data-slot-total></span></a>
      <div data-sentinel></div>
      <div data-loading-more hidden></div>
      <div data-filter-group="scope">
        <button data-filter-value="global" class="tab-active" aria-pressed="true">Global</button>
        <button data-filter-value="country" aria-pressed="false">Country</button>
      </div>
      <div data-filter-group="category">
        <button data-filter-value="open" class="tab-active" aria-pressed="true">Open</button>
        <button data-filter-value="men" aria-pressed="false">Men</button>
      </div>
      <button data-action="retry">Retry</button>
    </div>`;
  return document.getElementById('leaderboard-root');
}

describe('initLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    IntersectionObserver.instances.length = 0;
    getSession.mockResolvedValue(null);
  });

  it('does not fetch anything on init (the first page is already server-rendered)', () => {
    initLeaderboard(buildFixture());
    expect(fetchLeaderboardPage).not.toHaveBeenCalled();
  });

  it('clicking a filter re-fetches with the new value and toggles tab-active/aria-pressed', async () => {
    fetchLeaderboardPage.mockResolvedValue({ rows: [athlete()], error: null, hasMore: false });
    const root = buildFixture();
    initLeaderboard(root);

    const countryBtn = root.querySelector('[data-filter-group="scope"] [data-filter-value="country"]');
    const globalBtn = root.querySelector('[data-filter-group="scope"] [data-filter-value="global"]');
    countryBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchLeaderboardPage).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'country', offset: 0 }),
    );
    expect(countryBtn.classList.contains('tab-active')).toBe(true);
    expect(countryBtn.getAttribute('aria-pressed')).toBe('true');
    expect(globalBtn.classList.contains('tab-active')).toBe(false);
    expect(globalBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders rows and the podium, and shows the content state, when rows come back', async () => {
    const a1 = athlete({ user_id: 'u1', display_name: 'Ana One', total: 100 });
    const a2 = athlete({ user_id: 'u2', display_name: 'Bo Two', total: 90 });
    fetchLeaderboardPage.mockResolvedValue({ rows: [a1, a2], error: null, hasMore: false });
    const root = buildFixture();
    initLeaderboard(root);

    root.querySelector('[data-action="retry"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-state="content"]').hidden).toBe(false);
    expect(root.querySelector('[data-state="empty"]').hidden).toBe(true);
    expect(root.querySelector('[data-state="error"]').hidden).toBe(true);

    const rows = root.querySelectorAll('[data-rows] tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].dataset.userId).toBe('u1');
    expect(rows[0].querySelector('td').textContent).toBe('1');
    expect(rows[0].textContent).toContain('Ana One');
    expect(rows[0].textContent).toContain(new Intl.NumberFormat('en-US').format(100));

    const slot1 = root.querySelector('[data-podium-slot="1"]');
    expect(slot1.style.visibility).toBe('visible');
    expect(slot1.querySelector('[data-slot-name]').textContent).toBe('Ana One');
    const slot3 = root.querySelector('[data-podium-slot="3"]');
    expect(slot3.style.visibility).toBe('hidden');
  });

  it('shows the empty state and hides the podium when no rows come back', async () => {
    fetchLeaderboardPage.mockResolvedValue({ rows: [], error: null, hasMore: false });
    const root = buildFixture();
    initLeaderboard(root);

    root.querySelector('[data-action="retry"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-state="empty"]').hidden).toBe(false);
    expect(root.querySelector('[data-state="content"]').hidden).toBe(true);
    expect(root.querySelector('[data-podium-slot="1"]').style.visibility).toBe('hidden');
  });

  it('shows the error state when the query fails', async () => {
    fetchLeaderboardPage.mockResolvedValue({ rows: [], error: { message: 'boom' }, hasMore: false });
    const root = buildFixture();
    initLeaderboard(root);

    root.querySelector('[data-action="retry"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-state="error"]').hidden).toBe(false);
  });

  it('loads the next page when the sentinel intersects, appending rows with continued rank numbering', async () => {
    fetchLeaderboardPage.mockResolvedValue({ rows: [athlete({ user_id: 'u9' })], error: null, hasMore: true });
    const root = buildFixture({ nextOffset: 5, hasMore: true });
    initLeaderboard(root);

    const observer = IntersectionObserver.instances.at(-1);
    observer.callback([{ isIntersecting: true }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchLeaderboardPage).toHaveBeenCalledWith(expect.objectContaining({ offset: 5 }));
    const rows = root.querySelectorAll('[data-rows] tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('td').textContent).toBe('6');
  });

  it('does not load the next page when hasMore is false', () => {
    const root = buildFixture({ nextOffset: 5, hasMore: false });
    initLeaderboard(root);

    const observer = IntersectionObserver.instances.at(-1);
    observer.callback([{ isIntersecting: true }]);

    expect(fetchLeaderboardPage).not.toHaveBeenCalled();
  });

  it('highlights the viewer\'s own existing row once the session resolves', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    const profileBuilder = {
      select: vi.fn(function select() { return this; }),
      eq: vi.fn(function eq() { return this; }),
      single: vi.fn(() => Promise.resolve({ data: { country: 'GE' } })),
    };
    supabase.from.mockReturnValue(profileBuilder);

    const root = buildFixture();
    root.querySelector('[data-rows]').innerHTML =
      '<tr data-row data-user-id="u1"><td><span data-you-badge hidden></span></td></tr>';

    initLeaderboard(root);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const row = root.querySelector('[data-row]');
    expect(row.classList.contains('bg-primary/10')).toBe(true);
    expect(row.querySelector('[data-you-badge]').hidden).toBe(false);
  });

  it('does not highlight anything when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const root = buildFixture();
    root.querySelector('[data-rows]').innerHTML =
      '<tr data-row data-user-id="u1"><td><span data-you-badge hidden></span></td></tr>';

    initLeaderboard(root);
    await Promise.resolve();
    await Promise.resolve();

    expect(supabase.from).not.toHaveBeenCalled();
    const row = root.querySelector('[data-row]');
    expect(row.classList.contains('bg-primary/10')).toBe(false);
  });
});
