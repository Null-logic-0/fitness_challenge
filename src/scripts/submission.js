import { extractYouTubeId } from '../utils/youtube.js';
import { getSession, getPendingResult, clearPendingResult, getPendingInvite, clearPendingInvite } from './auth.js';
import { completeInvite } from './invite.js';
import { supabase } from '../db/supabase.js';

/**
 * Wires up the #submission-root element on /submit. Two ways to arrive
 * with numbers already filled in — a query string (already-authenticated
 * user finishing the site's timer) or the localStorage "pending result"
 * left behind when an unauthenticated visitor just registered or logged in
 * — but the pull-ups/dips fields are always editable, not read-only:
 * someone who already recorded a full attempt on their own (own stopwatch,
 * no site timer at all) needs to be able to just type their count and drop
 * in the video link. The server — not this script — is what actually
 * enforces the total and the row's immutability (generated column + RLS,
 * see supabase/migrations/0001_init.sql); this only gives the user a fast,
 * friendly error before that round-trip.
 * @param {HTMLElement} root
 */
export function initSubmission(root) {
  const lang = root.dataset.lang;
  const labels = JSON.parse(root.dataset.labels);
  const resultsBasePath = root.dataset.resultsPath;
  const loginPath = root.dataset.loginPath;

  const panels = {
    signInRequired: root.querySelector('[data-panel="sign-in-required"]'),
    form: root.querySelector('[data-panel="form"]'),
    verifying: root.querySelector('[data-panel="verifying"]'),
  };

  function showPanel(name) {
    for (const [key, el] of Object.entries(panels)) {
      if (el) el.hidden = key !== name;
    }
  }

  // Non-destructive: a visitor who isn't signed in yet must still find their
  // pending result intact after they come back from register/login, so
  // nothing here is cleared from localStorage until a session confirms
  // it's actually about to be used (see the getSession().then below).
  function peekAttempt() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('pullUps') || params.has('dips')) {
      return {
        pullUps: Math.max(0, Number(params.get('pullUps') || 0)),
        dips: Math.max(0, Number(params.get('dips') || 0)),
        source: 'query',
      };
    }
    const pending = getPendingResult();
    if (pending) {
      return { pullUps: Math.max(0, Number(pending.pullUps || 0)), dips: Math.max(0, Number(pending.dips || 0)), source: 'pending' };
    }
    return null;
  }

  const attempt = peekAttempt();

  const pullUpsInput = root.querySelector('[data-input="pullups"]');
  const dipsInput = root.querySelector('[data-input="dips"]');
  const totalDisplay = root.querySelector('[data-computed-total]');

  if (attempt) {
    pullUpsInput.value = String(attempt.pullUps);
    dipsInput.value = String(attempt.dips);
  }

  function refreshTotal() {
    const total = Math.max(0, Number(pullUpsInput.value) || 0) + Math.max(0, Number(dipsInput.value) || 0);
    if (totalDisplay) totalDisplay.textContent = String(total);
  }
  refreshTotal();
  [pullUpsInput, dipsInput].forEach((input) => input.addEventListener('input', refreshTotal));

  const youtubeInput = root.querySelector('[data-input="youtube"]');
  const youtubeError = root.querySelector('[data-youtube-error]');
  const form = root.querySelector('[data-submission-form]');
  const submitError = root.querySelector('[data-submit-error]');
  const signInLink = root.querySelector('[data-sign-in-link]');

  if (signInLink && loginPath) {
    signInLink.setAttribute('href', `${loginPath}?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }

  getSession().then((session) => {
    if (!session) {
      showPanel('signInRequired');
      return;
    }
    // Now that we're committed to using it, consume the one-time pending
    // result so a later visit to /submit doesn't resurrect a stale attempt.
    if (attempt?.source === 'pending') clearPendingResult();
    showPanel('form');

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const pullUps = Math.max(0, Number(pullUpsInput.value) || 0);
      const dips = Math.max(0, Number(dipsInput.value) || 0);
      const url = youtubeInput.value.trim();
      const videoId = extractYouTubeId(url);

      if (!videoId) {
        if (youtubeError) youtubeError.hidden = false;
        youtubeInput.focus();
        return;
      }
      if (youtubeError) youtubeError.hidden = true;
      if (submitError) submitError.hidden = true;

      showPanel('verifying');

      const { data, error } = await supabase
        .from('results')
        .insert({
          user_id: session.user.id,
          pull_ups: pullUps,
          dips,
          youtube_url: url,
          youtube_video_id: videoId,
        })
        .select('id')
        .single();

      if (error || !data) {
        showPanel('form');
        if (submitError) {
          submitError.textContent = labels.submitError;
          submitError.hidden = false;
        }
        return;
      }

      const inviteToken = getPendingInvite();
      if (inviteToken) {
        await completeInvite(inviteToken);
        clearPendingInvite();
      }

      window.location.href = `${resultsBasePath}/${data.id}`;
    });
  });
}
