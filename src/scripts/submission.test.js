import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./auth.js', () => ({
  getSession: vi.fn(),
  getPendingResult: vi.fn(() => null),
  clearPendingResult: vi.fn(),
  getPendingInvite: vi.fn(() => null),
  clearPendingInvite: vi.fn(),
}));
vi.mock('./invite.js', () => ({ completeInvite: vi.fn() }));
vi.mock('../db/supabase.js', () => ({ supabase: { from: vi.fn() } }));

import { getSession, getPendingResult, clearPendingResult, getPendingInvite, clearPendingInvite } from './auth.js';
import { completeInvite } from './invite.js';
import { supabase } from '../db/supabase.js';
import { initSubmission } from './submission.js';

const labels = { submitError: 'Could not submit' };

function setLocation({ search = '', pathname = '/en/submit' } = {}) {
  delete window.location;
  window.location = { search, pathname, href: '' };
}

function buildFixture() {
  document.body.innerHTML = `
    <div id="root" data-lang="en" data-labels='${JSON.stringify(labels)}' data-results-path="/en/results" data-login-path="/en/login">
      <div data-panel="sign-in-required" hidden><a data-sign-in-link href="#"></a></div>
      <div data-panel="form" hidden>
        <span data-computed-total>0</span>
        <input data-input="pullups" value="0" />
        <input data-input="dips" value="0" />
        <input data-input="youtube" />
        <p data-youtube-error hidden></p>
        <form data-submission-form>
          <button type="submit">Submit</button>
        </form>
        <p data-submit-error hidden></p>
      </div>
      <div data-panel="verifying" hidden></div>
    </div>`;
  return document.getElementById('root');
}

function resultsBuilder(result) {
  const builder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

function submit(root) {
  root.querySelector('[data-submission-form]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('initSubmission — prefill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPendingResult.mockReturnValue(null);
    getPendingInvite.mockReturnValue(null);
    getSession.mockResolvedValue(null);
  });

  it('prefills from the query string when present, and computes the total', () => {
    setLocation({ search: '?pullUps=40&dips=50' });
    const root = buildFixture();
    initSubmission(root);

    expect(root.querySelector('[data-input="pullups"]').value).toBe('40');
    expect(root.querySelector('[data-input="dips"]').value).toBe('50');
    expect(root.querySelector('[data-computed-total]').textContent).toBe('90');
  });

  it('falls back to a pending localStorage result when there is no query string', () => {
    setLocation();
    getPendingResult.mockReturnValue({ pullUps: 10, dips: 20 });
    const root = buildFixture();
    initSubmission(root);

    expect(root.querySelector('[data-input="pullups"]').value).toBe('10');
    expect(root.querySelector('[data-input="dips"]').value).toBe('20');
  });

  it('prefers the query string over a pending result when both are present', () => {
    setLocation({ search: '?pullUps=1&dips=2' });
    getPendingResult.mockReturnValue({ pullUps: 99, dips: 99 });
    const root = buildFixture();
    initSubmission(root);

    expect(root.querySelector('[data-input="pullups"]').value).toBe('1');
  });

  it('leaves the inputs at their defaults when there is nothing to prefill', () => {
    setLocation();
    const root = buildFixture();
    initSubmission(root);

    expect(root.querySelector('[data-input="pullups"]').value).toBe('0');
    expect(root.querySelector('[data-computed-total]').textContent).toBe('0');
  });

  it('recomputes the total as the inputs change', () => {
    setLocation();
    const root = buildFixture();
    initSubmission(root);

    root.querySelector('[data-input="pullups"]').value = '7';
    root.querySelector('[data-input="pullups"]').dispatchEvent(new Event('input', { bubbles: true }));
    expect(root.querySelector('[data-computed-total]').textContent).toBe('7');
  });
});

describe('initSubmission — auth gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPendingResult.mockReturnValue(null);
    getPendingInvite.mockReturnValue(null);
    setLocation();
  });

  it('shows the sign-in-required panel and builds the redirect link when signed out', async () => {
    getSession.mockResolvedValue(null);
    const root = buildFixture();
    initSubmission(root);
    await Promise.resolve();

    expect(root.querySelector('[data-panel="sign-in-required"]').hidden).toBe(false);
    expect(root.querySelector('[data-panel="form"]').hidden).toBe(true);
    expect(root.querySelector('[data-sign-in-link]').getAttribute('href')).toBe('/en/login?redirect=%2Fen%2Fsubmit');
    expect(clearPendingResult).not.toHaveBeenCalled();
  });

  it('shows the form and clears the pending result once a session confirms a pending attempt is being used', async () => {
    setLocation();
    getPendingResult.mockReturnValue({ pullUps: 10, dips: 20 });
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    const root = buildFixture();
    initSubmission(root);
    await Promise.resolve();

    expect(root.querySelector('[data-panel="form"]').hidden).toBe(false);
    expect(clearPendingResult).toHaveBeenCalled();
  });

  it('does not clear the pending result when the attempt came from the query string', async () => {
    setLocation({ search: '?pullUps=1&dips=2' });
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    const root = buildFixture();
    initSubmission(root);
    await Promise.resolve();

    expect(clearPendingResult).not.toHaveBeenCalled();
  });
});

describe('initSubmission — form submit', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getPendingResult.mockReturnValue(null);
    getPendingInvite.mockReturnValue(null);
    setLocation();
  });

  async function setupSignedIn() {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    const root = buildFixture();
    initSubmission(root);
    await Promise.resolve();
    return root;
  }

  it('rejects an invalid YouTube URL, focuses the field, and does not touch the database', async () => {
    const root = await setupSignedIn();
    root.querySelector('[data-input="youtube"]').value = 'not a youtube url';

    submit(root);
    await Promise.resolve();

    expect(root.querySelector('[data-youtube-error]').hidden).toBe(false);
    expect(document.activeElement).toBe(root.querySelector('[data-input="youtube"]'));
    expect(root.querySelector('[data-panel="form"]').hidden).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('inserts the result and redirects to the results page on success', async () => {
    const root = await setupSignedIn();
    const builder = resultsBuilder({ data: { id: 'result-1' }, error: null });
    supabase.from.mockReturnValue(builder);
    root.querySelector('[data-input="pullups"]').value = '40';
    root.querySelector('[data-input="dips"]').value = '50';
    root.querySelector('[data-input="youtube"]').value = 'https://youtu.be/dQw4w9WgXcQ';

    submit(root);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      pull_ups: 40,
      dips: 50,
      youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
      youtube_video_id: 'dQw4w9WgXcQ',
    });
    expect(window.location.href).toBe('/en/results/result-1');
  });

  it('completes and clears a pending invite after a successful submission', async () => {
    getPendingInvite.mockReturnValue('tok123');
    const root = await setupSignedIn();
    supabase.from.mockReturnValue(resultsBuilder({ data: { id: 'result-1' }, error: null }));
    root.querySelector('[data-input="youtube"]').value = 'https://youtu.be/dQw4w9WgXcQ';

    submit(root);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(completeInvite).toHaveBeenCalledWith('tok123');
    expect(clearPendingInvite).toHaveBeenCalled();
  });

  it('does not touch invite state when there is no pending invite', async () => {
    const root = await setupSignedIn();
    supabase.from.mockReturnValue(resultsBuilder({ data: { id: 'result-1' }, error: null }));
    root.querySelector('[data-input="youtube"]').value = 'https://youtu.be/dQw4w9WgXcQ';

    submit(root);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(completeInvite).not.toHaveBeenCalled();
  });

  it('shows a submit error and returns to the form panel when the insert fails', async () => {
    const root = await setupSignedIn();
    supabase.from.mockReturnValue(resultsBuilder({ data: null, error: { message: 'boom' } }));
    root.querySelector('[data-input="youtube"]').value = 'https://youtu.be/dQw4w9WgXcQ';

    submit(root);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-panel="form"]').hidden).toBe(false);
    expect(root.querySelector('[data-submit-error]').hidden).toBe(false);
    expect(root.querySelector('[data-submit-error]').textContent).toBe('Could not submit');
    expect(window.location.href).toBe('');
  });
});
