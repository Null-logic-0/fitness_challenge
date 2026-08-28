import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./auth.js', () => ({
  getSession: vi.fn(),
  savePendingResult: vi.fn(),
  clearPendingResult: vi.fn(),
  getPendingInvite: vi.fn(() => null),
}));
vi.mock('./invite.js', () => ({ acceptInvite: vi.fn() }));

import { getSession, savePendingResult, clearPendingResult, getPendingInvite } from './auth.js';
import { acceptInvite } from './invite.js';
import { initChallenge } from './challenge.js';

function buildFixture() {
  document.body.innerHTML = `
    <div id="challenge-root" data-lang="en" data-submit-path="/en/submit">
      <p data-live-region></p>
      <section data-panel="idle">
        <p data-timer>05:00</p>
        <button data-action="start">Start</button>
      </section>
      <section data-panel="ready" hidden>
        <p data-ready-count>3</p>
      </section>
      <section data-panel="running" hidden>
        <p data-timer>05:00</p>
        <progress data-progress></progress>
        <p data-total>0</p>
        <p data-pullups>0</p>
        <p data-dips>0</p>
        <span data-pace>0.0</span>
        <span data-projected>0</span>
        <button data-action="pullup">+ Pull-up</button>
        <button data-action="dip">+ Dip</button>
        <button data-action="undo">Undo</button>
        <button data-action="finish">Finish</button>
      </section>
      <section data-panel="review" hidden>
        <p data-review-total>0</p>
        <p data-review-pullups>0</p>
        <p data-review-dips>0</p>
        <a data-submit-link href="/en/submit">Submit</a>
        <div data-review-cta="authed" hidden>
          <button data-action="reset">Try again</button>
        </div>
        <div data-review-cta="guest" hidden>
          <button data-action="reset">Try again</button>
        </div>
      </section>
    </div>`;
  return document.getElementById('challenge-root');
}

describe('initChallenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date', 'performance'] });
    getSession.mockResolvedValue(null);
    getPendingInvite.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts on the idle panel showing 05:00', () => {
    const root = buildFixture();
    initChallenge(root);
    expect(root.querySelector('[data-panel="idle"]').hidden).toBe(false);
    expect(root.querySelector('[data-panel="running"]').hidden).toBe(true);
    expect(root.querySelector('[data-panel="idle"] [data-timer]').textContent).toBe('05:00');
  });

  it('clicking start shows the get-ready countdown, then the running panel after 3 seconds', async () => {
    const root = buildFixture();
    initChallenge(root);

    root.querySelector('[data-action="start"]').click();
    expect(root.querySelector('[data-panel="ready"]').hidden).toBe(false);
    expect(root.querySelector('[data-ready-count]').textContent).toBe('3');

    await vi.advanceTimersByTimeAsync(1000);
    expect(root.querySelector('[data-ready-count]').textContent).toBe('2');

    await vi.advanceTimersByTimeAsync(1000);
    expect(root.querySelector('[data-ready-count]').textContent).toBe('1');

    await vi.advanceTimersByTimeAsync(1000);
    expect(root.querySelector('[data-panel="ready"]').hidden).toBe(true);
    expect(root.querySelector('[data-panel="running"]').hidden).toBe(false);
    expect(root.querySelector('[data-panel="running"] [data-timer]').textContent).toBe('05:00');
  });

  async function startAndRun(root) {
    root.querySelector('[data-action="start"]').click();
    await vi.advanceTimersByTimeAsync(3000);
  }

  it('adds pull-ups and dips only while running, and updates the total', async () => {
    const root = buildFixture();
    initChallenge(root);

    // clicking before the timer is running should have no effect
    root.querySelector('[data-action="pullup"]').click();
    expect(root.querySelector('[data-pullups]').textContent).toBe('0');

    await startAndRun(root);

    root.querySelector('[data-action="pullup"]').click();
    root.querySelector('[data-action="pullup"]').click();
    root.querySelector('[data-action="dip"]').click();

    expect(root.querySelector('[data-pullups]').textContent).toBe('2');
    expect(root.querySelector('[data-dips]').textContent).toBe('1');
    expect(root.querySelector('[data-total]').textContent).toBe('3');
  });

  it('disables undo with no history, enables it after a rep, and undo removes the last rep specifically', async () => {
    const root = buildFixture();
    initChallenge(root);
    await startAndRun(root);

    const undoBtn = root.querySelector('[data-action="undo"]');
    expect(undoBtn.disabled).toBe(true);

    root.querySelector('[data-action="pullup"]').click();
    root.querySelector('[data-action="dip"]').click();
    expect(undoBtn.disabled).toBe(false);

    undoBtn.click(); // undoes the dip (last action)
    expect(root.querySelector('[data-pullups]').textContent).toBe('1');
    expect(root.querySelector('[data-dips]').textContent).toBe('0');

    undoBtn.click(); // undoes the pull-up
    expect(root.querySelector('[data-pullups]').textContent).toBe('0');
    expect(undoBtn.disabled).toBe(true);

    undoBtn.click(); // no-op, nothing left to undo
    expect(root.querySelector('[data-pullups]').textContent).toBe('0');
  });

  it('projects a full-attempt total once more than 10 seconds have elapsed', async () => {
    const root = buildFixture();
    initChallenge(root);
    await startAndRun(root);

    root.querySelector('[data-action="pullup"]').click();
    // Before 10s elapsed, projected just mirrors the current total.
    expect(root.querySelector('[data-projected]').textContent).toBe('1');

    await vi.advanceTimersByTimeAsync(15000); // now ~15s elapsed, still 1 rep
    // projected = round((1 / 15) * 300) = 20
    expect(root.querySelector('[data-projected]').textContent).toBe('20');
  });

  it('automatically finishes and shows the review panel once the timer runs out', async () => {
    const root = buildFixture();
    initChallenge(root);
    await startAndRun(root);

    root.querySelector('[data-action="pullup"]').click();
    root.querySelector('[data-action="dip"]').click();

    await vi.advanceTimersByTimeAsync(300_000);

    expect(root.querySelector('[data-panel="review"]').hidden).toBe(false);
    expect(root.querySelector('[data-panel="running"]').hidden).toBe(true);
    expect(root.querySelector('[data-review-total]').textContent).toBe('2');
    expect(root.querySelector('[data-review-pullups]').textContent).toBe('1');
    expect(root.querySelector('[data-review-dips]').textContent).toBe('1');
  });

  it('sets the submit link href with the final pull-up/dip counts as query params', async () => {
    const root = buildFixture();
    initChallenge(root);
    await startAndRun(root);
    root.querySelector('[data-action="pullup"]').click();
    root.querySelector('[data-action="pullup"]').click();
    root.querySelector('[data-action="dip"]').click();

    root.querySelector('[data-action="finish"]').click();

    const href = root.querySelector('[data-submit-link]').getAttribute('href');
    expect(href).toBe('/en/submit?pullUps=2&dips=1');
  });

  it('shows the authed CTA and does not save a pending result when a session exists', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    const root = buildFixture();
    initChallenge(root);
    await startAndRun(root);

    root.querySelector('[data-action="finish"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-review-cta="authed"]').hidden).toBe(false);
    expect(root.querySelector('[data-review-cta="guest"]').hidden).toBe(true);
    expect(savePendingResult).not.toHaveBeenCalled();
  });

  it('shows the guest CTA and saves a pending result when signed out', async () => {
    getSession.mockResolvedValue(null);
    const root = buildFixture();
    initChallenge(root);
    await startAndRun(root);
    root.querySelector('[data-action="pullup"]').click();

    root.querySelector('[data-action="finish"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-review-cta="guest"]').hidden).toBe(false);
    expect(root.querySelector('[data-review-cta="authed"]').hidden).toBe(true);
    expect(savePendingResult).toHaveBeenCalledWith({ pullUps: 1, dips: 0 });
  });

  it('reset clears the pending result and returns to idle with counts zeroed', async () => {
    const root = buildFixture();
    initChallenge(root);
    await startAndRun(root);
    root.querySelector('[data-action="pullup"]').click();
    root.querySelector('[data-action="finish"]').click();
    await Promise.resolve();
    await Promise.resolve();

    root.querySelector('[data-panel="review"] [data-action="reset"]').click();

    expect(clearPendingResult).toHaveBeenCalled();
    expect(root.querySelector('[data-panel="idle"]').hidden).toBe(false);
    expect(root.querySelector('[data-panel="idle"] [data-timer]').textContent).toBe('05:00');
  });

  it('redeems a pending invite on load once a session exists', async () => {
    getPendingInvite.mockReturnValue('invite-token-123');
    getSession.mockResolvedValue({ user: { id: 'u1' } });

    initChallenge(buildFixture());
    await Promise.resolve();
    await Promise.resolve();

    expect(acceptInvite).toHaveBeenCalledWith('invite-token-123');
  });

  it('does not attempt to redeem an invite when signed out', async () => {
    getPendingInvite.mockReturnValue('invite-token-123');
    getSession.mockResolvedValue(null);

    initChallenge(buildFixture());
    await Promise.resolve();
    await Promise.resolve();

    expect(acceptInvite).not.toHaveBeenCalled();
  });

  it('does not call getSession for an invite when there is no pending token', async () => {
    getPendingInvite.mockReturnValue(null);
    initChallenge(buildFixture());
    await Promise.resolve();
    expect(acceptInvite).not.toHaveBeenCalled();
  });
});
