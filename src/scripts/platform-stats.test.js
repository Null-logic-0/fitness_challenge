import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/supabase.js', () => ({ supabase: { from: vi.fn() } }));

import { supabase } from '../db/supabase.js';
import { initPlatformStats } from './platform-stats.js';

function mockStatsBuilder(result) {
  return {
    select: vi.fn(function () { return this; }),
    single: vi.fn(() => Promise.resolve(result)),
  };
}

function buildFixture() {
  document.body.innerHTML = `
    <div id="root" data-lang="en">
      <span data-stat="athletes">—</span>
      <span data-stat="attempts">—</span>
      <span data-stat="currentRecord">—</span>
      <span data-stat="averageScore">—</span>
      <span data-stat="averageBaseline">—</span>
    </div>`;
  return document.getElementById('root');
}

describe('initPlatformStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leaves tiles at their placeholder when the query returns no data', async () => {
    supabase.from.mockReturnValue(mockStatsBuilder({ data: null }));
    const root = buildFixture();
    await initPlatformStats(root);
    expect(root.querySelector('[data-stat="athletes"]').textContent).toBe('—');
  });

  it('fills in each tile from the matching platform_stats column, locale-formatted', async () => {
    supabase.from.mockReturnValue(mockStatsBuilder({
      data: {
        athletes: 1234,
        attempts: 5678,
        current_record: 142,
        average_score: 90,
        average_baseline: 60,
      },
    }));
    const root = buildFixture();
    await initPlatformStats(root);

    expect(supabase.from).toHaveBeenCalledWith('platform_stats');
    expect(root.querySelector('[data-stat="athletes"]').textContent).toBe(new Intl.NumberFormat('en-US').format(1234));
    expect(root.querySelector('[data-stat="attempts"]').textContent).toBe(new Intl.NumberFormat('en-US').format(5678));
    expect(root.querySelector('[data-stat="currentRecord"]').textContent).toBe(new Intl.NumberFormat('en-US').format(142));
    expect(root.querySelector('[data-stat="averageScore"]').textContent).toBe(new Intl.NumberFormat('en-US').format(90));
    expect(root.querySelector('[data-stat="averageBaseline"]').textContent).toBe(new Intl.NumberFormat('en-US').format(60));
  });

  it('leaves a tile at its placeholder when its specific value is null', async () => {
    supabase.from.mockReturnValue(mockStatsBuilder({
      data: { athletes: 10, attempts: null, current_record: null, average_score: null, average_baseline: null },
    }));
    const root = buildFixture();
    await initPlatformStats(root);

    expect(root.querySelector('[data-stat="athletes"]').textContent).toBe(new Intl.NumberFormat('en-US').format(10));
    expect(root.querySelector('[data-stat="attempts"]').textContent).toBe('—');
  });

  it('does not throw when a tile element is missing from the DOM', async () => {
    supabase.from.mockReturnValue(mockStatsBuilder({ data: { athletes: 10 } }));
    document.body.innerHTML = `<div id="root" data-lang="en"></div>`;
    await expect(initPlatformStats(document.getElementById('root'))).resolves.not.toThrow();
  });
});
