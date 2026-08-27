import { formatClock, formatNumber, formatPace } from '../utils/format.js';
import { getSession, savePendingResult, clearPendingResult, getPendingInvite } from './auth.js';
import { acceptInvite } from './invite.js';

const DURATION_SECONDS = 300;
const READY_SECONDS = 3;

/**
 * Wires up one #challenge-root element: the get-ready countdown, the
 * 5-minute timer, rep counters, undo stack, pace/projection, and the
 * idle → ready → running → review state machine. Pure DOM + setInterval,
 * no framework required.
 * @param {HTMLElement} root
 */
export function initChallenge(root) {
  const lang = root.dataset.lang;
  const submitPath = root.dataset.submitPath;

  const panels = {
    idle: root.querySelector('[data-panel="idle"]'),
    ready: root.querySelector('[data-panel="ready"]'),
    running: root.querySelector('[data-panel="running"]'),
    review: root.querySelector('[data-panel="review"]'),
  };

  const els = {
    readyCount: root.querySelector('[data-ready-count]'),
    timer: root.querySelectorAll('[data-timer]'),
    progress: root.querySelector('[data-progress]'),
    total: root.querySelectorAll('[data-total]'),
    pullUps: root.querySelectorAll('[data-pullups]'),
    dips: root.querySelectorAll('[data-dips]'),
    pace: root.querySelector('[data-pace]'),
    projected: root.querySelector('[data-projected]'),
    undoBtn: root.querySelector('[data-action="undo"]'),
    live: root.querySelector('[data-live-region]'),
  };

  let state = 'idle';
  let remaining = DURATION_SECONDS;
  let elapsed = 0;
  let pullUps = 0;
  let dips = 0;
  /** @type {Array<'pullup'|'dip'>} */
  const history = [];
  let timerId = null;

  function showPanel(name) {
    state = name;
    for (const [key, el] of Object.entries(panels)) {
      if (!el) continue;
      el.hidden = key !== name;
    }
  }

  function announce(message) {
    if (els.live) els.live.textContent = message;
  }

  function renderTimer() {
    const text = formatClock(remaining);
    els.timer.forEach((el) => { el.textContent = text; });
    if (els.progress) {
      els.progress.value = DURATION_SECONDS - remaining;
      els.progress.max = DURATION_SECONDS;
    }
  }

  function renderScore() {
    const total = pullUps + dips;
    els.total.forEach((el) => { el.textContent = formatNumber(lang, total); });
    els.pullUps.forEach((el) => { el.textContent = formatNumber(lang, pullUps); });
    els.dips.forEach((el) => { el.textContent = formatNumber(lang, dips); });
    if (els.undoBtn) els.undoBtn.disabled = history.length === 0;

    const minutesElapsed = elapsed / 60;
    const pace = minutesElapsed > 0 ? formatPace(lang, total, minutesElapsed) : formatPace(lang, 0, 1);
    if (els.pace) els.pace.textContent = pace;

    if (els.projected) {
      const projected = elapsed > 10 ? Math.round((total / elapsed) * DURATION_SECONDS) : total;
      els.projected.textContent = formatNumber(lang, projected);
    }
  }

  function addRep(type) {
    if (state !== 'running') return;
    if (type === 'pullup') pullUps += 1;
    else dips += 1;
    history.push(type);
    renderScore();
  }

  function undo() {
    if (state !== 'running' || history.length === 0) return;
    const last = history.pop();
    if (last === 'pullup') pullUps = Math.max(0, pullUps - 1);
    else dips = Math.max(0, dips - 1);
    renderScore();
  }

  function startReadyCountdown() {
    showPanel('ready');
    let count = READY_SECONDS;
    if (els.readyCount) els.readyCount.textContent = String(count);
    const readyTimer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        if (els.readyCount) els.readyCount.textContent = String(count);
      } else {
        clearInterval(readyTimer);
        startRunning();
      }
    }, 1000);
  }

  function startRunning() {
    remaining = DURATION_SECONDS;
    elapsed = 0;
    pullUps = 0;
    dips = 0;
    history.length = 0;
    renderTimer();
    renderScore();
    showPanel('running');
    announce('Timer started.');

    const start = performance.now();
    timerId = setInterval(() => {
      const elapsedMs = performance.now() - start;
      elapsed = Math.min(DURATION_SECONDS, elapsedMs / 1000);
      remaining = Math.max(0, DURATION_SECONDS - elapsed);
      renderTimer();
      renderScore();
      if (remaining <= 0) {
        finish();
      }
    }, 200);
  }

  function finish() {
    if (timerId) clearInterval(timerId);
    timerId = null;
    remaining = 0;
    renderTimer();
    showPanel('review');
    announce("Time's up.");

    root.querySelectorAll('[data-review-total]').forEach((el) => { el.textContent = formatNumber(lang, pullUps + dips); });
    root.querySelectorAll('[data-review-pullups]').forEach((el) => { el.textContent = formatNumber(lang, pullUps); });
    root.querySelectorAll('[data-review-dips]').forEach((el) => { el.textContent = formatNumber(lang, dips); });

    const submitLink = root.querySelector('[data-submit-link]');
    if (submitLink && submitPath) {
      const params = new URLSearchParams({ pullUps: String(pullUps), dips: String(dips) });
      submitLink.setAttribute('href', `${submitPath}?${params.toString()}`);
    }

    const authedCta = root.querySelector('[data-review-cta="authed"]');
    const guestCta = root.querySelector('[data-review-cta="guest"]');
    getSession().then((session) => {
      if (session) {
        if (authedCta) authedCta.hidden = false;
        if (guestCta) guestCta.hidden = true;
      } else {
        savePendingResult({ pullUps, dips });
        if (authedCta) authedCta.hidden = true;
        if (guestCta) guestCta.hidden = false;
      }
    });
  }

  function reset() {
    clearPendingResult();
    if (timerId) clearInterval(timerId);
    timerId = null;
    remaining = DURATION_SECONDS;
    elapsed = 0;
    pullUps = 0;
    dips = 0;
    history.length = 0;
    renderTimer();
    renderScore();
    showPanel('idle');
  }

  root.querySelectorAll('[data-action="start"]').forEach((btn) => btn.addEventListener('click', startReadyCountdown));
  root.querySelectorAll('[data-action="pullup"]').forEach((btn) => btn.addEventListener('click', () => addRep('pullup')));
  root.querySelectorAll('[data-action="dip"]').forEach((btn) => btn.addEventListener('click', () => addRep('dip')));
  if (els.undoBtn) els.undoBtn.addEventListener('click', undo);
  root.querySelectorAll('[data-action="finish"]').forEach((btn) => btn.addEventListener('click', finish));
  root.querySelectorAll('[data-action="reset"]').forEach((btn) => btn.addEventListener('click', reset));

  renderTimer();
  renderScore();

  // If this page load followed "accept challenge" -> register/login, redeem
  // the invite now that a session exists. Safe to call again even if the
  // invite landing page already redeemed it (accept_invite is idempotent).
  const pendingInviteToken = getPendingInvite();
  if (pendingInviteToken) {
    getSession().then((session) => {
      if (session) acceptInvite(pendingInviteToken);
    });
  }
}
