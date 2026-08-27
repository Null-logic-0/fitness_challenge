import { getSession } from './auth.js';
import { supabase } from '../db/supabase.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Progressive-enhancement filtering for the leaderboard table. The table is
 * fully server-rendered (global / all-time / open, sorted by real Supabase
 * data) so it works with no JS at all; this only hides non-matching rows,
 * renumbers ranks, refreshes the podium, and — once the viewer's session
 * resolves — highlights their own row and enables the "Country" scope.
 * @param {HTMLElement} root
 */
export function initLeaderboard(root) {
  const rows = Array.from(root.querySelectorAll('[data-row]'));
  const noResultsRow = root.querySelector('[data-no-results]');
  const podiumSlots = Array.from(root.querySelectorAll('[data-podium-slot]'));

  const state = { scope: 'global', time: 'all', category: 'open', viewerCountry: null };

  function matches(row) {
    const scopeOk = state.scope === 'global' || (state.scope === 'country' && row.dataset.country === state.viewerCountry);

    const submittedAt = new Date(row.dataset.submittedAt).getTime();
    const ageMs = Date.now() - submittedAt;
    const timeOk =
      state.time === 'all' ||
      (state.time === 'week' && ageMs <= 7 * DAY_MS) ||
      (state.time === 'month' && ageMs <= 30 * DAY_MS);

    const categoryOk = state.category === 'open' || row.dataset.category === state.category;

    return scopeOk && timeOk && categoryOk;
  }

  function initials(name) {
    return (name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  function updatePodium(visibleRows) {
    const top3 = visibleRows.slice(0, 3);
    podiumSlots.forEach((slot) => {
      const place = Number(slot.dataset.podiumSlot);
      const rankIndex = place === 1 ? 0 : place === 2 ? 1 : 2;
      const row = top3[rankIndex];
      if (!row) {
        slot.style.visibility = 'hidden';
        return;
      }
      slot.style.visibility = 'visible';
      const name = row.querySelector('.font-medium')?.childNodes[0]?.textContent?.trim() ?? '';
      const total = row.children[4]?.textContent ?? '';
      const country = row.dataset.country ?? '';
      const href = row.querySelector('a')?.getAttribute('href') ?? '#';
      slot.href = href;
      const initialsEl = slot.querySelector('[data-slot-initials]');
      if (initialsEl) initialsEl.textContent = initials(name);
      const nameEl = slot.querySelector('[data-slot-name]');
      if (nameEl) nameEl.textContent = name;
      const countryEl = slot.querySelector('[data-slot-country]');
      if (countryEl) countryEl.textContent = country;
      const totalEl = slot.querySelector('[data-slot-total]');
      if (totalEl) totalEl.textContent = total;
    });
  }

  function applyFilters() {
    const visible = [];
    rows.forEach((row) => {
      const isVisible = matches(row);
      row.hidden = !isVisible;
      if (isVisible) visible.push(row);
    });

    visible.forEach((row, i) => {
      row.querySelector('[data-rank]').textContent = String(i + 1);
    });

    if (noResultsRow) noResultsRow.hidden = visible.length > 0;
    updatePodium(visible);
  }

  root.querySelectorAll('[data-filter-group]').forEach((group) => {
    const key = group.dataset.filterGroup;
    group.querySelectorAll('[data-filter-value]').forEach((btn) => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('[data-filter-value]').forEach((b) => {
          b.classList.remove('tab-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('tab-active');
        btn.setAttribute('aria-pressed', 'true');
        state[key] = btn.dataset.filterValue;
        applyFilters();
      });
    });
  });

  // Highlighting "you" and enabling the Country scope both need to know who
  // is looking — resolved client-side since sessions live in localStorage,
  // not in a cookie the server-rendered table could read.
  getSession().then(async (session) => {
    if (!session) return;
    const { data: profile } = await supabase.from('profiles').select('country').eq('id', session.user.id).single();
    state.viewerCountry = profile?.country ?? null;

    rows.forEach((row) => {
      if (row.dataset.userId === session.user.id) {
        row.classList.add('bg-primary/10');
        const badge = row.querySelector('[data-you-badge]');
        if (badge) badge.hidden = false;
      }
    });
  });

  applyFilters();
}
