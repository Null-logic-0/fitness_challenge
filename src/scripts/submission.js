import { extractYouTubeId } from '../utils/youtube.js';
import { getSession, getPendingResult, clearPendingResult, getPendingInvite, clearPendingInvite } from './auth.js';
import { completeInvite } from './invite.js';
import { supabase } from '../db/supabase.js';

/**
 * Wires up the #submission-root element on /submit: resolves the just-completed
 * attempt (query string for an already-authenticated user, or the localStorage
 * "pending result" left behind when an unauthenticated visitor just registered
 * or logged in), gates the whole form behind an auth check, validates the
 * YouTube link, and inserts the result into Supabase. The server — not this
 * script — is what actually enforces the total and the row's immutability
 * (generated column + RLS, see supabase/migrations/0001_init.sql); this only
 * gives the user a fast, friendly error before that round-trip.
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

  root.querySelectorAll('[data-attempt-pullups]').forEach((el) => { el.textContent = String(attempt?.pullUps ?? 0); });
  root.querySelectorAll('[data-attempt-dips]').forEach((el) => { el.textContent = String(attempt?.dips ?? 0); });
  root.querySelectorAll('[data-attempt-total]').forEach((el) => {
    el.textContent = String((attempt?.pullUps ?? 0) + (attempt?.dips ?? 0));
  });

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
    if (!attempt) {
      // Signed in but nothing to submit (e.g. a stale bookmark) — send them
      // back to start a real attempt rather than showing an empty form.
      window.location.replace(root.dataset.challengePath || `/${lang}/challenge`);
      return;
    }
    // Now that we're committed to using it, consume the one-time pending
    // result so a later visit to /submit doesn't resurrect a stale attempt.
    if (attempt.source === 'pending') clearPendingResult();
    showPanel('form');

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
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
          pull_ups: attempt.pullUps,
          dips: attempt.dips,
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
