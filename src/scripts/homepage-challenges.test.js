import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/supabase.js', () => ({ supabase: { from: vi.fn() } }));

import { supabase } from '../db/supabase.js';
import { loadRecentChallenges } from './homepage-challenges.js';

function mockInviteBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

function buildFixture() {
  document.body.innerHTML = `
    <div id="root" data-lang="en" data-invite-title-template="{name} scored {score}"
         data-can-you-beat="Can you beat it?" data-accept-label="Accept" data-invite-base-path="/en/invite">
      <template data-challenge-template>
        <div>
          <p data-challenge-title></p>
          <p data-challenge-sub></p>
          <a data-challenge-cta href="#"></a>
        </div>
      </template>
      <div data-challenge-list>
        <p data-fallback>Be the first!</p>
      </div>
    </div>`;
  return document.getElementById('root');
}

describe('loadRecentChallenges', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leaves the static fallback in place when there is no data', async () => {
    supabase.from.mockReturnValue(mockInviteBuilder({ data: [] }));
    const root = buildFixture();
    await loadRecentChallenges(root);
    expect(root.querySelector('[data-fallback]')).not.toBeNull();
  });

  it('leaves the fallback in place when data is null', async () => {
    supabase.from.mockReturnValue(mockInviteBuilder({ data: null }));
    const root = buildFixture();
    await loadRecentChallenges(root);
    expect(root.querySelector('[data-fallback]')).not.toBeNull();
  });

  it('renders a card per invite with the title/score substituted and the correct href', async () => {
    supabase.from.mockReturnValue(mockInviteBuilder({
      data: [
        { token: 'tok1', results: { total: 92 }, profiles: { display_name: 'Ana' } },
        { token: 'tok2', results: { total: 51 }, profiles: { display_name: 'Bo' } },
      ],
    }));
    const root = buildFixture();
    await loadRecentChallenges(root);

    expect(root.querySelector('[data-fallback]')).toBeNull();
    const cards = root.querySelectorAll('[data-challenge-list] > *');
    expect(cards).toHaveLength(2);

    const first = cards[0];
    expect(first.querySelector('[data-challenge-title]').textContent).toBe(
      `Ana scored ${new Intl.NumberFormat('en-US').format(92)}`,
    );
    expect(first.querySelector('[data-challenge-sub]').textContent).toBe('Can you beat it?');
    expect(first.querySelector('[data-challenge-cta]').textContent).toBe('Accept');
    expect(first.querySelector('[data-challenge-cta]').getAttribute('href')).toBe('/en/invite/tok1');
  });

  it('defaults a missing inviter name to empty string and a missing total to 0', async () => {
    supabase.from.mockReturnValue(mockInviteBuilder({
      data: [{ token: 'tok1', results: null, profiles: null }],
    }));
    const root = buildFixture();
    await loadRecentChallenges(root);

    const card = root.querySelector('[data-challenge-list] > *');
    expect(card.querySelector('[data-challenge-title]').textContent).toBe(
      ` scored ${new Intl.NumberFormat('en-US').format(0)}`,
    );
  });
});
